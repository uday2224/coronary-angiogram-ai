import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  RotateCcw,
  Eye,
  EyeOff,
  Crosshair,
  Layers,
  ZoomIn,
  ZoomOut,
  Info,
  Activity,
  Heart,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Scissors,
  Maximize2,
  Compass,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

// Anatomical coronary artery specifications with clinical perfusion profiles
const CORONARY_ARTERY_DETAILS = {
  LAD: {
    name: "Left Anterior Descending Artery (LAD)",
    code: "LAD",
    color: "#ff4757",
    course: "Courses down the anterior interventricular sulcus toward the cardiac apex.",
    perfusion: "Supplies anterior 2/3 of interventricular septum, anterior left ventricular wall, and cardiac apex (45-55% of LV mass).",
    clinical_note: "Clinically designated the 'widow maker'. Occlusion causes extensive anterior wall myocardial infarction and acute cardiogenic shock.",
    branches: ["First Diagonal (D1)", "Second Diagonal (D2)", "Septal Perforators"],
    aha_segments: "Segments 6 (Proximal), 7 (Mid), 8 (Distal)",
  },
  LCX: {
    name: "Left Circumflex Artery (LCX)",
    code: "LCX",
    color: "#ffa502",
    course: "Originates from LMCA and traverses the left atrioventricular groove under the left auricle toward the posterior cardiac base.",
    perfusion: "Supplies posterolateral left ventricle, obtuse cardiac margin, and the SA node (in ~40% of patients).",
    clinical_note: "Occlusions frequently manifest as lateral or posterior STEMI, which can be electrically silent on standard 12-lead ECG.",
    branches: ["Obtuse Marginal 1 (OM1)", "Obtuse Marginal 2 (OM2)", "Left Atrial Circumflex"],
    aha_segments: "Segments 11 (Proximal), 13 (Distal), 12 (OM1)",
  },
  RCA: {
    name: "Right Coronary Artery (RCA)",
    code: "RCA",
    color: "#2ed573",
    course: "Arises from the right aortic sinus and courses down the anterior right coronary sulcus (AV groove) to the posterior crux cordis.",
    perfusion: "Supplies the right ventricle, inferior/diaphragmatic LV wall, SA node (60%), and AV node (90% in right-dominant hearts).",
    clinical_note: "Occlusion leads to inferior wall MI, profound vagal bradycardia, and high-degree AV conduction blocks.",
    branches: ["Conus Artery", "Sinus Node Branch", "Acute Marginal (AM)", "Posterior Descending Artery (PDA)"],
    aha_segments: "Segments 1 (Proximal), 2 (Mid), 3 (Distal), 4 (PDA)",
  },
  LMCA: {
    name: "Left Main Coronary Artery (LMCA)",
    code: "LMCA",
    color: "#00d2d3",
    course: "Short common trunk (5–20 mm) originating from the left aortic sinus of Valsalva, coursing behind the pulmonary trunk before bifurcating.",
    perfusion: "Supplies approximately 70–85% of total left ventricular myocardial mass via LAD and LCX combined.",
    clinical_note: "Significant stenosis (>50%) represents a class I indication for surgical coronary artery bypass grafting (CABG).",
    branches: ["Bifurcation into LAD and LCX", "Ramus Intermedius (in 15-20% trifurcation)"],
    aha_segments: "Segment 5 (Left Main Trunk)",
  },
  AORTA: {
    name: "Ascending Aorta & Aortic Arch",
    code: "AORTA",
    color: "#e056fd",
    course: "Primary vascular outflow tract exiting the left ventricle, arching superiorly and posteriorly.",
    perfusion: "Carries total systemic cardiac output; coronary ostia arise from the aortic sinuses of Valsalva.",
    clinical_note: "Provides coronary perfusion pressure primarily during ventricular diastole.",
    branches: ["Brachiocephalic Artery", "Left Common Carotid", "Left Subclavian"],
    aha_segments: "Aortic Root & Sinuses of Valsalva",
  },
};

// Camera view presets with standard medical anatomical orientations
const CAMERA_PRESETS = {
  Anterior: { pos: [0, 0.2, 4.2], target: [0, 0, 0], desc: "Anterior (AP) View: Frontal view showing RV, anterior LV, LAD, and aortic arch." },
  Posterior: { pos: [0, 0.2, -4.2], target: [0, 0, 0], desc: "Posterior (PA) View: Shows Left Atrium, pulmonary veins, and PDA." },
  LeftLateral: { pos: [-4.2, 0.2, 0], target: [0, 0, 0], desc: "Left Lateral (LAO) View: Shows LV free wall and LCX obtuse marginal branches." },
  RightLateral: { pos: [4.2, 0.2, 0], target: [0, 0, 0], desc: "Right Lateral (RAO) View: Shows Right Atrium, SVC/IVC, and RCA trajectory." },
  Superior: { pos: [0, 4.2, 0.1], target: [0, 0, 0], desc: "Superior (Cranial) View: Shows Aortic arch, Great vessels, and base of the heart." },
  Inferior: { pos: [0, -4.2, 0.1], target: [0, 0, 0], desc: "Inferior (Caudal) View: Diaphragmatic surface and cardiac apex." },
};

