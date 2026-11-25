import { useState, useEffect, useRef, Component } from "react";
import {
  Activity,
  Heart,
  Layers,
  BarChart3,
  FileText,
  UploadCloud,
  ScanLine,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Wifi,
  WifiOff,
  Crosshair,
  ShieldAlert,
  ChevronRight,
  Maximize2,
  Scissors,
  Zap,
  Disc,
} from "lucide-react";

import FDABanner from "./components/FDABanner";
import VirtualHeart3D from "./components/VirtualHeart3D";
import AngiogramViewer from "./components/AngiogramViewer";
import ArteryInterior3D from "./components/ArteryInterior3D";
import CrossSectionInspector from "./components/CrossSectionInspector";
import BloodFlowViewer from "./components/BloodFlowViewer";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import ResearchReport from "./components/ResearchReport";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "3rem", textAlign: "center", color: "#f87171", background: "rgba(239,68,68,0.06)", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.2)", margin: "2rem auto", maxWidth: "600px" }}>
          <AlertCircle size={36} style={{ margin: "0 auto 1rem", display: "block" }} />
          <h3 style={{ fontSize: "1.15rem", marginBottom: "0.5rem", color: "#fca5a5" }}>Component Error</h3>
          <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginBottom: "1.5rem" }}>{this.state.error?.message || "An unexpected error occurred in this view."}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: "0.5rem 1.2rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
          >
            Retry View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const API = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const MAX_FILE_SIZE_MB = 12;
const ALLOWED_TYPES = ["image/png", "image/jpeg"];

