import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Activity,
  AlertTriangle,
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Crosshair,
  CheckCircle2,
  Eye,
  Layers,
  Scissors,
  SplitSquareVertical,
  Info,
} from "lucide-react";

export default function BloodFlowViewer({
  analysisResult,
  geometryData,
  selectedLesionId,
  onSelectLesion,
}) {
  const mountRef = useRef(null);
  const stageRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const vesselGroupRef = useRef(null);
  const sliceRingRef = useRef(null);
  const crossSectionCanvasRef = useRef(null);
  const particleSystemRef = useRef(null);
  const particlesDataRef = useRef([]);

  const geom = geometryData || analysisResult?.geometry;
  const hasModelLesion = Boolean(
    geom?.has_stenosis ?? (analysisResult?.prediction === "POSITIVE" && (analysisResult?.stenosis_pixels || 0) > 0)
  );

  // States
  const [isPlaying, setIsPlaying] = useState(true);
  const [flowSpeed, setFlowSpeed] = useState(1.0);
  const [flowMode, setFlowMode] = useState(hasModelLesion ? "stenosed" : "normal"); // 'stenosed' | 'normal'
  const [viewStyle, setViewStyle] = useState("cutaway"); // 'cutaway' | 'transparent' | 'solid' | 'lumen_only'
  const [velocityColormap, setVelocityColormap] = useState(true);
  const [sliderPos, setSliderPos] = useState(50); // 0 to 100% along vessel
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dataSourceMode, setDataSourceMode] = useState(hasModelLesion ? "patient" : "illustrative"); // 'patient' | 'illustrative'

  const arteryName = geom?.artery_name || analysisResult?.localization?.artery || "Coronary Artery (LAD)";
  const arteryCode = geom?.artery_code || analysisResult?.localization?.artery_code || "LAD";
  const metrics = geom?.quantitative_metrics;
  const samples = geom?.samples || [];

  // Multi-lesion collection
  const lesions = useMemo(() => {
    return analysisResult?.lesions || analysisResult?.localization?.lesions || analysisResult?.localization?.lesion_components || geom?.lesions || [];
  }, [analysisResult, geom]);

  const mappedLesions = useMemo(() => {
    return lesions.filter((l) => l.heart_3d_coordinates != null || l.longitudinal_distance_mm != null);
  }, [lesions]);

  // Active lesion selection
  const [internalLesionId, setInternalLesionId] = useState(null);
  const activeLesionId = selectedLesionId || internalLesionId || (mappedLesions[0]?.lesion_id || lesions[0]?.lesion_id || "L1");
  const activeLesion = lesions.find((l) => l.lesion_id === activeLesionId) || mappedLesions[0] || lesions[0] || null;

  const percentStenosis = useMemo(() => {
    if (flowMode === "normal") return 0;
    if (activeLesion?.diameter_stenosis != null) {
      return Math.min(85, Math.max(30, activeLesion.diameter_stenosis));
    }
    if (dataSourceMode === "patient" && metrics?.percent_diameter_stenosis) {
      return Math.min(85, Math.max(30, metrics.percent_diameter_stenosis));
    }
    return 65.0; // Illustrative default 65% DS
  }, [flowMode, dataSourceMode, metrics, activeLesion]);

  // Dimensions of the elongated horizontal coronary artery
  const vesselLength = 7.0; // from x = -3.5 (proximal) to x = +3.5 (distal)
  const normalOuterR = 0.62;
  const normalLumenR = 0.50;

  // Centerline vertical curvature: gentle coronary arch
  const getCenterlineY = useCallback((x) => {
    return 0.16 * Math.sin((x / 3.5) * Math.PI * 0.5);
  }, []);

  // Multi-lesion plaque protrusion height at longitudinal coordinate x
  const getPlaqueHeight = useCallback((x) => {
    if (flowMode === "normal") return 0.0;
    // Map 3D x [-3.5, +3.5] to normalized sample index [0, 99]
    const u = Math.min(1.0, Math.max(0.0, (x + 3.5) / 7.0));
    const sIdx = Math.min(samples.length - 1, Math.max(0, Math.round(u * (samples.length - 1))));
    if (samples.length > 0 && samples[sIdx]) {
      const outerR_mm = samples[sIdx].outer_radius_mm || 3.20;
      const lumenR_mm = samples[sIdx].lumen_radius_mm || 3.20;
      const ratio = Math.max(0.0, (outerR_mm - lumenR_mm) / outerR_mm);
      return normalLumenR * ratio;
    }
    // Fallback: multi-lesion analytical superposition
    let totalPlaque = 0.0;
    const targetLesions = mappedLesions.length > 0 ? mappedLesions : lesions;
    if (targetLesions.length === 0) {
      const dist = Math.abs(x);
      return dist < 1.3 ? normalLumenR * (percentStenosis / 100) * Math.pow(Math.cos((dist / 1.3) * (Math.PI * 0.5)), 2) : 0.0;
    }
    targetLesions.forEach((l) => {
      const l_dist_mm = l.longitudinal_distance_mm || 40.0;
      const l_x = -3.5 + (l_dist_mm / 80.0) * 7.0;
      const dist = Math.abs(x - l_x);
      if (dist < 1.25) {
        const ds = l.diameter_stenosis || percentStenosis;
        const bell = Math.pow(Math.cos((dist / 1.25) * (Math.PI * 0.5)), 2);
        totalPlaque += normalLumenR * (ds / 100) * bell;
      }
    });
    return Math.min(normalLumenR * 0.82, totalPlaque);
  }, [flowMode, samples, normalLumenR, percentStenosis, mappedLesions, lesions]);

  // Current longitudinal X coordinate from slider (0% -> -3.4, 100% -> +3.4)
  const currentSliceX = useMemo(() => {
    return -3.4 + (sliderPos / 100) * 6.8;
  }, [sliderPos]);

  // 1. Draw 2D Circular Cross-Section Canvas
  const drawCrossSectionSlice = useCallback(() => {
    const canvas = crossSectionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Radar coordinate grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    [24, 48, 68, 86].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Cross-hair axes
    ctx.beginPath();
    ctx.moveTo(cx, 10); ctx.lineTo(cx, h - 10);
    ctx.moveTo(10, cy); ctx.lineTo(w - 10, cy);
    ctx.stroke();

    const scale = 110; // pixels per unit radius
    const outerR = normalOuterR * scale;
    const baseLumenR = normalLumenR * scale;
    const plaqueH = getPlaqueHeight(currentSliceX) * scale;
    const hasPlaque = plaqueH > 2.0;

    // 1. Outer Vessel Wall (Tunica Adventitia / Media)
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 2. Atherosclerotic Plaque (Deposit on lower wall protruding upward)
    if (hasPlaque) {
      ctx.fillStyle = "#d97706";
      ctx.beginPath();
      ctx.arc(cx, cy, baseLumenR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Open Patent Lumen (Upper remaining passage)
    const lumenRadius = Math.max(8, baseLumenR - plaqueH * 0.5);
    const lumenCenterY = cy - (hasPlaque ? plaqueH * 0.42 : 0);

    ctx.fillStyle = "#991b1b";
    ctx.beginPath();
    ctx.arc(cx, lumenCenterY, lumenRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hasPlaque ? "#ef4444" : "#22c55e";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Caliper horizontal ruler across lumen
    ctx.strokeStyle = "#00d2d3";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - lumenRadius, lumenCenterY);
    ctx.lineTo(cx + lumenRadius, lumenCenterY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - lumenRadius, lumenCenterY - 4);
    ctx.lineTo(cx - lumenRadius, lumenCenterY + 4);
    ctx.moveTo(cx + lumenRadius, lumenCenterY - 4);
    ctx.lineTo(cx + lumenRadius, lumenCenterY + 4);
    ctx.stroke();
  }, [currentSliceX, getPlaqueHeight]);

  useEffect(() => {
    drawCrossSectionSlice();
  }, [drawCrossSectionSlice]);

  // Auto-fit camera to vessel bounding box
  const fitCameraToVessel = useCallback(() => {
    if (!vesselGroupRef.current || !cameraRef.current || !controlsRef.current) return;
    const box = new THREE.Box3().setFromObject(vesselGroupRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Calculate required distance for horizontal pipe
    const fov = cameraRef.current.fov * (Math.PI / 180);
    const aspect = cameraRef.current.aspect || 1.6;
    const distForWidth = (size.x / 2) / (Math.tan(fov / 2) * aspect);
    const distForHeight = (size.y / 2) / Math.tan(fov / 2);
    const distance = Math.max(distForWidth, distForHeight) * 1.25;

    cameraRef.current.position.set(center.x, center.y + 0.8, center.z + distance);
    cameraRef.current.lookAt(center);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, []);

  // Reset to side anatomical view
  const resetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 1.0, 6.8);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, []);

  const handleZoom = (factor) => {
    if (!cameraRef.current) return;
    cameraRef.current.position.multiplyScalar(factor);
    cameraRef.current.updateProjectionMatrix();
  };

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Main Three.js Scene Setup & Animation
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 540;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x040914);

    // 2. Camera: side view framing horizontal pipe
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 100);
    camera.position.set(0, 1.0, 6.8);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.0;
    controls.maxDistance = 16.0;
    controlsRef.current = controls;

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.4);
    dirLight1.position.set(4, 6, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00d2d3, 1.0);
    dirLight2.position.set(-5, -2, 3);
    scene.add(dirLight2);

    const backlight = new THREE.DirectionalLight(0xff6b81, 0.8);
    backlight.position.set(0, 4, -5);
    scene.add(backlight);

    // 6. Vessel Root Group
    const vesselGroup = new THREE.Group();
    scene.add(vesselGroup);
    vesselGroupRef.current = vesselGroup;

    // Build the Parametric Tubular Vessel
    const numX = 96; // axial slices along length
    const numTheta = 40; // radial segments around tube

    // In 'cutaway' mode, open the top-front arc so user looks directly inside!
    const thetaStart = viewStyle === "cutaway" ? -Math.PI * 0.15 : 0;
    const thetaLength = viewStyle === "cutaway" ? Math.PI * 1.30 : Math.PI * 2.0;

    // A. Outer Arterial Wall Mesh (Tunica Adventitia / Media)
    if (viewStyle !== "lumen_only") {
      const wallGeo = new THREE.CylinderGeometry(
        normalOuterR,
        normalOuterR,
        vesselLength,
        numTheta,
        numX,
        true,
        thetaStart,
        thetaLength
      );
      wallGeo.rotateZ(Math.PI / 2); // Lay horizontal along X-axis

      // Deform cylinder along X to match coronary centerline
      const posAttr = wallGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        posAttr.setY(i, y + getCenterlineY(x));
      }
      wallGeo.computeVertexNormals();

      const wallMat = new THREE.MeshPhysicalMaterial({
        color: 0x932230,
        roughness: 0.35,
        metalness: 0.1,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
        side: THREE.DoubleSide,
        transparent: viewStyle === "transparent",
        opacity: viewStyle === "transparent" ? 0.32 : 1.0,
      });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      vesselGroup.add(wallMesh);
    }

    // B. Inner Lumen Passage Wall (Endothelial lining / Mold)
    const lumenGeo = new THREE.CylinderGeometry(
      normalLumenR,
      normalLumenR,
      vesselLength,
      numTheta,
      numX,
      true,
      thetaStart,
      thetaLength
    );
    lumenGeo.rotateZ(Math.PI / 2);

    const lPos = lumenGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      const x = lPos.getX(i);
      const y = lPos.getY(i);
      const z = lPos.getZ(i);
      const centerY = getCenterlineY(x);
      const plaqueH = getPlaqueHeight(x);

      // If in stenosis region and point is near bottom (y < 0), narrow upward
      let dy = y;
      if (plaqueH > 0 && dy < 0) {
        dy = dy * (1.0 - plaqueH / normalLumenR);
      }
      lPos.setY(i, dy + centerY);
    }
    lumenGeo.computeVertexNormals();

    const lumenMat = new THREE.MeshStandardMaterial({
      color: 0x881337,
      roughness: 0.25,
      metalness: 0.15,
      transparent: true,
      opacity: viewStyle === "lumen_only" ? 0.85 : 0.45,
      side: THREE.BackSide,
      emissive: 0x4c0519,
      emissiveIntensity: 0.3,
    });
    const lumenMesh = new THREE.Mesh(lumenGeo, lumenMat);
    vesselGroup.add(lumenMesh);

    // C. Atherosclerotic Plaque Body (Rooted firmly to bottom wall)
    if (flowMode === "stenosed" && viewStyle !== "lumen_only") {
      const plaqueCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.3, getCenterlineY(-1.3) - normalLumenR + 0.04, 0.0),
        new THREE.Vector3(-0.65, getCenterlineY(-0.65) - normalLumenR + getPlaqueHeight(-0.65) * 0.7, 0.0),
        new THREE.Vector3(0.0, getCenterlineY(0.0) - normalLumenR + getPlaqueHeight(0.0), 0.0), // Peak intrusion
        new THREE.Vector3(0.65, getCenterlineY(0.65) - normalLumenR + getPlaqueHeight(0.65) * 0.7, 0.0),
        new THREE.Vector3(1.3, getCenterlineY(1.3) - normalLumenR + 0.04, 0.0),
      ]);
      const plaqueTubeGeo = new THREE.TubeGeometry(plaqueCurve, 36, normalLumenR * 0.58, 20, false);
      const plaqueMat = new THREE.MeshPhysicalMaterial({
        color: 0xf59e0b,
        emissive: 0x78350f,
        emissiveIntensity: 0.35,
        roughness: 0.45,
        metalness: 0.15,
        clearcoat: 0.6,
        side: THREE.DoubleSide,
      });
      const plaqueMesh = new THREE.Mesh(plaqueTubeGeo, plaqueMat);
      plaqueMesh.name = "plaque";
      vesselGroup.add(plaqueMesh);
    }

    // D. Slicing Plane Indicator Ring in 3D
    const ringGeo = new THREE.TorusGeometry(normalOuterR + 0.04, 0.025, 16, 48);
    ringGeo.rotateY(Math.PI / 2); // Perpendicular to X-axis
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d2d3,
      transparent: true,
      opacity: 0.85,
    });
    const sliceRing = new THREE.Mesh(ringGeo, ringMat);
    sliceRing.position.set(currentSliceX, getCenterlineY(currentSliceX), 0);
    vesselGroup.add(sliceRing);
    sliceRingRef.current = sliceRing;

    // 7. Blood-Flow Particles System (1,600 particles confined strictly to lumen)
    const particleCount = 1600;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const pData = [];

    const halfL = vesselLength / 2; // 3.5

    for (let i = 0; i < particleCount; i++) {
      const x = -halfL + Math.random() * vesselLength;
      const centerY = getCenterlineY(x);
      const plaqueH = getPlaqueHeight(x);

      // Available lumen height: bounded at bottom by plaque
      const minY = -normalLumenR + plaqueH + 0.04;
      const maxY = normalLumenR - 0.04;

      const angle = Math.random() * Math.PI * 2;
      const relRadius = Math.sqrt(Math.random());
      const maxZ = Math.sqrt(Math.max(0, normalLumenR * normalLumenR - (minY + maxY) * (minY + maxY) * 0.25)) - 0.04;

      const y = centerY + minY + Math.random() * (maxY - minY);
      const z = (Math.random() - 0.5) * 2 * Math.max(0.08, maxZ * 0.8);

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      particleColors[i * 3] = 0.1;
      particleColors[i * 3 + 1] = 0.8;
      particleColors[i * 3 + 2] = 1.0;

      pData.push({
        x,
        y,
        z,
        relY: (y - centerY - minY) / (maxY - minY),
        relZ: z / Math.max(0.05, maxZ),
        speedOffset: 0.88 + Math.random() * 0.25,
      });
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.052,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    particleSystemRef.current = particleSystem;
    particlesDataRef.current = pData;
    vesselGroup.add(particleSystem);

    // Initial camera auto-frame
    fitCameraToVessel();

    // 8. Animation Loop with Bernoulli Acceleration Jet
    let animationId;
    let lastTime = performance.now();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();

      if (isPlaying && particleSystemRef.current) {
        const now = performance.now();
        const delta = Math.min((now - lastTime) * 0.001, 0.04);
        lastTime = now;

        const posAttr = particleSystemRef.current.geometry.attributes.position;
        const colAttr = particleSystemRef.current.geometry.attributes.color;
        const arr = posAttr.array;
        const cArr = colAttr.array;

        for (let i = 0; i < particleCount; i++) {
          const p = pData[i];
          const curX = arr[i * 3];
          const plaqueH = getPlaqueHeight(curX);

          // Continuity Equation: v(x) = v0 * (A0 / A(x))
          const availableDiam = normalLumenR * 2 - plaqueH;
          const areaRatio = Math.min(4.2, Math.pow((normalLumenR * 2) / Math.max(0.2, availableDiam), 2));
          const speedFactor = flowMode === "stenosed" ? areaRatio : 1.0;

          // Advance particle horizontally from proximal (-3.5) to distal (+3.5)
          let newX = curX + delta * (1.15 * flowSpeed * speedFactor * p.speedOffset);

          // Reset to proximal inlet when reaching distal outlet
          if (newX > halfL) {
            newX = -halfL;
            p.relY = Math.random();
            p.relZ = (Math.random() - 0.5) * 2;
          }

          // Confine particle strictly inside local patent lumen
          const centerY = getCenterlineY(newX);
          const newPlaqueH = getPlaqueHeight(newX);
          const minY = -normalLumenR + newPlaqueH + 0.04;
          const maxY = normalLumenR - 0.04;
          const targetY = centerY + minY + p.relY * (maxY - minY);

          const maxZ = Math.sqrt(Math.max(0, normalLumenR * normalLumenR - Math.pow(targetY - centerY, 2))) - 0.035;
          const targetZ = p.relZ * Math.max(0.04, maxZ);

          arr[i * 3] = newX;
          arr[i * 3 + 1] = targetY;
          arr[i * 3 + 2] = targetZ;

          // Colormap: Velocity spectrum Jet
          if (velocityColormap) {
            if (speedFactor > 2.5) {
              // High velocity jet through throat: bright red / white
              cArr[i * 3] = 1.0; cArr[i * 3 + 1] = 0.95; cArr[i * 3 + 2] = 0.95;
            } else if (speedFactor > 1.7) {
              // Transitional acceleration: golden amber
              cArr[i * 3] = 1.0; cArr[i * 3 + 1] = 0.75; cArr[i * 3 + 2] = 0.1;
            } else if (speedFactor > 1.25) {
              // Mild acceleration: lime green
              cArr[i * 3] = 0.35; cArr[i * 3 + 1] = 0.95; cArr[i * 3 + 2] = 0.35;
            } else {
              // Normal laminar flow: cyan blue
              cArr[i * 3] = 0.1; cArr[i * 3 + 1] = 0.8; cArr[i * 3 + 2] = 1.0;
            }
          } else {
            // Monochromatic blood red
            cArr[i * 3] = 0.95; cArr[i * 3 + 1] = 0.15; cArr[i * 3 + 2] = 0.2;
          }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    animate();

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, [flowMode, flowSpeed, isPlaying, viewStyle, velocityColormap, percentStenosis, getCenterlineY, getPlaqueHeight, fitCameraToVessel]);

  // Synchronize 3D Slicing Ring Position with slider
  useEffect(() => {
    if (sliceRingRef.current) {
      sliceRingRef.current.position.set(currentSliceX, getCenterlineY(currentSliceX), 0);
    }
  }, [currentSliceX, getCenterlineY]);

  return (
    <div className="bloodflow-container">
      {/* Top Controls Toolbar */}
      <div className="flow-toolbar">
        <div className="flow-title-row">
          <Zap size={18} className="text-accent" />
          <div>
            <h3>3D Hemodynamic Blood-Flow Visualization</h3>
            <small>
              Tubular Coronary Artery Interior & Continuity Jet Simulation · {arteryName} ({arteryCode})
            </small>
          </div>
        </div>

        {/* View Mode & Simulation Controls */}
        <div className="flow-actions">
          {/* View Style Cutaway Selector */}
          <div className="view-style-group" role="group" aria-label="Vessel View Mode">
            <button
              className={`action-btn ${viewStyle === "cutaway" ? "active" : ""}`}
              onClick={() => setViewStyle("cutaway")}
              title="Longitudinal Cutaway: Look inside the arterial lumen"
            >
              <Scissors size={13} />
              <span>Cutaway</span>
            </button>
            <button
              className={`action-btn ${viewStyle === "transparent" ? "active" : ""}`}
              onClick={() => setViewStyle("transparent")}
              title="Transparent: Translucent vascular tissue"
            >
              <Eye size={13} />
              <span>Transparent</span>
            </button>
            <button
              className={`action-btn ${viewStyle === "solid" ? "active" : ""}`}
              onClick={() => setViewStyle("solid")}
              title="Solid: Full opaque anatomical vessel"
            >
              <Layers size={13} />
              <span>Solid</span>
            </button>
            <button
              className={`action-btn ${viewStyle === "lumen_only" ? "active" : ""}`}
              onClick={() => setViewStyle("lumen_only")}
              title="Lumen Only: Fluid passage mold"
            >
              <Activity size={13} />
              <span>Lumen</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Multi-Lesion Jump Pills */}
          {mappedLesions.length > 0 && (
            <div className="flow-lesions-group">
              <span className="flow-lesions-lbl font-mono">FLOW FOCUS:</span>
              {mappedLesions.map((l) => {
                const isAct = l.lesion_id === activeLesionId;
                const posPct = l.longitudinal_distance_mm != null ? Math.round((l.longitudinal_distance_mm / 80.0) * 100) : 50;
                return (
                  <button
                    key={l.lesion_id}
                    className={`action-btn ${isAct ? "active" : ""}`}
                    onClick={() => {
                      setInternalLesionId(l.lesion_id);
                      if (onSelectLesion) onSelectLesion(l.lesion_id);
                      setSliderPos(posPct);
                    }}
                    title={`Focus flow simulation at ${l.lesion_id} (${l.longitudinal_distance_mm || 40} mm)`}
                  >
                    <strong>{l.lesion_id}</strong>
                    <span>({l.longitudinal_distance_mm || 40} mm)</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="toolbar-divider" />

          {/* Normal vs Stenosed Toggle */}
          <button
            className={`action-btn ${flowMode === "stenosed" ? "active-stenosed" : "active-normal"}`}
            onClick={() => setFlowMode(flowMode === "stenosed" ? "normal" : "stenosed")}
            title="Toggle between Stenosed Artery and Patent Normal Artery"
          >
            <SplitSquareVertical size={13} />
            <span>{flowMode === "stenosed" ? "Mode: Stenosed Pipe" : "Mode: Normal Patent"}</span>
          </button>

          {/* Play / Pause */}
          <button
            className="action-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause Flow" : "Play Flow"}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>

          {/* Camera Controls */}
          <button
            className="action-btn"
            onClick={fitCameraToVessel}
            title="Fit Vessel to Viewport"
          >
            <Crosshair size={13} />
            <span>Fit</span>
          </button>
          <button
            className="action-btn"
            onClick={resetCamera}
            title="Reset Camera Orientation"
          >
            <RotateCcw size={13} />
          </button>
          <button
            className="action-btn"
            onClick={() => handleZoom(0.85)}
            title="Zoom In"
          >
            <ZoomIn size={13} />
          </button>
          <button
            className="action-btn"
            onClick={() => handleZoom(1.15)}
            title="Zoom Out"
          >
            <ZoomOut size={13} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            className="action-btn"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Main 3D Viewport Stage */}
      <div className="flow-stage" ref={stageRef}>
        <div className="flow-viewport" ref={mountRef} />

        {/* Floating Cross-Section Synchronized HUD (Top Right) */}
        <div className="flow-crosssection-hud">
          <div className="cs-hud-header">
            <span className="cs-hud-title">Real-Time Cross-Section</span>
            <span className="cs-hud-pos font-mono">X: {sliderPos}% ({(sliderPos * 0.8).toFixed(1)} mm)</span>
          </div>
          <div className="cs-canvas-box">
            <canvas ref={crossSectionCanvasRef} width={130} height={130} />
          </div>
          <div className="cs-hud-stats font-mono">
            <div>
              <span>Narrowing:</span>
              <b className={flowMode === "stenosed" && Math.abs(currentSliceX) < 1.3 ? "text-danger" : "text-success"}>
                {flowMode === "stenosed" && Math.abs(currentSliceX) < 1.3 ? `${percentStenosis.toFixed(1)}% DS` : "0.0%"}
              </b>
            </div>
            <div>
              <span>Status:</span>
              <span>{Math.abs(currentSliceX) < 1.3 && flowMode === "stenosed" ? "Stenosis Site" : "Patent Reference"}</span>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Cross-Section Scrubber Slider */}
        <div className="flow-scrubber-bar">
          <div className="scrubber-label-row">
            <span>Proximal Inlet (0 mm)</span>
            <span className="scrubber-indicator">
              Caliper Position: <strong>{(sliderPos * 0.8).toFixed(1)} mm</strong>
            </span>
            <span>Distal Outlet (80 mm)</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="scrubber-slider"
          />
        </div>

        {/* Velocity Spectrum Legend (Top Left) */}
        {velocityColormap && (
          <div className="flow-legend-hud">
            <span className="hud-title">Flow Velocity Spectrum</span>
            <div className="spectrum-bar">
              <div className="color-strip" />
              <div className="spec-label">
                <span>0.15 m/s</span>
                <span>0.70 m/s</span>
                <span>&gt;1.40 m/s</span>
              </div>
            </div>
            <small className="hud-units">Units: m/s (illustrative)</small>
          </div>
        )}

        {/* Flow Speed & Colormap HUD */}
        <div className="flow-speed-hud">
          <button
            className={`colormap-toggle-btn ${velocityColormap ? "active" : ""}`}
            onClick={() => setVelocityColormap(!velocityColormap)}
          >
            Colormap: {velocityColormap ? "Jet" : "Mono"}
          </button>
          <div className="speed-slider-wrap">
            <Sliders size={12} className="text-accent" />
            <label>{flowSpeed.toFixed(1)}x</label>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={flowSpeed}
              onChange={(e) => setFlowSpeed(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Data Source Provenance Badge */}
        <div className="flow-source-badge">
          <span className="badge-dot" />
          <span>
            {dataSourceMode === "patient" && hasModelLesion
              ? "Patient-Specific Geometry (Derived from Angiogram Segmentation)"
              : "Demonstrative Anatomical Vessel (Procedural Coronary Geometry)"}
          </span>
        </div>
      </div>

      {/* Scientific & Clinical Boundaries Disclaimer */}
      <div className="flow-disclaimer-strip">
        <AlertTriangle size={15} className="text-warning flex-shrink-0" />
        <small>
          <strong>Scientific Principle:</strong> Illustrative flow visualization based on 2D angiographic caliber geometry.
          Local velocity accelerates at the stenosis according to fluid continuity. This visualization does not compute patient-specific
          Computational Fluid Dynamics (CFD), wall shear stress, or invasive Fractional Flow Reserve (FFR).
        </small>
      </div>
    </div>
  );
}
