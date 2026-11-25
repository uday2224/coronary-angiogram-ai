import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  RotateCcw,
  Scissors,
  Eye,
  Sliders,
  Layers,
  Activity,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Crosshair,
  TrendingDown,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export default function ArteryInterior3D({
  analysisResult,
  geometryData,
  selectedLesionId,
  onSelectLesion,
  selectedArtery,
  onSelectArtery,
}) {
  const mountRef = useRef(null);
  const stageRef = useRef(null);
  const crossSectionCanvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const vesselGroupRef = useRef(null);
  const sliceRingRef = useRef(null);

  // Synchronized States
  const [sliderPos, setSliderPos] = useState(50); // 0 to 100% along vessel
  const [viewMode, setViewMode] = useState("cutaway"); // 'cutaway' | 'transparent' | 'solid' | 'lumen_only' | 'plaque_only' | 'wall_only'
  const [flowMode, setFlowMode] = useState("stenosed"); // 'stenosed' | 'normal'
  const [isRotating, setIsRotating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);

  // Cross-Section Visual Layer Toggles
  const [showOuterWall, setShowOuterWall] = useState(true);
  const [showPlaqueLayer, setShowPlaqueLayer] = useState(true);
  const [showLumenLayer, setShowLumenLayer] = useState(true);
  const [showCaliperRuler, setShowCaliperRuler] = useState(true);
  const [layerOpacity, setLayerOpacity] = useState(0.9);

  // Extract geometry and metrics from single source of truth
  const geom = geometryData || analysisResult?.geometry;
  const hasStenosis = Boolean(
    geom?.has_stenosis ?? (analysisResult?.prediction === "POSITIVE" && (analysisResult?.stenosis_pixels || 0) > 0)
  );

  const samples = geom?.samples || [];
  const metrics = geom?.quantitative_metrics;
  const arteryName = geom?.artery_name || analysisResult?.localization?.artery || "Coronary Artery (LAD)";
  const arteryCode = geom?.artery_code || analysisResult?.localization?.artery_code || "LAD";

  // Multi-lesion collection
  const lesions = useMemo(() => {
    return analysisResult?.lesions || analysisResult?.localization?.lesions || analysisResult?.localization?.lesion_components || geom?.lesions || [];
  }, [analysisResult, geom]);

  const mappedLesions = useMemo(() => {
    return lesions.filter((l) => l.heart_3d_coordinates != null || l.longitudinal_distance_mm != null);
  }, [lesions]);

  // Artery selection
  const [internalArtery, setInternalArtery] = useState("LAD");
  const activeArtery = selectedArtery || internalArtery || arteryCode || "LAD";

  // Active lesion selection
  const [internalLesionId, setInternalLesionId] = useState(null);
  const activeLesionId = selectedLesionId || internalLesionId || (mappedLesions[0]?.lesion_id || lesions[0]?.lesion_id || "L1");
  const activeLesion = lesions.find((l) => l.lesion_id === activeLesionId) || mappedLesions[0] || lesions[0] || null;

  // Vessel Physical Dimensions in 3D Space
  const vesselLength = 7.0; // from x = -3.5 (proximal) to x = +3.5 (distal)
  const normalOuterR = 0.62;
  const normalLumenR = 0.50;

  // Centerline vertical curvature: gentle coronary arch
  const getCenterlineY = useCallback((x) => {
    return 0.16 * Math.sin((x / 3.5) * Math.PI * 0.5);
  }, []);

  // Plaque intrusion height rooted to bottom inner wall (y < 0)
  const percentDS = useMemo(() => {
    if (!hasStenosis || flowMode === "normal") return 0.0;
    if (activeLesion?.diameter_stenosis != null) {
      return Math.min(85, Math.max(30, activeLesion.diameter_stenosis));
    }
    if (metrics?.percent_diameter_stenosis) {
      return Math.min(85, Math.max(30, metrics.percent_diameter_stenosis));
    }
    return 65.0;
  }, [hasStenosis, flowMode, metrics, activeLesion]);

  const getPlaqueHeight = useCallback((x) => {
    if (!hasStenosis || flowMode === "normal") return 0.0;
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
      return dist < 1.3 ? normalLumenR * (percentDS / 100) * Math.pow(Math.cos((dist / 1.3) * (Math.PI * 0.5)), 2) : 0.0;
    }
    targetLesions.forEach((l) => {
      const l_dist_mm = l.longitudinal_distance_mm || 40.0;
      const l_x = -3.5 + (l_dist_mm / 80.0) * 7.0;
      const dist = Math.abs(x - l_x);
      if (dist < 1.25) {
        const ds = l.diameter_stenosis || percentDS;
        const bell = Math.pow(Math.cos((dist / 1.25) * (Math.PI * 0.5)), 2);
        totalPlaque += normalLumenR * (ds / 100) * bell;
      }
    });
    return Math.min(normalLumenR * 0.82, totalPlaque);
  }, [hasStenosis, flowMode, samples, normalLumenR, percentDS, mappedLesions, lesions]);

  // Current longitudinal X coordinate from slider (0% -> -3.4, 100% -> +3.4)
  const currentSliceX = useMemo(() => {
    return -3.4 + (sliderPos / 100) * 6.8;
  }, [sliderPos]);

  // Current sample along vessel profile (distance in mm from 0 to 80 mm)
  const currentSampleIdx = Math.min(samples.length - 1, Math.max(0, Math.round((sliderPos / 100) * (samples.length - 1))));
  const currentSample = useMemo(() => {
    if (samples.length > 0 && samples[currentSampleIdx]) {
      return samples[currentSampleIdx];
    }
    const distMm = roundTo(sliderPos * 0.8, 1);
    const localPlaque = getPlaqueHeight(currentSliceX);
    const lumenR = normalLumenR - localPlaque;
    const outerR = normalOuterR;
    const lumenArea = roundTo(Math.PI * Math.pow(lumenR * 3.8, 2), 2);
    const vesselArea = roundTo(Math.PI * Math.pow(outerR * 3.8, 2), 2);
    const areaPct = roundTo(((vesselArea - lumenArea) / vesselArea) * 100, 1);

    return {
      distance_mm: distMm,
      outer_radius_mm: roundTo(outerR * 3.8, 2),
      lumen_radius_mm: roundTo(lumenR * 3.8, 2),
      plaque_thickness_mm: roundTo(localPlaque * 3.8, 2),
      lumen_area_mm2: lumenArea,
      vessel_area_mm2: vesselArea,
      area_stenosis_pct: hasStenosis ? areaPct : 0.0,
      is_stenosis_zone: Math.abs(currentSliceX) < 1.3,
    };
  }, [samples, currentSampleIdx, sliderPos, currentSliceX, getPlaqueHeight, hasStenosis]);

  // Helper rounding function
  function roundTo(val, d = 2) {
    const factor = Math.pow(10, d);
    return Math.round(val * factor) / factor;
  }

  // --- 1. Draw High-Resolution Synchronized Circular Cross-Section Canvas ---
  const drawCircularCrossSection = useCallback(() => {
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
    [32, 64, 92, 118].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Cross-hair measurement axes
    ctx.beginPath();
    ctx.moveTo(cx, 12); ctx.lineTo(cx, h - 12);
    ctx.moveTo(12, cy); ctx.lineTo(w - 12, cy);
    ctx.stroke();

    const scale = 145; // pixels per unit radius
    const outerR = normalOuterR * scale;
    const baseLumenR = normalLumenR * scale;
    const localPlaque = getPlaqueHeight(currentSliceX) * scale;
    const hasPlaque = hasStenosis && localPlaque > 2.0;

    ctx.save();
    ctx.globalAlpha = layerOpacity;

    // 1. Outer Vessel Boundary (Tunica Adventitia / Media)
    if (showOuterWall) {
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 2. Atherosclerotic Plaque Region (Rooted to lower wall)
    if (showPlaqueLayer && hasPlaque) {
      ctx.fillStyle = "#d97706";
      ctx.beginPath();
      ctx.arc(cx, cy, baseLumenR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Open Patent Lumen (Upper blood passage)
    const lumenR = Math.max(10, baseLumenR - localPlaque * 0.52);
    const lumenCenterY = cy - (hasPlaque ? localPlaque * 0.42 : 0);

    if (showLumenLayer) {
      ctx.fillStyle = hasPlaque ? "#991b1b" : "#b91c1c";
      ctx.beginPath();
      ctx.arc(cx, lumenCenterY, lumenR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hasPlaque ? "#ef4444" : "#22c55e";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    // 4. Caliper Annotation & Measurement Ruler
    if (showCaliperRuler) {
      ctx.strokeStyle = "#00d2d3";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - lumenR, lumenCenterY);
      ctx.lineTo(cx + lumenR, lumenCenterY);
      ctx.stroke();

      // End caps
      ctx.beginPath();
      ctx.moveTo(cx - lumenR, lumenCenterY - 5);
      ctx.lineTo(cx - lumenR, lumenCenterY + 5);
      ctx.moveTo(cx + lumenR, lumenCenterY - 5);
      ctx.lineTo(cx + lumenR, lumenCenterY + 5);
      ctx.stroke();

      // Caliper Center Marker
      ctx.fillStyle = "#00d2d3";
      ctx.beginPath();
      ctx.arc(cx, lumenCenterY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [currentSliceX, getPlaqueHeight, hasStenosis, showOuterWall, showPlaqueLayer, showLumenLayer, showCaliperRuler, layerOpacity]);

  useEffect(() => {
    drawCircularCrossSection();
  }, [drawCircularCrossSection]);

  // Auto-fit camera to full elongated horizontal vessel
  const fitCameraToVessel = useCallback(() => {
    if (!vesselGroupRef.current || !cameraRef.current || !controlsRef.current) return;
    const box = new THREE.Box3().setFromObject(vesselGroupRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

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

  // Canonical Camera View Presets
  const setCameraPreset = useCallback((preset) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const center = new THREE.Vector3(0, 0, 0);

    if (preset === "side") {
      cameraRef.current.position.set(0, 0.5, 6.8);
    } else if (preset === "front") {
      cameraRef.current.position.set(-6.2, 0.4, 1.5);
    } else if (preset === "cutaway") {
      cameraRef.current.position.set(0.6, 2.2, 5.8);
    } else {
      cameraRef.current.position.set(0, 0.8, 6.6);
    }
    cameraRef.current.lookAt(center);
    controlsRef.current.target.copy(center);
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

  // Jump to specific landmark slice
  const jumpToSlice = (target) => {
    if (target === "proximal") setSliderPos(15);
    else if (target === "mla") setSliderPos(50);
    else if (target === "distal") setSliderPos(85);
  };

  // --- 2. Main Three.js Scene Construction ---
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x050c18);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 100);
    camera.position.set(0.4, 1.4, 6.8);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.0;
    controls.maxDistance = 16.0;
    controlsRef.current = controls;

    // 5. Directional & Tissue Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight1.position.set(4, 6, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00d2d3, 1.1);
    dirLight2.position.set(-5, -2, 3);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0xff4757, 0.9);
    rimLight.position.set(0, 4, -5);
    scene.add(rimLight);

    // 6. Vessel Root Group
    const vesselGroup = new THREE.Group();
    scene.add(vesselGroup);
    vesselGroupRef.current = vesselGroup;

    // Geometry Generation Parameters
    const numX = 96;
    const numTheta = 40;

    // Cutaway arc: opens top-front to expose inner lumen & plaque
    const isCutaway = viewMode === "cutaway";
    const thetaStart = isCutaway ? -Math.PI * 0.15 : 0;
    const thetaLength = isCutaway ? Math.PI * 1.30 : Math.PI * 2.0;

    // A. Outer Arterial Wall Mesh (Tunica Media / Adventitia)
    if (viewMode !== "lumen_only" && viewMode !== "plaque_only") {
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

      const pos = wallGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setY(i, y + getCenterlineY(x));
      }
      wallGeo.computeVertexNormals();

      const wallMat = new THREE.MeshPhysicalMaterial({
        color: 0x932230,
        roughness: 0.35,
        metalness: 0.1,
        clearcoat: 0.6,
        side: THREE.DoubleSide,
        transparent: viewMode === "transparent",
        opacity: viewMode === "transparent" ? 0.32 : 1.0,
      });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.name = "outer_wall";
      vesselGroup.add(wallMesh);
    }

    // B. Inner Lumen Passage Wall
    if (viewMode !== "wall_only" && viewMode !== "plaque_only") {
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
        const centerY = getCenterlineY(x);
        const plaqueH = getPlaqueHeight(x);

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
        opacity: viewMode === "lumen_only" ? 0.88 : 0.45,
        side: THREE.BackSide,
        emissive: 0x4c0519,
        emissiveIntensity: 0.3,
      });
      const lumenMesh = new THREE.Mesh(lumenGeo, lumenMat);
      lumenMesh.name = "inner_lumen";
      vesselGroup.add(lumenMesh);
    }

    // C. Atherosclerotic Plaque Body (Rooted firmly to inner bottom wall)
    if (hasStenosis && flowMode === "stenosed" && viewMode !== "lumen_only" && viewMode !== "wall_only") {
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

    // D. 3D Caliper Indicator Ring in 3D
    const ringGeo = new THREE.TorusGeometry(normalOuterR + 0.035, 0.025, 16, 48);
    ringGeo.rotateY(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d2d3,
      transparent: true,
      opacity: 0.88,
    });
    const sliceRing = new THREE.Mesh(ringGeo, ringMat);
    sliceRing.position.set(currentSliceX, getCenterlineY(currentSliceX), 0);
    vesselGroup.add(sliceRing);
    sliceRingRef.current = sliceRing;

    // Initial framing
    fitCameraToVessel();

    // Animation Loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();

      if (isRotating && vesselGroupRef.current) {
        vesselGroupRef.current.rotation.y += 0.008;
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
  }, [hasStenosis, flowMode, viewMode, percentDS, getCenterlineY, getPlaqueHeight, fitCameraToVessel, isRotating]);

  // Synchronize 3D Ring with Slider Position
  useEffect(() => {
    if (sliceRingRef.current) {
      sliceRingRef.current.position.set(currentSliceX, getCenterlineY(currentSliceX), 0);
    }
  }, [currentSliceX, getCenterlineY]);

  return (
    <div className="artery-interior-workstation">
      {/* ═══ 1. Top Controls Bar ═══ */}
      <div className="interior-top-bar">
        <div>
          <h2>3D Artery Interior & Caliber Workstation</h2>
          <p>
            Longitudinal vessel cutaway, inner lumen passage inspection, and synchronized cross-sectional analysis · {arteryName}
          </p>
        </div>

        {/* View Mode & Simulation Toggles */}
        <div className="interior-top-actions">
          <div className="view-style-group" role="group" aria-label="Interior View Mode">
            <button
              className={`action-btn ${viewMode === "cutaway" ? "active" : ""}`}
              onClick={() => setViewMode("cutaway")}
              title="Longitudinal Cutaway: Look inside the arterial lumen"
            >
              <Scissors size={13} />
              <span>Cutaway</span>
            </button>
            <button
              className={`action-btn ${viewMode === "transparent" ? "active" : ""}`}
              onClick={() => setViewMode("transparent")}
              title="Transparent: Translucent vascular wall"
            >
              <Eye size={13} />
              <span>Transparent</span>
            </button>
            <button
              className={`action-btn ${viewMode === "solid" ? "active" : ""}`}
              onClick={() => setViewMode("solid")}
              title="Solid: Full opaque anatomical vessel"
            >
              <Layers size={13} />
              <span>Solid</span>
            </button>
            <button
              className={`action-btn ${viewMode === "lumen_only" ? "active" : ""}`}
              onClick={() => setViewMode("lumen_only")}
              title="Lumen Only: Fluid passage mold"
            >
              <Activity size={13} />
              <span>Lumen</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Normal vs Stenosed Mode Toggle */}
          <button
            className={`action-btn ${flowMode === "stenosed" ? "active-stenosed" : "active-normal"}`}
            onClick={() => setFlowMode(flowMode === "stenosed" ? "normal" : "stenosed")}
            title="Toggle between Stenosed and Patent Normal Artery geometry"
          >
            <span>{flowMode === "stenosed" ? "Stenosed Artery" : "Patent Normal"}</span>
          </button>
        </div>
      </div>

      {/* ═══ 2. Main Workstation Grid (3D Stage Left + Cross Section Right) ═══ */}
      <div className="interior-workspace-grid">
        {/* LEFT COLUMN: 3D Artery Viewport Stage */}
        <div className="artery-3d-stage" ref={stageRef}>
          <div className="viewport-3d" ref={mountRef} />

          {/* Viewport Floating HUD Controls */}
          <div className="stage-controls-hud">
            <button className="hud-btn" onClick={fitCameraToVessel} title="Fit Vessel to Viewport">
              <Crosshair size={13} />
              <span>Fit</span>
            </button>
            <button className="hud-btn" onClick={() => setCameraPreset("side")} title="Side View">
              <span>Side</span>
            </button>
            <button className="hud-btn" onClick={() => setCameraPreset("front")} title="Front View">
              <span>Front</span>
            </button>
            <button className="hud-btn" onClick={() => setCameraPreset("cutaway")} title="Cutaway Angle">
              <Compass size={13} />
              <span>Cutaway</span>
            </button>
            <button className="hud-btn" onClick={() => handleZoom(0.85)} title="Zoom In">
              <ZoomIn size={13} />
            </button>
            <button className="hud-btn" onClick={() => handleZoom(1.15)} title="Zoom Out">
              <ZoomOut size={13} />
            </button>
            <button
              className={`hud-btn ${isRotating ? "active" : ""}`}
              onClick={() => setIsRotating(!isRotating)}
              title="Auto-Rotate Artery"
            >
              <RotateCcw size={13} />
            </button>
            <button className="hud-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>

          {/* Anatomical Segment Overlay Tags */}
          <div className="viewport-overlay-labels">
            <span className="anat-tag proximal">PROXIMAL INLET (0 mm)</span>
            {hasStenosis && flowMode === "stenosed" ? (
              <span className="anat-tag lesion-zone">LESION EPICENTER (MLA)</span>
            ) : (
              <span className="anat-tag normal">PATENT MID SEGMENT</span>
            )}
            <span className="anat-tag distal">DISTAL RUNOFF (80 mm)</span>
          </div>

          {/* Bottom Longitudinal Scrubber Slider (Inside Stage) */}
          <div className="stage-scrubber-bar">
            <div className="scrubber-header">
              <div className="quick-jump-group">
                <span className="qj-label">Jump to Slice:</span>
                <button className="qj-btn normal" onClick={() => jumpToSlice("proximal")}>
                  Proximal (15 mm)
                </button>
                {mappedLesions.map((l) => {
                  const isAct = l.lesion_id === activeLesionId;
                  const lPosPct = l.longitudinal_distance_mm != null ? (l.longitudinal_distance_mm / 80.0) * 100 : 50;
                  return (
                    <button
                      key={l.lesion_id}
                      className={`qj-btn ${isAct ? "mla active" : "normal"}`}
                      onClick={() => {
                        jumpToSlice(null, lPosPct);
                        setInternalLesionId(l.lesion_id);
                        if (onSelectLesion) onSelectLesion(l.lesion_id);
                      }}
                      title={`Jump to ${l.lesion_id} MLA (${l.longitudinal_distance_mm || 40} mm)`}
                    >
                      <strong>{l.lesion_id} MLA</strong> ({l.longitudinal_distance_mm || 40} mm{l.diameter_stenosis ? ` · ${l.diameter_stenosis}%` : ""})
                    </button>
                  );
                })}
                {mappedLesions.length === 0 && (
                  <button
                    className={`qj-btn ${hasStenosis ? "mla" : "normal"}`}
                    onClick={() => jumpToSlice("mla")}
                  >
                    {hasStenosis ? "MLA Epicenter (40 mm)" : "Mid Segment (40 mm)"}
                  </button>
                )}
                <button className="qj-btn normal" onClick={() => jumpToSlice("distal")}>
                  Distal (70 mm)
                </button>
              </div>
              <span className="caliper-pos-tag font-mono">
                Caliper: <strong>{currentSample.distance_mm} mm</strong> ({sliderPos}%)
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              className="stage-slider"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Synchronized Circular Cross-Section Inspection Panel */}
        <div className="cross-section-sidebar">
          <div className="sidebar-sec-title">
            <Activity size={15} className="text-accent" />
            <span>Synchronized Circular Cross-Section</span>
          </div>

          {/* Large High-Contrast Circular Canvas */}
          <div className="circular-canvas-container">
            <canvas ref={crossSectionCanvasRef} width={260} height={260} className="cross-section-canvas" />
            <div className="canvas-watermark font-mono">
              SLICE AT {currentSample.distance_mm} mm
            </div>
          </div>

          {/* Layer Visibility & Opacity Controls */}
          <div className="cs-layer-controls">
            <div className="layer-toggles-row">
              <label className="layer-check">
                <input
                  type="checkbox"
                  checked={showOuterWall}
                  onChange={(e) => setShowOuterWall(e.target.checked)}
                />
                <span className="chk-label">Outer Wall</span>
              </label>
              {hasStenosis && (
                <label className="layer-check">
                  <input
                    type="checkbox"
                    checked={showPlaqueLayer}
                    onChange={(e) => setShowPlaqueLayer(e.target.checked)}
                  />
                  <span className="chk-label plaque">Plaque</span>
                </label>
              )}
              <label className="layer-check">
                <input
                  type="checkbox"
                  checked={showLumenLayer}
                  onChange={(e) => setShowLumenLayer(e.target.checked)}
                />
                <span className="chk-label lumen">Lumen</span>
              </label>
              <label className="layer-check">
                <input
                  type="checkbox"
                  checked={showCaliperRuler}
                  onChange={(e) => setShowCaliperRuler(e.target.checked)}
                />
                <span className="chk-label caliper">Ruler</span>
              </label>
            </div>
          </div>

          {/* Anatomical Color Legend Bar */}
          <div className="slice-color-legend">
            <div className="leg-item">
              <span className="dot" style={{ background: "#475569" }} />
              <span>Arterial Wall (Adventitia / Media)</span>
            </div>
            {hasStenosis && (
              <div className="leg-item">
                <span className="dot" style={{ background: "#d97706" }} />
                <span>Atherosclerotic Plaque (Intimal Protrusion)</span>
              </div>
            )}
            <div className="leg-item">
              <span className="dot red" />
              <span>Patent Blood Channel (Lumen)</span>
            </div>
            <div className="leg-item">
              <span className="dot" style={{ background: "#00d2d3" }} />
              <span>Calibrated Caliper Line (mm)</span>
            </div>
          </div>

          {/* Section 1: Local Caliber at Active Slice */}
          <div className="metrics-group-card">
            <span className="group-title">Local Caliber (At {currentSample.distance_mm} mm)</span>
            <div className="slice-metrics-grid">
              <div className="s-card">
                <span className="s-lbl">Lumen Diameter</span>
                <span className="s-val font-mono">{currentSample.lumen_radius_mm * 2} mm</span>
              </div>
              <div className="s-card">
                <span className="s-lbl">Lumen Area</span>
                <span className="s-val font-mono">{currentSample.lumen_area_mm2} mm²</span>
              </div>
              <div className="s-card">
                <span className="s-lbl">Outer Wall Caliber</span>
                <span className="s-val font-mono">{currentSample.outer_radius_mm * 2} mm</span>
              </div>
              <div className="s-card">
                <span className="s-lbl">Area Reduction</span>
                <span className={`s-val font-mono ${currentSample.is_stenosis_zone && hasStenosis ? "text-danger" : "text-success"}`}>
                  {currentSample.area_stenosis_pct}%
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Active Lesion QCA Parameters */}
          <div className="metrics-group-card">
            <div className="lesion-sub-selector-row">
              <span className="group-title">
                {activeLesion ? `Lesion ${activeLesion.lesion_id} QCA Caliber` : "Global Analysis Caliber"}
              </span>
              {lesions.length > 1 && (
                <div className="mini-lesion-chips">
                  {lesions.map((l) => (
                    <button
                      key={l.lesion_id}
                      className={`mini-l-chip ${l.lesion_id === activeLesionId ? "active" : ""}`}
                      onClick={() => {
                        setInternalLesionId(l.lesion_id);
                        if (onSelectLesion) onSelectLesion(l.lesion_id);
                        if (l.longitudinal_distance_mm != null) {
                          setSliderPos(Math.round((l.longitudinal_distance_mm / 80.0) * 100));
                        }
                      }}
                      title={l.artery_name}
                    >
                      {l.lesion_id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="global-metrics-table">
              <div className="gm-row">
                <span>Reference Caliber (RVD):</span>
                <b className="font-mono">
                  {activeLesion?.reference_diameter_mm
                    ? `${activeLesion.reference_diameter_mm.toFixed(2)} mm`
                    : metrics?.reference_diameter_mm
                    ? `${metrics.reference_diameter_mm.toFixed(2)} mm`
                    : "3.20 mm"}
                </b>
              </div>
              <div className={`gm-row ${hasStenosis ? "danger" : ""}`}>
                <span>Minimal Lumen Diam (MLD):</span>
                <b className="font-mono">
                  {activeLesion?.minimal_lumen_diameter_mm != null
                    ? `${activeLesion.minimal_lumen_diameter_mm.toFixed(2)} mm`
                    : metrics?.minimal_lumen_diameter_mm != null
                    ? `${metrics.minimal_lumen_diameter_mm.toFixed(2)} mm`
                    : "3.20 mm"}
                </b>
              </div>
              <div className={`gm-row ${hasStenosis ? "danger" : ""}`}>
                <span>Minimal Lumen Area (MLA):</span>
                <b className="font-mono">
                  {activeLesion?.minimal_lumen_area_mm2 != null
                    ? `${activeLesion.minimal_lumen_area_mm2.toFixed(2)} mm²`
                    : metrics?.minimal_lumen_area_mm2 != null
                    ? `${metrics.minimal_lumen_area_mm2.toFixed(2)} mm²`
                    : "8.04 mm²"}
                </b>
              </div>
              <div className={`gm-row ${hasStenosis ? "warning" : ""}`}>
                <span>Diameter Stenosis (%DS):</span>
                <b className="font-mono">
                  {hasStenosis && activeLesion?.diameter_stenosis != null
                    ? `${activeLesion.diameter_stenosis.toFixed(1)}%`
                    : hasStenosis && metrics?.percent_diameter_stenosis != null
                    ? `${metrics.percent_diameter_stenosis.toFixed(1)}%`
                    : "0.0%"}
                </b>
              </div>
              {activeLesion?.lesion_length_mm != null && (
                <div className="gm-row">
                  <span>Lesion Length:</span>
                  <b className="font-mono">{activeLesion.lesion_length_mm.toFixed(1)} mm</b>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3. Bottom Longitudinal Lumen Caliber Graph & Scrubber ═══ */}
      <div className="interior-graph-container">
        <div className="graph-header-row">
          <div className="title-left">
            <TrendingDown size={16} className={hasStenosis ? "text-warning" : "text-success"} />
            <h3>Synchronized Longitudinal Lumen Caliber Profile (0 – 80 mm)</h3>
          </div>
          <span className="graph-hint font-mono">
            Click anywhere on the curve to jump the 3D caliper ring to that longitudinal position.
          </span>
        </div>

        <div
          className="graph-svg-wrapper"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const normPos = Math.max(0, Math.min(100, Math.round(((clickX - 50) / (rect.width - 70)) * 100)));
            setSliderPos(normPos);
          }}
        >
          <svg viewBox="0 0 800 150" className="longitudinal-caliber-svg">
            {/* Grid Lines */}
            <line x1="50" y1="25" x2="770" y2="25" stroke="#1d334e" strokeDasharray="3 3" />
            <line x1="50" y1="60" x2="770" y2="60" stroke="#1d334e" strokeDasharray="3 3" />
            <line x1="50" y1="95" x2="770" y2="95" stroke="#1d334e" strokeDasharray="3 3" />
            <line x1="50" y1="130" x2="770" y2="130" stroke="#243e5e" />

            {/* RVD Reference Line */}
            <line x1="50" y1="40" x2="770" y2="40" stroke="#2ed573" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="55" y="34" fill="#2ed573" fontSize="10" fontFamily="monospace">
              Reference Vessel Diameter (RVD: {metrics?.reference_diameter_mm ? metrics.reference_diameter_mm.toFixed(2) : "3.20"} mm)
            </text>

            {/* Shaded Lesion Zones for all mapped lesions */}
            {hasStenosis && mappedLesions.map((l) => {
              const distMm = l.longitudinal_distance_mm || 40.0;
              const x_center = 50 + (distMm / 80.0) * 720;
              return (
                <g key={l.lesion_id}>
                  <rect
                    x={x_center - 45}
                    y="25"
                    width="90"
                    height="105"
                    fill={l.lesion_id === activeLesionId ? "rgba(0, 242, 254, 0.12)" : "rgba(255, 71, 87, 0.08)"}
                    rx="4"
                  />
                  <text
                    x={x_center}
                    y="36"
                    fill={l.lesion_id === activeLesionId ? "#00f2fe" : "#ff4757"}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {l.lesion_id} ZONE
                  </text>
                </g>
              );
            })}

            {/* Dynamic Polyline Path derived from actual samples */}
            {samples.length > 0 ? (
              <polyline
                fill="none"
                stroke="#00d2d3"
                strokeWidth="2.5"
                points={samples.map((s, i) => {
                  const x = 50 + (i / (samples.length - 1)) * 720;
                  const diam = s.lumen_radius_mm * 2;
                  const y = 120 - Math.min(1.0, Math.max(0.1, diam / 3.20)) * 80;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(" ")}
              />
            ) : hasStenosis ? (
              <path
                d="M 50,40 Q 280,40 330,65 T 400,105 T 470,65 Q 520,40 770,42"
                fill="none"
                stroke="#00d2d3"
                strokeWidth="2.5"
              />
            ) : (
              <line x1="50" y1="40" x2="770" y2="40" stroke="#2ed573" strokeWidth="2.5" />
            )}

            {/* Minimum Lumen Point Markers for all mapped lesions */}
            {hasStenosis && mappedLesions.map((l) => {
              const distMm = l.longitudinal_distance_mm || 40.0;
              const x_center = 50 + (distMm / 80.0) * 720;
              const mld = l.minimal_lumen_diameter_mm || metrics?.minimal_lumen_diameter_mm || 1.10;
              const y_pos = 120 - (mld / 3.20) * 80;
              const isSel = l.lesion_id === activeLesionId;
              return (
                <g key={l.lesion_id}>
                  <circle
                    cx={x_center}
                    cy={y_pos}
                    r={isSel ? "6" : "4.5"}
                    fill={isSel ? "#00f2fe" : "#ff4757"}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x_center}
                    y={y_pos + 16}
                    fill={isSel ? "#00f2fe" : "#ff4757"}
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {l.lesion_id} ({mld.toFixed(2)} mm)
                  </text>
                </g>
              );
            })}

            {/* Active Caliper Hairline Tracker */}
            <line
              x1={50 + (sliderPos / 100) * 720}
              y1="20"
              x2={50 + (sliderPos / 100) * 720}
              y2="135"
              stroke="#00d2d3"
              strokeWidth="2"
            />
            <circle
              cx={50 + (sliderPos / 100) * 720}
              cy={hasStenosis && sliderPos > 35 && sliderPos < 65 ? 105 - Math.cos(((sliderPos - 50) / 15) * Math.PI * 0.5) * 65 : 40}
              r="4"
              fill="#00d2d3"
            />

            {/* Y-Axis Caliber Labels */}
            <text x="10" y="42" fill="#6f87a3" fontSize="9" fontFamily="monospace">3.5 mm</text>
            <text x="10" y="78" fill="#6f87a3" fontSize="9" fontFamily="monospace">2.0 mm</text>
            <text x="10" y="115" fill="#6f87a3" fontSize="9" fontFamily="monospace">1.0 mm</text>

            {/* X-Axis Caliber Labels */}
            <text x="50" y="145" fill="#6f87a3" fontSize="9" fontFamily="monospace">0 mm (Ostium)</text>
            <text x="380" y="145" fill="#ffa502" fontSize="9" fontFamily="monospace">40 mm (Mid / MLA)</text>
            <text x="710" y="145" fill="#6f87a3" fontSize="9" fontFamily="monospace">80 mm (Distal)</text>
          </svg>
        </div>
      </div>

      {/* ═══ 4. Data Provenance & Scientific Methodology ═══ */}
      <div className="cs-provenance-container">
        <button
          className="provenance-toggle-btn"
          onClick={() => setShowProvenance(!showProvenance)}
          aria-expanded={showProvenance}
        >
          <div className="toggle-left">
            <Info size={15} className="text-accent" />
            <span>Data Provenance & Calculation Transparency ("How was this calculated?")</span>
          </div>
          {showProvenance ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showProvenance && (
          <div className="provenance-details-panel">
            <div className="provenance-grid">
              <div className="prov-item">
                <span className="prov-lbl">Analysis ID</span>
                <span className="prov-val font-mono">{analysisResult?.analysis_id || "N/A"}</span>
              </div>
              <div className="prov-item">
                <span className="prov-lbl">Active Caliper Slice</span>
                <span className="prov-val font-mono">{currentSample.distance_mm} mm ({sliderPos}%)</span>
              </div>
              <div className="prov-item">
                <span className="prov-lbl">Segmentation Source</span>
                <span className="prov-val font-mono">
                  {analysisResult?.stenosis_pixels
                    ? `${analysisResult.stenosis_pixels.toLocaleString()} lesion pixels / ${analysisResult.vessel_pixels?.toLocaleString()} vessel pixels`
                    : "0 positive lesion pixels (Patent Artery)"}
                </span>
              </div>
              <div className="prov-item">
                <span className="prov-lbl">Physical Calibration Scale</span>
                <span className="prov-val font-mono">
                  {geom?.calibration_metadata?.calibration_source || "0.20 mm/px (Research Standard Scaling)"}
                </span>
              </div>
            </div>

            <div className="prov-formulas">
              <h4>Quantitative Formulation & Scientific Disclaimers</h4>
              <ul>
                <li>
                  <strong>Diameter Stenosis (%DS):</strong> <code>%DS = ((RVD - MLD) / RVD) × 100%</code>, where RVD is the mean caliber of proximal and distal unstenosed reference segments.
                </li>
                <li>
                  <strong>Minimal Lumen Area (MLA):</strong> Measured as the minimal patent lumen cross-section along the reconstructed centerline.
                </li>
                <li>
                  <strong>Plaque Burden:</strong> Explicitly marked <em>Not available</em> without intravascular imaging (IVUS/OCT) because 2D angiographic projection cannot independently resolve circumferential intimal thickness.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