export default function VirtualHeart3D({
  analysisResult,
  onSelectArteryFromHeart,
  activeSelectedArtery,
  onNavigateToArteryInterior,
  selectedLesionId,
  onSelectLesion,
}) {
  const mountRef = useRef(null);
  const gizmoRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const heartGroupRef = useRef(null);
  const myocardiumGroupRef = useRef(null);
  const greatVesselsGroupRef = useRef(null);
  const arteryGroupRef = useRef(null);
  const pulmonaryGroupRef = useRef(null);
  const labelsGroupRef = useRef(null);
  const multiLesionsGroupRef = useRef(null);
  const arteryMeshesRef = useRef({});
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Multi-lesion collection
  const lesions = useMemo(() => {
    return analysisResult?.lesions || analysisResult?.localization?.lesions || analysisResult?.localization?.lesion_components || [];
  }, [analysisResult]);

  const mappedLesions = useMemo(() => {
    return lesions.filter((l) => l.heart_3d_coordinates != null);
  }, [lesions]);

  const unmappedLesions = useMemo(() => {
    return lesions.filter((l) => l.heart_3d_coordinates == null);
  }, [lesions]);

  // Selected lesion state
  const [internalSelectedLesionId, setInternalSelectedLesionId] = useState(null);
  const activeLesionId = selectedLesionId || internalSelectedLesionId || (mappedLesions[0]?.lesion_id || lesions[0]?.lesion_id || "L1");
  const activeLesion = lesions.find((l) => l.lesion_id === activeLesionId) || mappedLesions[0] || lesions[0] || null;

  // Interactive UI States
  const [selectedArtery, setSelectedArtery] = useState("LAD");
  const [hoveredArtery, setHoveredArtery] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [modelLoading, setModelLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [modelType, setModelType] = useState("Loading...");

  // Inspection & Display Modes
  const [inspectionMode, setInspectionMode] = useState("realistic"); // 'realistic', 'translucent', 'isolated', 'lesion_focus'
  const [myocardiumOpacity, setMyocardiumOpacity] = useState(1.0);

  // Anatomical Layer Toggles
  const [showMyocardium, setShowMyocardium] = useState(true);
  const [showGreatVessels, setShowGreatVessels] = useState(true);
  const [showCoronaryTree, setShowCoronaryTree] = useState(true);
  const [showPulmonaryVessels, setShowPulmonaryVessels] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [showLesionBeacon, setShowLesionBeacon] = useState(true);
  const [activeCameraView, setActiveCameraView] = useState("Anterior");

  // Keep internal selected artery synced with external props
  useEffect(() => {
    if (activeSelectedArtery && CORONARY_ARTERY_DETAILS[activeSelectedArtery]) {
      setSelectedArtery(activeSelectedArtery);
    }
  }, [activeSelectedArtery]);

  // Determine lesion coordinates from analysis
  const localization = analysisResult?.localization;
  const hasStenosis = Boolean(
    analysisResult?.prediction === "POSITIVE" &&
    (analysisResult?.stenosis_pixels || 0) > 0 &&
    lesions.length > 0
  );
  const mappedArteryCode = activeLesion?.artery_code || localization?.artery_code || "LAD";

  // Camera transition animation
  const transitionCameraTo = useCallback((targetPos, lookAt = [0, 0, 0]) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(...targetPos);
    const startTarget = controls.target.clone();
    const endTarget = new THREE.Vector3(...lookAt);

    let progress = 0;
    const startTime = performance.now();
    const duration = 750; // ms

    function animateCamera(now) {
      const elapsed = now - startTime;
      progress = Math.min(1.0, elapsed / duration);
      // Smooth cubic ease out
      const ease = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPos, endPos, ease);
      controls.target.lerpVectors(startTarget, endTarget, ease);
      controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateCamera);
      }
    }
    requestAnimationFrame(animateCamera);
  }, []);

  // Handle Preset Camera Views
  const handleViewPreset = (viewKey) => {
    setActiveCameraView(viewKey);
    const preset = CAMERA_PRESETS[viewKey];
    if (preset) {
      transitionCameraTo(preset.pos, preset.target);
    }
  };

  // Zoom directly to selected lesion
  const handleSelectLesionItem = useCallback((lesionId) => {
    setInternalSelectedLesionId(lesionId);
    if (onSelectLesion) onSelectLesion(lesionId);
    const l = lesions.find((item) => item.lesion_id === lesionId);
    if (l?.heart_3d_coordinates) {
      const c = l.heart_3d_coordinates;
      transitionCameraTo([c.x * 2.2, c.y * 2.2, c.z * 2.8], [c.x, c.y, c.z]);
      if (l.artery_code && CORONARY_ARTERY_DETAILS[l.artery_code]) {
        setSelectedArtery(l.artery_code);
        if (onSelectArteryFromHeart) onSelectArteryFromHeart(l.artery_code);
      }
    }
  }, [lesions, onSelectLesion, onSelectArteryFromHeart, transitionCameraTo]);

  // Switch Inspection Modes
  const handleSetInspectionMode = (mode) => {
    setInspectionMode(mode);
    if (mode === "realistic") {
      setShowMyocardium(true);
      setMyocardiumOpacity(1.0);
      setShowCoronaryTree(true);
      setShowGreatVessels(true);
    } else if (mode === "translucent") {
      setShowMyocardium(true);
      setMyocardiumOpacity(0.28);
      setShowCoronaryTree(true);
      setShowGreatVessels(true);
    } else if (mode === "isolated") {
      setShowMyocardium(false);
      setMyocardiumOpacity(0.0);
      setShowCoronaryTree(true);
      setShowGreatVessels(false);
    } else if (mode === "lesion_focus") {
      setShowMyocardium(true);
      setMyocardiumOpacity(0.4);
      setShowCoronaryTree(true);
      const targetCoords = activeLesion?.heart_3d_coordinates || mappedLesions[0]?.heart_3d_coordinates;
      if (hasStenosis && targetCoords) {
        setShowLesionBeacon(true);
        transitionCameraTo([targetCoords.x * 2.2, targetCoords.y * 2.2, targetCoords.z * 2.8], [targetCoords.x, targetCoords.y, targetCoords.z]);
      }
    }
  };

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 540;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060f1c);
    scene.fog = new THREE.FogExp2(0x060f1c, 0.05);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 4.2);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.6;
    controls.maxDistance = 8.5;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting Setup (Medical Studio HDR-style 4-Point Lighting)
    const ambientLight = new THREE.AmbientLight(0x23374d, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(4, 5, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    fillLight.position.set(-5, -1, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xff6b81, 1.8);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);

    const bottomBounce = new THREE.DirectionalLight(0x1e293b, 0.8);
    bottomBounce.position.set(0, -4, 0);
    scene.add(bottomBounce);

    // 6. Root Heart Group
    const heartGroup = new THREE.Group();
    heartGroupRef.current = heartGroup;
    scene.add(heartGroup);

    // Sub-Groups for Anatomical Layers
    const myocardiumGroup = new THREE.Group();
    myocardiumGroup.name = "myocardium_group";
    myocardiumGroupRef.current = myocardiumGroup;
    heartGroup.add(myocardiumGroup);

    const greatVesselsGroup = new THREE.Group();
    greatVesselsGroup.name = "great_vessels_group";
    greatVesselsGroupRef.current = greatVesselsGroup;
    heartGroup.add(greatVesselsGroup);

    const pulmonaryGroup = new THREE.Group();
    pulmonaryGroup.name = "pulmonary_group";
    pulmonaryGroupRef.current = pulmonaryGroup;
    heartGroup.add(pulmonaryGroup);

    const arteryGroup = new THREE.Group();
    arteryGroup.name = "artery_group";
    arteryGroupRef.current = arteryGroup;
    heartGroup.add(arteryGroup);

    const labelsGroup = new THREE.Group();
    labelsGroup.name = "labels_group";
    labelsGroupRef.current = labelsGroup;
    heartGroup.add(labelsGroup);

    // ═══════════════════════════════════════════════════════════════════
    // 7. Load Anatomical 3D Mesh Asset via GLTFLoader
    // ═══════════════════════════════════════════════════════════════════
    const gltfLoader = new GLTFLoader();
    const primaryAssetUrl = "/models/heart_organ3d.glb";
    const fallbackAssetUrl = "/models/heart_nih.glb";

    function setupLoadedModel(gltf, sourceName) {
      const root = gltf.scene;
      
      // Auto-compute bounding box to normalize scale and center
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
      const targetScale = 2.4 / maxDim; // Standardize to ~2.4 units height

      root.scale.set(targetScale, targetScale, targetScale);
      root.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale);

      // Enhance materials for PBR medical realism
      root.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.roughness = 0.42;
            child.material.metalness = 0.08;
            if (child.material.isMeshStandardMaterial) {
              child.material.envMapIntensity = 1.0;
            }
          }
        }
      });

      myocardiumGroup.add(root);
      setModelLoading(false);
      setModelType(sourceName);
    }

    // Attempt loading primary high-res anatomical model
    gltfLoader.load(
      primaryAssetUrl,
      (gltf) => {
        setupLoadedModel(gltf, "3D Anatomical Organ Model (2K PBR ZBrush)");
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadingProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.warn("Primary 3D heart asset failed to load, trying fallback:", err);
        // Fallback to secondary NIH model
        gltfLoader.load(
          fallbackAssetUrl,
          (fallbackGltf) => {
            setupLoadedModel(fallbackGltf, "NIH 3D Anatomical Heart (CC0 Medical Mesh)");
          },
          null,
          (fallbackErr) => {
            console.error("All GLB assets failed to load:", fallbackErr);
            setModelLoading(false);
            setModelType("Procedural High-Detail Anatomical Mesh");
          }
        );
      }
    );

    // ═══════════════════════════════════════════════════════════════════
    // 8. Build Complete Anatomic Coronary Arterial Tree (Layer B)
    // ═══════════════════════════════════════════════════════════════════
    // Materials
    const baseArteryMat = new THREE.MeshStandardMaterial({
      color: 0xff3838,
      roughness: 0.32,
      metalness: 0.25,
      emissive: 0x8b0000,
      emissiveIntensity: 0.35,
    });

    const highlightArteryMat = new THREE.MeshStandardMaterial({
      color: 0x00d2d3,
      roughness: 0.2,
      metalness: 0.4,
      emissive: 0x00a8ff,
      emissiveIntensity: 0.75,
    });

    // 1. LMCA (Left Main Trunk)
    const lmcaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02, 0.75, 0.24),
      new THREE.Vector3(-0.16, 0.70, 0.38),
      new THREE.Vector3(-0.30, 0.64, 0.48),
    ]);
    const lmcaGeo = new THREE.TubeGeometry(lmcaCurve, 20, 0.052, 16, false);
    const lmcaMesh = new THREE.Mesh(lmcaGeo, baseArteryMat.clone());
    lmcaMesh.name = "LMCA";
    lmcaMesh.userData = { code: "LMCA", name: "Left Main Coronary Artery" };
    arteryGroup.add(lmcaMesh);
    arteryMeshesRef.current["LMCA"] = lmcaMesh;

    // 2. LAD (Left Anterior Descending) — courses along anterior interventricular sulcus
    const ladCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.30, 0.64, 0.48),
      new THREE.Vector3(-0.27, 0.44, 0.70),
      new THREE.Vector3(-0.22, 0.20, 0.86),
      new THREE.Vector3(-0.18, -0.08, 0.90),
      new THREE.Vector3(-0.14, -0.38, 0.82),
      new THREE.Vector3(-0.16, -0.72, 0.56),
      new THREE.Vector3(-0.19, -0.96, 0.24), // Cardiac Apex
      new THREE.Vector3(-0.16, -1.02, 0.08),
    ]);
    const ladGeo = new THREE.TubeGeometry(ladCurve, 64, 0.046, 16, false);
    const ladMesh = new THREE.Mesh(ladGeo, baseArteryMat.clone());
    ladMesh.name = "LAD";
    ladMesh.userData = { code: "LAD", name: "Left Anterior Descending Artery" };
    arteryGroup.add(ladMesh);
    arteryMeshesRef.current["LAD"] = ladMesh;

    // Diagonal 1 (D1)
    const d1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.22, 0.20, 0.86),
      new THREE.Vector3(-0.46, 0.08, 0.80),
      new THREE.Vector3(-0.68, -0.14, 0.64),
      new THREE.Vector3(-0.78, -0.32, 0.45),
    ]);
    const d1Geo = new THREE.TubeGeometry(d1Curve, 28, 0.028, 12, false);
    const d1Mesh = new THREE.Mesh(d1Geo, baseArteryMat.clone());
    d1Mesh.name = "D1";
    d1Mesh.userData = { code: "LAD", name: "First Diagonal Branch (D1)" };
    arteryGroup.add(d1Mesh);

    // Diagonal 2 (D2)
    const d2Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.14, -0.38, 0.82),
      new THREE.Vector3(-0.38, -0.48, 0.72),
      new THREE.Vector3(-0.52, -0.62, 0.50),
    ]);
    const d2Geo = new THREE.TubeGeometry(d2Curve, 20, 0.024, 12, false);
    const d2Mesh = new THREE.Mesh(d2Geo, baseArteryMat.clone());
    d2Mesh.name = "D2";
    d2Mesh.userData = { code: "LAD", name: "Second Diagonal Branch (D2)" };
    arteryGroup.add(d2Mesh);

    // Septal Perforator (S1)
    const s1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.27, 0.44, 0.70),
      new THREE.Vector3(-0.22, 0.38, 0.55),
      new THREE.Vector3(-0.15, 0.32, 0.40),
    ]);
    const s1Geo = new THREE.TubeGeometry(s1Curve, 16, 0.022, 10, false);
    const s1Mesh = new THREE.Mesh(s1Geo, baseArteryMat.clone());
    s1Mesh.userData = { code: "LAD", name: "Septal Perforator (S1)" };
    arteryGroup.add(s1Mesh);

    // 3. LCX (Left Circumflex Artery) — courses along left atrioventricular groove
    const lcxCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.30, 0.64, 0.48),
      new THREE.Vector3(-0.56, 0.56, 0.35),
      new THREE.Vector3(-0.82, 0.44, 0.08),
      new THREE.Vector3(-0.90, 0.22, -0.26),
      new THREE.Vector3(-0.78, -0.04, -0.56),
      new THREE.Vector3(-0.56, -0.28, -0.68),
      new THREE.Vector3(-0.34, -0.42, -0.62),
    ]);
    const lcxGeo = new THREE.TubeGeometry(lcxCurve, 54, 0.042, 16, false);
    const lcxMesh = new THREE.Mesh(lcxGeo, baseArteryMat.clone());
    lcxMesh.name = "LCX";
    lcxMesh.userData = { code: "LCX", name: "Left Circumflex Artery" };
    arteryGroup.add(lcxMesh);
    arteryMeshesRef.current["LCX"] = lcxMesh;

    // Obtuse Marginal 1 (OM1)
    const om1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.82, 0.44, 0.08),
      new THREE.Vector3(-0.98, 0.18, 0.04),
      new THREE.Vector3(-0.96, -0.22, -0.04),
      new THREE.Vector3(-0.85, -0.52, -0.10),
    ]);
    const om1Geo = new THREE.TubeGeometry(om1Curve, 28, 0.028, 12, false);
    const om1Mesh = new THREE.Mesh(om1Geo, baseArteryMat.clone());
    om1Mesh.name = "OM1";
    om1Mesh.userData = { code: "LCX", name: "First Obtuse Marginal (OM1)" };
    arteryGroup.add(om1Mesh);

    // Obtuse Marginal 2 (OM2)
    const om2Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.90, 0.22, -0.26),
      new THREE.Vector3(-0.95, -0.08, -0.32),
      new THREE.Vector3(-0.82, -0.36, -0.42),
    ]);
    const om2Geo = new THREE.TubeGeometry(om2Curve, 20, 0.024, 12, false);
    const om2Mesh = new THREE.Mesh(om2Geo, baseArteryMat.clone());
    om2Mesh.name = "OM2";
    om2Mesh.userData = { code: "LCX", name: "Second Obtuse Marginal (OM2)" };
    arteryGroup.add(om2Mesh);

    // 4. RCA (Right Coronary Artery) — courses along right atrioventricular groove
    const rcaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.22, 0.72, 0.20),
      new THREE.Vector3(0.58, 0.60, 0.26),
      new THREE.Vector3(0.82, 0.38, 0.34),
      new THREE.Vector3(0.88, 0.06, 0.32),
      new THREE.Vector3(0.84, -0.26, 0.20),
      new THREE.Vector3(0.70, -0.54, -0.04),
      new THREE.Vector3(0.48, -0.72, -0.30),
      new THREE.Vector3(0.25, -0.76, -0.45), // Crux
    ]);
    const rcaGeo = new THREE.TubeGeometry(rcaCurve, 58, 0.044, 16, false);
    const rcaMesh = new THREE.Mesh(rcaGeo, baseArteryMat.clone());
    rcaMesh.name = "RCA";
    rcaMesh.userData = { code: "RCA", name: "Right Coronary Artery" };
    arteryGroup.add(rcaMesh);
    arteryMeshesRef.current["RCA"] = rcaMesh;

    // Conus Branch
    const conusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.22, 0.72, 0.20),
      new THREE.Vector3(0.12, 0.68, 0.35),
      new THREE.Vector3(-0.02, 0.62, 0.45),
    ]);
    const conusGeo = new THREE.TubeGeometry(conusCurve, 16, 0.020, 10, false);
    const conusMesh = new THREE.Mesh(conusGeo, baseArteryMat.clone());
    conusMesh.userData = { code: "RCA", name: "Conus Artery" };
    arteryGroup.add(conusMesh);

    // Acute Marginal (AM)
    const amCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.84, -0.26, 0.20),
      new THREE.Vector3(0.78, -0.42, 0.42),
      new THREE.Vector3(0.62, -0.62, 0.52),
    ]);
    const amGeo = new THREE.TubeGeometry(amCurve, 20, 0.025, 12, false);
    const amMesh = new THREE.Mesh(amGeo, baseArteryMat.clone());
    amMesh.userData = { code: "RCA", name: "Acute Marginal Branch" };
    arteryGroup.add(amMesh);

    // Posterior Descending Artery (PDA) — runs along posterior interventricular groove
    const pdaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.25, -0.76, -0.45),
      new THREE.Vector3(0.12, -0.80, -0.32),
      new THREE.Vector3(0.00, -0.85, -0.15),
      new THREE.Vector3(-0.08, -0.92, 0.05),
      new THREE.Vector3(-0.16, -1.02, 0.08), // Reaches Apex
    ]);
    const pdaGeo = new THREE.TubeGeometry(pdaCurve, 32, 0.034, 14, false);
    const pdaMesh = new THREE.Mesh(pdaGeo, baseArteryMat.clone());
    pdaMesh.name = "PDA";
    pdaMesh.userData = { code: "RCA", name: "Posterior Descending Artery (PDA)" };
    arteryGroup.add(pdaMesh);

    // ═══════════════════════════════════════════════════════════════════
    // 9. Pulsing Multi-Lesion Beacon Markers (AI Findings Integration)
    // ═══════════════════════════════════════════════════════════════════
    const multiLesionsGroup = new THREE.Group();
    multiLesionsGroup.name = "multi_lesions_beacon_group";
    multiLesionsGroupRef.current = multiLesionsGroup;

    // Helper to generate text sprite for 3D Pin badge
    function createLesionLabelSprite(text, isSelected) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = isSelected ? "rgba(0, 242, 254, 0.95)" : "rgba(255, 71, 87, 0.90)";
      ctx.beginPath();
      ctx.roundRect(10, 8, 108, 48, 12);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.24, 0.12, 1.0);
      return sprite;
    }

    mappedLesions.forEach((l) => {
      const isSelected = l.lesion_id === activeLesionId;
      const bGroup = new THREE.Group();
      bGroup.name = `beacon_${l.lesion_id}`;
      bGroup.userData = { lesionId: l.lesion_id, lesion: l };

      // Core sphere
      const coreGeo = new THREE.SphereGeometry(isSelected ? 0.09 : 0.07, 24, 24);
      const coreMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x00f2fe : 0xff4757,
        emissive: isSelected ? 0x00a8ff : 0xff0033,
        emissiveIntensity: isSelected ? 1.5 : 1.1,
        roughness: 0.1,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.userData = { lesionId: l.lesion_id, lesion: l };
      bGroup.add(coreMesh);

      // Outer pulsing halo
      const haloGeo = new THREE.SphereGeometry(isSelected ? 0.16 : 0.13, 24, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x00f2fe : 0xff4757,
        transparent: true,
        opacity: 0.45,
        wireframe: true,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.name = "halo";
      bGroup.add(haloMesh);

      // Floating Pin Badge Sprite
      const sprite = createLesionLabelSprite(l.lesion_id, isSelected);
      sprite.position.set(0, 0.15, 0);
      bGroup.add(sprite);

      const h3d = l.heart_3d_coordinates;
      bGroup.position.set(h3d.x, h3d.y, h3d.z);
      multiLesionsGroup.add(bGroup);
    });

    multiLesionsGroup.visible = Boolean(hasStenosis && showLesionBeacon && mappedLesions.length > 0);
    heartGroup.add(multiLesionsGroup);

    // ═══════════════════════════════════════════════════════════════════
    // 10. Floating 3D Anatomical Label Pins
    // ═══════════════════════════════════════════════════════════════════
    const labelPins = [
      { name: "Ascending Aorta", pos: [0.1, 1.25, 0.1], color: "#e056fd" },
      { name: "Pulmonary Trunk", pos: [-0.35, 1.05, 0.25], color: "#38bdf8" },
      { name: "LAD (Anterior Sulcus)", pos: [-0.22, 0.15, 0.92], color: "#ff4757" },
      { name: "LCX (Left AV Groove)", pos: [-0.85, 0.35, 0.15], color: "#ffa502" },
      { name: "RCA (Right AV Groove)", pos: [0.85, 0.25, 0.32], color: "#2ed573" },
      { name: "Left Ventricle / Apex", pos: [-0.20, -0.98, 0.24], color: "#ff6b81" },
    ];

    labelPins.forEach((pin) => {
      const pinSphereGeo = new THREE.SphereGeometry(0.04, 16, 16);
      const pinSphereMat = new THREE.MeshBasicMaterial({ color: pin.color });
      const pinMesh = new THREE.Mesh(pinSphereGeo, pinSphereMat);
      pinMesh.position.set(...pin.pos);

      // Line to heart
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...pin.pos),
        new THREE.Vector3(pin.pos[0] * 0.7, pin.pos[1] * 0.7, pin.pos[2] * 0.7),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: pin.color, transparent: true, opacity: 0.6 });
      const lineMesh = new THREE.Line(lineGeo, lineMat);

      labelsGroup.add(pinMesh);
      labelsGroup.add(lineMesh);
    });
    labelsGroup.visible = showLabels;

    // ═══════════════════════════════════════════════════════════════════
    // 11. Animation & Render Loop
    // ═══════════════════════════════════════════════════════════════════
    let animationFrameId;

    function renderLoop() {
      animationFrameId = requestAnimationFrame(renderLoop);
      const time = performance.now() * 0.001;

      // Pulse all lesion halos
      if (multiLesionsGroup && multiLesionsGroup.visible) {
        multiLesionsGroup.children.forEach((bGroup) => {
          const halo = bGroup.getObjectByName("halo");
          if (halo) {
            const isSel = bGroup.userData?.lesionId === activeLesionId;
            const pulseRate = isSel ? 6.5 : 4.0;
            const scale = 1.0 + Math.sin(time * pulseRate) * (isSel ? 0.32 : 0.20);
            halo.scale.set(scale, scale, scale);
          }
        });
      }

      // Gentle floating animation in isolated/viewing mode
      controls.update();
      renderer.render(scene, camera);
    }
    renderLoop();

    // Canvas click raycaster to select lesion beacons directly in 3D
    const handleCanvasClick = (event) => {
      if (!container || !camera) return;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      if (multiLesionsGroupRef.current) {
        const intersects = raycaster.intersectObjects(multiLesionsGroupRef.current.children, true);
        if (intersects.length > 0) {
          let obj = intersects[0].object;
          while (obj && !obj.userData?.lesionId && obj.parent) {
            obj = obj.parent;
          }
          if (obj && obj.userData?.lesionId) {
            handleSelectLesionItem(obj.userData.lesionId);
          }
        }
      }
    };
    container.addEventListener("click", handleCanvasClick);

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      container.removeEventListener("click", handleCanvasClick);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [hasStenosis, activeLesionId, mappedLesions.length]);

  // Update Myocardium Opacity & Layer Visibility
  useEffect(() => {
    if (myocardiumGroupRef.current) {
      myocardiumGroupRef.current.visible = showMyocardium;
      myocardiumGroupRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = myocardiumOpacity < 0.99;
          child.material.opacity = myocardiumOpacity;
          child.material.depthWrite = myocardiumOpacity > 0.6;
          child.material.needsUpdate = true;
        }
      });
    }
  }, [showMyocardium, myocardiumOpacity]);

  useEffect(() => {
    if (greatVesselsGroupRef.current) greatVesselsGroupRef.current.visible = showGreatVessels;
    if (pulmonaryGroupRef.current) pulmonaryGroupRef.current.visible = showPulmonaryVessels;
    if (arteryGroupRef.current) arteryGroupRef.current.visible = showCoronaryTree;
    if (labelsGroupRef.current) labelsGroupRef.current.visible = showLabels;
    if (multiLesionsGroupRef.current) multiLesionsGroupRef.current.visible = Boolean(showLesionBeacon && hasStenosis && mappedLesions.length > 0);
  }, [showGreatVessels, showPulmonaryVessels, showCoronaryTree, showLabels, showLesionBeacon, hasStenosis, mappedLesions.length]);

  // Highlight Selected Artery
  useEffect(() => {
    Object.entries(arteryMeshesRef.current).forEach(([code, mesh]) => {
      if (!mesh || !mesh.material) return;
      if (code === selectedArtery) {
        mesh.material.emissive.setHex(0x00d2d3);
        mesh.material.emissiveIntensity = 0.85;
        mesh.scale.set(1.15, 1.15, 1.15);
      } else {
        mesh.material.emissive.setHex(0x8b0000);
        mesh.material.emissiveIntensity = 0.35;
        mesh.scale.set(1.0, 1.0, 1.0);
      }
      mesh.material.needsUpdate = true;
    });
  }, [selectedArtery]);

  // Handle Raycasting Pointer Click & Hover on Canvas
  const handlePointerDown = (e) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !arteryGroupRef.current) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(arteryGroupRef.current.children, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const code = hit.userData?.code || hit.name;
      if (code && CORONARY_ARTERY_DETAILS[code]) {
        setSelectedArtery(code);
        if (onSelectArteryFromHeart) onSelectArteryFromHeart(code);
      }
    }
  };

  const handlePointerMove = (e) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !arteryGroupRef.current) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(arteryGroupRef.current.children, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const code = hit.userData?.code || hit.name;
      setHoveredArtery(hit.userData?.name || code);
      setHoverPosition({ x: e.clientX - rect.left + 15, y: e.clientY - rect.top - 15 });
      container.style.cursor = "pointer";
    } else {
      setHoveredArtery(null);
      container.style.cursor = "grab";
    }
  };

  const activeDetails = CORONARY_ARTERY_DETAILS[selectedArtery] || CORONARY_ARTERY_DETAILS["LAD"];

  return (
    <div className="virtual-heart-container">
      {/* 3D WebGL Canvas */}
      <div
        className="heart-viewport"
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      />

      {/* Loading Progress Overlay */}
      {modelLoading && (
        <div className="model-loading-overlay">
          <Loader2 size={28} className="spin text-accent" />
          <b>Loading High-Resolution Anatomical Heart…</b>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${loadingProgress}%` }} />
          </div>
          <small>{loadingProgress}% downloaded (GLTF PBR Model)</small>
        </div>
      )}

      {/* Floating Hover Tooltip */}
      {hoveredArtery && (
        <div
          className="artery-hover-tooltip"
          style={{ left: hoverPosition.x, top: hoverPosition.y }}
        >
          <Activity size={12} className="text-accent" />
          <span>{hoveredArtery}</span>
        </div>
      )}

      {/* Model Spec Badge */}
      <div className="model-spec-badge font-mono">
        <Sparkles size={11} className="text-accent" />
        <span>ASSET: {modelType}</span>
      </div>

      {/* ═══ 1. Floating HUD Controls (Top-Left) ═══ */}
      <div className="heart-hud-controls">
        {/* Inspection Mode Toggles */}
        <div className="hud-mode-row">
          <button
            className={`mode-btn ${inspectionMode === "realistic" ? "active" : ""}`}
            onClick={() => handleSetInspectionMode("realistic")}
            title="Realistic Anatomical Tissue Mode"
          >
            <Heart size={12} />
            <span>Realistic</span>
          </button>
          <button
            className={`mode-btn ${inspectionMode === "translucent" ? "active" : ""}`}
            onClick={() => handleSetInspectionMode("translucent")}
            title="Translucent Myocardium for Coronary Course Inspection"
          >
            <Eye size={12} />
            <span>Coronary Glass</span>
          </button>
          <button
            className={`mode-btn ${inspectionMode === "isolated" ? "active" : ""}`}
            onClick={() => handleSetInspectionMode("isolated")}
            title="Isolate Coronary Arterial System"
          >
            <Activity size={12} />
            <span>Isolated Tree</span>
          </button>
          {hasStenosis && (
            <button
              className={`mode-btn lesion-pulse-btn ${inspectionMode === "lesion_focus" ? "active" : ""}`}
              onClick={() => handleSetInspectionMode("lesion_focus")}
              title="Focus Camera directly on AI-detected Lesion"
            >
              <Crosshair size={12} />
              <span>Lesion Focus</span>
            </button>
          )}
        </div>

        {/* Camera Anatomical View Presets */}
        <div className="hud-presets">
          {Object.keys(CAMERA_PRESETS).map((viewKey) => (
            <button
              key={viewKey}
              className={`hud-btn ${activeCameraView === viewKey ? "active" : ""}`}
              onClick={() => handleViewPreset(viewKey)}
            >
              {viewKey}
            </button>
          ))}
          <button
            className="hud-btn reset"
            onClick={() => handleViewPreset("Anterior")}
            title="Reset Camera Orientation"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
        </div>

        {/* Anatomical Layer Controls */}
        <div className="hud-toggles">
          <button
            className={`hud-toggle-btn ${showMyocardium ? "active" : ""}`}
            onClick={() => setShowMyocardium(!showMyocardium)}
          >
            {showMyocardium ? <Eye size={11} /> : <EyeOff size={11} />}
            <span>Myocardium</span>
          </button>
          <button
            className={`hud-toggle-btn ${showCoronaryTree ? "active" : ""}`}
            onClick={() => setShowCoronaryTree(!showCoronaryTree)}
          >
            {showCoronaryTree ? <Eye size={11} /> : <EyeOff size={11} />}
            <span>Coronary Tree</span>
          </button>
          <button
            className={`hud-toggle-btn ${showGreatVessels ? "active" : ""}`}
            onClick={() => setShowGreatVessels(!showGreatVessels)}
          >
            {showGreatVessels ? <Eye size={11} /> : <EyeOff size={11} />}
            <span>Great Vessels</span>
          </button>
          <button
            className={`hud-toggle-btn ${showLabels ? "active" : ""}`}
            onClick={() => setShowLabels(!showLabels)}
          >
            <Layers size={11} />
            <span>3D Labels</span>
          </button>
          {hasStenosis && (
            <button
              className={`hud-toggle-btn lesion-btn ${showLesionBeacon ? "active" : ""}`}
              onClick={() => setShowLesionBeacon(!showLesionBeacon)}
            >
              <Crosshair size={11} />
              <span>Lesion Beacon</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══ 2. Multi-Lesion Selector Strip & Active Lesion Dossier (Bottom-Left) ═══ */}
      {hasStenosis && lesions.length > 0 && showLesionBeacon && (
        <div className="heart-multi-lesions-hud">
          {/* Lesion Selection Navigation Chips */}
          <div className="heart-lesions-nav-bar">
            <span className="nav-label font-mono">
              <Crosshair size={12} className="text-danger" />
              LESIONS ({lesions.length}):
            </span>
            <div className="nav-chips-list">
              {lesions.map((l) => {
                const isSel = l.lesion_id === activeLesionId;
                const isMapped = Boolean(l.heart_3d_coordinates);
                return (
                  <button
                    key={l.lesion_id}
                    className={`lesion-chip-btn ${isSel ? "active" : ""} ${isMapped ? "mapped" : "unmapped"}`}
                    onClick={() => handleSelectLesionItem(l.lesion_id)}
                    title={isMapped ? `Mapped to ${l.vessel_position || l.segment} ${l.artery_code}` : "2D-only projection fragment (No 3D anchor)"}
                  >
                    <span className="dot" />
                    <strong>{l.lesion_id}</strong>
                    <span className="seg">{l.vessel_position || l.segment || l.artery_code}</span>
                    {!isMapped && <span className="tag-2d">2D</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Active Lesion Dossier */}
          {activeLesion && (
            <div className="heart-lesion-dossier-card">
              <div className="dossier-header">
                <div className="dossier-title">
                  <span className="dossier-tag">{activeLesion.lesion_id}</span>
                  <span className="dossier-name">{activeLesion.artery_name}</span>
                </div>
                <span className={`status-pill ${activeLesion.heart_3d_coordinates ? "mapped" : "unmapped"}`}>
                  {activeLesion.artery_assignment_status || (activeLesion.heart_3d_coordinates ? "Mapped" : "Unmapped")}
                </span>
              </div>

              <div className="dossier-metrics-grid">
                <div className="m-item">
                  <span className="lbl">Segment</span>
                  <span className="val">{activeLesion.vessel_position || activeLesion.segment || "Reference"}</span>
                </div>
                <div className="m-item">
                  <span className="lbl">Area (2D)</span>
                  <span className="val font-mono">{activeLesion.pixel_area || activeLesion.area_px} px</span>
                </div>
                {activeLesion.diameter_stenosis != null && (
                  <div className="m-item">
                    <span className="lbl">% Stenosis</span>
                    <span className="val font-mono text-danger font-bold">{activeLesion.diameter_stenosis}% DS</span>
                  </div>
                )}
                {activeLesion.minimal_lumen_diameter_mm != null && (
                  <div className="m-item">
                    <span className="lbl">MLD</span>
                    <span className="val font-mono">{activeLesion.minimal_lumen_diameter_mm} mm</span>
                  </div>
                )}
              </div>

              <div className="dossier-desc">
                {activeLesion.mapping_status}
              </div>

              <div className="dossier-actions">
                {activeLesion.heart_3d_coordinates && (
                  <button
                    className="dossier-action-btn focus"
                    onClick={() => handleSelectLesionItem(activeLesion.lesion_id)}
                    title="Zoom camera directly to this 3D marker"
                  >
                    <Crosshair size={11} />
                    <span>Zoom to Marker</span>
                  </button>
                )}
                {onNavigateToArteryInterior && (
                  <button
                    className="dossier-action-btn interior"
                    onClick={onNavigateToArteryInterior}
                    title="Inspect in 3D Artery Interior"
                  >
                    <Scissors size={11} />
                    <span>Inspect Interior</span>
                    <ArrowRight size={10} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ 3. Right Column: Artery Clinical Dossier & Cross-Navigation ═══ */}
      <div className="heart-sidebar">
        <div className="sidebar-header">
          <Heart size={16} className="text-accent" />
          <h4>Anatomical Artery Inspector</h4>
        </div>

        {/* Artery Selection Pills */}
        <div className="artery-pills">
          {Object.keys(CORONARY_ARTERY_DETAILS).map((code) => {
            const isTarget = hasStenosis && mappedArteryCode === code;
            return (
              <button
                key={code}
                className={`artery-pill ${selectedArtery === code ? "active" : ""} ${isTarget ? "has-lesion" : ""}`}
                onClick={() => {
                  setSelectedArtery(code);
                  if (onSelectArteryFromHeart) onSelectArteryFromHeart(code);
                }}
              >
                <span>{code}</span>
                {isTarget && <span className="lesion-indicator-dot" title="Suspected lesion present" />}
              </button>
            );
          })}
        </div>

        {/* Detailed Artery Clinical Card */}
        <div className="artery-detail-card">
          <div className="card-top">
            <span className="detail-code">{activeDetails.code}</span>
            <span className="detail-name">{activeDetails.name}</span>
          </div>

          <div className="detail-section">
            <span className="sec-label">ANATOMICAL COURSE</span>
            <p>{activeDetails.course}</p>
          </div>

          <div className="detail-section">
            <span className="sec-label">MYOCARDIAL PERFUSION TERRITORY</span>
            <p>{activeDetails.perfusion}</p>
          </div>

          <div className="detail-section">
            <span className="sec-label">CLINICAL SIGNIFICANCE</span>
            <p>{activeDetails.clinical_note}</p>
          </div>

          <div className="detail-section">
            <span className="sec-label">MAJOR VISIBLE BRANCHES</span>
            <div className="branch-tags-list">
              {activeDetails.branches?.map((b, i) => (
                <span key={i} className="branch-tag">{b}</span>
              ))}
            </div>
          </div>

          {/* Direct Bridge to 3D Artery Interior Workstation */}
          {(selectedArtery === "LAD" || selectedArtery === "LCX" || selectedArtery === "RCA") && onNavigateToArteryInterior && (
            <button
              className="open-interior-btn"
              onClick={onNavigateToArteryInterior}
              title="Open full 3D longitudinal cutaway and cross-section viewer"
            >
              <Scissors size={14} />
              <span>Inspect Artery Interior (3D Cutaway)</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