export default function App() {
  const [activeTab, setActiveTab] = useState("workstation"); // 'workstation', '3d_heart', '3d_artery', 'cross_section', 'blood_flow', 'analytics', 'report'
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const [activeArteryHighlight, setActiveArteryHighlight] = useState("LAD");
  const [selectedLesionId, setSelectedLesionId] = useState(null);

  // Health check on mount
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const r = await fetch(`${API}/api/health`);
        const d = await r.json();
        if (!cancelled) setHealth(d);
      } catch {
        if (!cancelled) setHealth({ success: false, model_loaded: false, message: "Backend unreachable" });
      }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  function chooseFile(f) {
    if (!f) return;
    setError("");
    setResult(null);

    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Please select a PNG or JPEG image.");
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
      return;
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setSelectedLesionId(null);
    setError("");
    setActiveArteryHighlight("LAD");
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setResult(null);
    setSelectedLesionId(null);
    setError("");
    setActiveArteryHighlight("LAD");
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSelectedLesionId(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API}/api/analyze`, { method: "POST", body: fd });
      const d = await r.json();

      if (!r.ok || !d.success) {
        throw new Error(d.message || `Analysis failed (HTTP ${r.status})`);
      }

      setResult(d.results);
      if (d.results?.primary_lesion_id) {
        setSelectedLesionId(d.results.primary_lesion_id);
      } else if (d.results?.lesions?.length > 0) {
        setSelectedLesionId(d.results.lesions[0].lesion_id);
      }
      if (d.results?.localization?.artery_code) {
        setActiveArteryHighlight(d.results.localization.artery_code);
      }
    } catch (e) {
      if (e.name === "TypeError" && e.message.includes("fetch")) {
        setError("Cannot connect to backend. Is the Flask server running?");
      } else {
        setError(e.message || "Analysis failed. Check backend status.");
      }
    } finally {
      setLoading(false);
    }
  }

  const modelReady = health?.model_loaded === true;
  const backendUp = health?.success === true;
  const isPositive = result?.prediction === "POSITIVE";
  const localization = result?.localization;

  // Handle selection from historical case log
  const handleSelectHistoricalCase = (historicalCase) => {
    setResult(historicalCase);
    if (historicalCase?.localization?.artery_code) {
      setActiveArteryHighlight(historicalCase.localization.artery_code);
    }
    setActiveTab("workstation");
  };

  return (
    <div className="app">
      {/* ═══ 1. Official FDA Regulatory Notice Banner ═══ */}
      <FDABanner />

      {/* ═══ 2. Medical Workstation Header ═══ */}
      <header className="main-header">
        <div className="brand">
          <Activity size={24} className="text-accent" />
          <div>
            <b>Coronary AI</b>
            <small>3D VIRTUAL HEART & ANGIOGRAM WORKSTATION</small>
          </div>
        </div>

        {/* Workstation Navigation Tabs */}
        <nav className="header-nav" role="tablist">
          <button
            role="tab"
            className={`nav-tab ${activeTab === "workstation" ? "active" : ""}`}
            onClick={() => setActiveTab("workstation")}
          >
            <Layers size={15} />
            <span>Angiogram Workstation</span>
          </button>
          <button
            role="tab"
            className={`nav-tab ${activeTab === "3d_heart" ? "active" : ""}`}
            onClick={() => setActiveTab("3d_heart")}
          >
            <Heart size={15} />
            <span>3D Virtual Heart</span>
            {isPositive && <span className="tab-alert-dot" title="Lesion located" />}
          </button>
          <button
            role="tab"
            className={`nav-tab ${activeTab === "3d_artery" ? "active" : ""}`}
            onClick={() => setActiveTab("3d_artery")}
          >
            <Scissors size={15} />
            <span>3D Artery Interior</span>
            {isPositive && <span className="tab-alert-dot" title="Stenosis Narrowing" />}
          </button>
          <button
            role="tab"
            className={`nav-tab ${activeTab === "cross_section" ? "active" : ""}`}
            onClick={() => setActiveTab("cross_section")}
          >
            <Disc size={15} />
            <span>Cross-Sections</span>
          </button>
          <button
            role="tab"
            className={`nav-tab ${activeTab === "blood_flow" ? "active" : ""}`}
            onClick={() => setActiveTab("blood_flow")}
          >
            <Zap size={15} />
            <span>Hemodynamics</span>
          </button>
          <button
            role="tab"
            className={`nav-tab ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            <BarChart3 size={15} />
            <span>AI Analytics</span>
          </button>
          <button
            role="tab"
            className={`nav-tab ${activeTab === "report" ? "active" : ""}`}
            onClick={() => setActiveTab("report")}
          >
            <FileText size={15} />
            <span>Case Report</span>
          </button>
        </nav>

        {/* Backend & Model Readiness Status */}
        <div className="header-status">
          <span className={`health-badge ${modelReady ? "ready" : backendUp ? "warn" : "off"}`}>
            {backendUp ? <Wifi size={12} /> : <WifiOff size={12} />}
            {modelReady ? "Pipeline Ready" : backendUp ? "Pipeline Incomplete" : "Backend Offline"}
          </span>
        </div>
      </header>

      {/* ═══ 3. Active Viewport Container ═══ */}
      <main className="main-viewport">
        <ErrorBoundary key={activeTab}>
        {/* TAB 1: WORKSTATION (Input + Angiogram Viewer + Side 3D Preview) */}
        {activeTab === "workstation" && (
          <div className="workstation-layout">
            {/* Left Column: Image Input & Findings Summary */}
            <div className="input-sidebar">
              <section className="panel">
                <h2>01 · Angiogram Input</h2>
                <p>Select a coronary fluoroscopic angiogram (PNG/JPEG)</p>

                {/* Drop Zone */}
                <label
                  className={`drop ${file ? "has-file" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) chooseFile(dropped);
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => chooseFile(e.target.files?.[0])}
                  />
                  <UploadCloud size={28} />
                  <b>Drop angiogram here or browse</b>
                  <small>PNG / JPG · Max {MAX_FILE_SIZE_MB} MB</small>
                </label>

                {/* Selected File Badge */}
                {file && (
                  <div className="filename">
                    <ImageIcon size={15} />
                    <span className="filename-text">{file.name}</span>
                    <button onClick={clearFile} title="Remove">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Run Button */}
                <button
                  className="primary"
                  disabled={!file || loading || (!modelReady && backendUp)}
                  onClick={analyze}
                >
                  {loading ? (
                    <>
                      <Loader2 className="spin" size={17} />
                      Running Multi-Model Pipeline…
                    </>
                  ) : (
                    <>
                      <ScanLine size={17} />
                      Run Integrated Analysis
                    </>
                  )}
                </button>

                {/* Error */}
                {error && (
                  <div className="error" role="alert">
                    <AlertCircle size={14} />
                    <span>{error}</span>
                  </div>
                )}

                {/* AI Classification Summary Card */}
                {result && (
                  <div className={`prediction-card ${isPositive ? "positive" : "negative"}`}>
                    <div className="prediction-header">
                      <span className="prediction-label">AI CLASSIFICATION OUTCOME</span>
                      <span className="prediction-conf">
                        {(result.confidence * 100).toFixed(1)}% Confidence
                      </span>
                    </div>
                    <div className="prediction-title">{result.prediction_name}</div>

                    <div className="prediction-metrics">
                      <div className="p-metric">
                        <span className="pm-label">Artery Target</span>
                        <span className="pm-val">{localization?.artery_code || "LAD"}</span>
                      </div>
                      <div className="p-metric">
                        <span className="pm-label">Vessels Area</span>
                        <span className="pm-val">{result.vessel_pixels?.toLocaleString()} px</span>
                      </div>
                      <div className="p-metric">
                        <span className="pm-label">Lesion Area</span>
                        <span className="pm-val">{result.stenosis_pixels?.toLocaleString()} px</span>
                      </div>
                    </div>

                    <div className="quick-3d-hint">
                      <Crosshair size={13} className="text-accent" />
                      <span>Mapped to <strong>{localization?.segment || "Proximal"} {localization?.artery_code}</strong> on 3D Heart.</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Mini 3D Heart Reference Card */}
              <section className="panel mini-heart-panel">
                <div className="panel-header-mini">
                  <div className="title-row">
                    <Heart size={14} className="text-accent" />
                    <b>3D Heart Anatomical Reference</b>
                  </div>
                  <button className="expand-tab-btn" onClick={() => setActiveTab("3d_heart")}>
                    <span>Full 3D View</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
                <div className="mini-heart-wrapper">
                  <VirtualHeart3D
                    analysisResult={result}
                    activeSelectedArtery={activeArteryHighlight}
                    onSelectArteryFromHeart={(code) => setActiveArteryHighlight(code)}
                    onNavigateToArteryInterior={() => setActiveTab("3d_artery")}
                    selectedLesionId={selectedLesionId}
                    onSelectLesion={(id) => setSelectedLesionId(id)}
                  />
                </div>
              </section>
            </div>

            {/* Right Column: Full Interactive Angiogram Workstation */}
            <div className="viewer-column">
              <AngiogramViewer
                apiBase={API}
                result={result}
                preview={preview}
                selectedLesionId={selectedLesionId}
                onSelectLesionComponent={(comp) => {
                  const lId = comp.lesion_id || `L${comp.id}`;
                  setSelectedLesionId(lId);
                  if (comp.artery_code) {
                    setActiveArteryHighlight(comp.artery_code);
                  } else if (localization?.artery_code) {
                    setActiveArteryHighlight(localization.artery_code);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 2: FULL 3D VIRTUAL HEART */}
        {activeTab === "3d_heart" && (
          <div className="full-3d-layout">
            <div className="view-intro-bar">
              <div>
                <h2>Interactive 3D Virtual Human Heart</h2>
                <p>360-degree anatomical exploration with coronary artery inspection and AI-detected lesion localization.</p>
              </div>
              {result && (
                <div className="active-case-tag">
                  <span>Active Case: <strong>{result.analysis_id}</strong></span>
                  <span className={`tag-status ${isPositive ? "pos" : "neg"}`}>{result.prediction_name}</span>
                </div>
              )}
            </div>
            <div className="full-3d-stage">
              <VirtualHeart3D
                analysisResult={result}
                activeSelectedArtery={activeArteryHighlight}
                onSelectArteryFromHeart={(code) => setActiveArteryHighlight(code)}
                onNavigateToArteryInterior={() => setActiveTab("3d_artery")}
                selectedLesionId={selectedLesionId}
                onSelectLesion={(id) => setSelectedLesionId(id)}
              />
            </div>
          </div>
        )}

        {/* TAB 3: 3D ARTERY INTERIOR RECONSTRUCTION (Signature Feature) */}
        {activeTab === "3d_artery" && (
          <div className="full-3d-layout">
            <ArteryInterior3D
              analysisResult={result}
              geometryData={result?.geometry}
              selectedLesionId={selectedLesionId}
              onSelectLesion={(id) => setSelectedLesionId(id)}
              selectedArtery={activeArteryHighlight}
              onSelectArtery={(code) => setActiveArteryHighlight(code)}
            />
          </div>
        )}

        {/* TAB 4: CROSS-SECTION MULTI-SLICE INSPECTION */}
        {activeTab === "cross_section" && (
          <div className="full-3d-layout">
            <CrossSectionInspector
              analysisResult={result}
              geometryData={result?.geometry}
              selectedLesionId={selectedLesionId}
              onSelectLesion={(id) => setSelectedLesionId(id)}
            />
          </div>
        )}

        {/* TAB 5: HEMODYNAMIC BLOOD-FLOW SIMULATION */}
        {activeTab === "blood_flow" && (
          <div className="full-3d-layout">
            <BloodFlowViewer
              analysisResult={result}
              geometryData={result?.geometry}
              selectedLesionId={selectedLesionId}
              onSelectLesion={(id) => setSelectedLesionId(id)}
            />
          </div>
        )}

        {/* TAB 6: AI ANALYTICS & BENCHMARK DASHBOARD */}
        {activeTab === "analytics" && (
          <AnalyticsDashboard
            apiBase={API}
            analysisResult={result}
            onSelectHistoricalCase={handleSelectHistoricalCase}
            selectedLesionId={selectedLesionId}
            onSelectLesion={(id) => setSelectedLesionId(id)}
          />
        )}

        {/* TAB 7: CASE REPORT & PDF EXPORT */}
        {activeTab === "report" && (
          <ResearchReport
            apiBase={API}
            result={result}
            selectedLesionId={selectedLesionId}
          />
        )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
