import React, { useState, useRef, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Columns,
  Maximize,
  Download,
  Layers,
  Sparkles,
  Eye,
  Sun,
  Contrast,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const VIEWS = [
  { key: "overlay_image", label: "Stenosis Overlay", short: "Overlay", desc: "Transparent red overlay highlighting lesions" },
  { key: "contour_image", label: "Stenosis Outline", short: "Outline", desc: "High-contrast red boundary tracing around lesions" },
  { key: "gradcam_image", label: "Grad-CAM Heatmap", short: "Grad-CAM", desc: "Deep feature activation heatmap pointing to lesion" },
  { key: "vessel_overlay", label: "Vessel Overlay", short: "Vessels", desc: "Cyan overlay showing segmented coronary arterial tree" },
  { key: "segmentation_mask", label: "Stenosis Mask", short: "Stenosis Mask", desc: "Binary mask of detected arterial stenosis" },
  { key: "vessel_mask", label: "Vessel Mask", short: "Vessel Mask", desc: "Binary mask of full coronary vasculature" },
  { key: "vessel_roi", label: "Vessel ROI Crop", short: "ROI", desc: "Vessel-focused region fed into classification network" },
  { key: "original_image", label: "Original Angiogram", short: "Original", desc: "Raw X-ray fluoroscopic angiography input" },
];

export default function AngiogramViewer({
  apiBase,
  result,
  preview,
  onSelectLesionComponent,
}) {
  const [activeView, setActiveView] = useState("overlay_image");
  const [compareMode, setCompareMode] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [inverted, setInverted] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [selectedLesionId, setSelectedLesionId] = useState(null);

  // Zoom and pan state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

  const resetImageFilters = () => {
    setBrightness(100);
    setContrast(100);
    setInverted(false);
  };

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setTransform((t) => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(t.scale * delta, 0.25), 6.0);
      return { ...t, scale: newScale };
    });
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    isPanningRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const activeSrc = result?.[activeView] ? apiBase + result[activeView] : preview;
  const originalSrc = result?.original_image ? apiBase + result.original_image : preview;

  const imageFilterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) ${inverted ? "invert(1)" : ""}`,
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
    transformOrigin: "center center",
    cursor: transform.scale > 1 ? "grab" : "default",
  };

  const handleDownload = () => {
    if (!activeSrc) return;
    const a = document.createElement("a");
    a.href = activeSrc;
    a.download = `${result?.analysis_id || "angiogram"}_${activeView}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const lesionComponents = result?.localization?.lesion_components || [];

  return (
    <div className="angiogram-workstation">
      {/* Top Workstation Control Bar */}
      <div className="workstation-toolbar">
        {/* Layer Tabs */}
        <div className="toolbar-tabs" role="tablist">
          {VIEWS.map(({ key, short, desc }) => (
            <button
              key={key}
              role="tab"
              className={`tool-tab ${activeView === key ? "active" : ""}`}
              onClick={() => { setActiveView(key); resetZoom(); }}
              title={desc}
              aria-selected={activeView === key}
            >
              <span>{short}</span>
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="toolbar-actions">
          {/* Zoom controls */}
          <button className="tool-icon-btn" onClick={() => setTransform(t => ({ ...t, scale: Math.min(t.scale * 1.25, 6) }))} title="Zoom In">
            <ZoomIn size={15} />
          </button>
          <button className="tool-icon-btn" onClick={() => setTransform(t => ({ ...t, scale: Math.max(t.scale * 0.8, 0.25) }))} title="Zoom Out">
            <ZoomOut size={15} />
          </button>
          <span className="scale-indicator">{Math.round(transform.scale * 100)}%</span>
          <button className="tool-icon-btn" onClick={resetZoom} title="Reset View & Scale">
            <RotateCcw size={15} />
          </button>

          <div className="tool-sep" />

          {/* Adjustments toggle */}
          <button
            className={`tool-icon-btn ${showAdjustments ? "active" : ""}`}
            onClick={() => setShowAdjustments(!showAdjustments)}
            title="Image Radiographic Adjustments"
          >
            <Sliders size={15} />
          </button>

          {/* Compare toggle */}
          <button
            className={`tool-icon-btn ${compareMode ? "active" : ""}`}
            onClick={() => setCompareMode(!compareMode)}
            title="Side-by-side Original Comparison"
          >
            <Columns size={15} />
          </button>

          {/* Download */}
          <button className="tool-icon-btn" onClick={handleDownload} title="Export Active View PNG">
            <Download size={15} />
          </button>

          {/* Fullscreen */}
          <button
            className="tool-icon-btn"
            onClick={() => { if (activeSrc) window.open(activeSrc, "_blank"); }}
            title="Open Image in Full Resolution"
          >
            <Maximize size={15} />
          </button>
        </div>
      </div>

      {/* Radiographic Adjustments Bar */}
      {showAdjustments && (
        <div className="adjustments-panel">
          <div className="adj-group">
            <Sun size={13} />
            <label>Brightness ({brightness}%)</label>
            <input
              type="range"
              min="50"
              max="180"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
            />
          </div>
          <div className="adj-group">
            <Contrast size={13} />
            <label>Contrast ({contrast}%)</label>
            <input
              type="range"
              min="50"
              max="200"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
            />
          </div>
          <div className="adj-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={inverted}
                onChange={(e) => setInverted(e.target.checked)}
              />
              <span>Invert Fluoroscopy</span>
            </label>
          </div>
          <button className="reset-adj-btn" onClick={resetImageFilters}>
            Reset Filters
          </button>
        </div>
      )}

      {/* Viewport Canvas */}
      <div className={`workstation-canvas ${compareMode && result ? "compare" : ""}`}>
        {compareMode && result ? (
          <>
            <div
              className="canvas-pane"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div className="pane-watermark">Original Angiogram</div>
              {originalSrc && (
                <img
                  src={originalSrc}
                  alt="Original angiogram"
                  style={imageFilterStyle}
                  draggable={false}
                />
              )}
            </div>
            <div className="canvas-divider" />
            <div
              className="canvas-pane"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div className="pane-watermark">
                {VIEWS.find(v => v.key === activeView)?.label || "Layer View"}
              </div>
              {activeSrc && (
                <img
                  src={activeSrc}
                  alt="Angiogram analysis view"
                  style={imageFilterStyle}
                  draggable={false}
                />
              )}
            </div>
          </>
        ) : (
          <div
            className="canvas-single"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {activeSrc ? (
              <img
                src={activeSrc}
                alt="Coronary angiogram visualization"
                style={imageFilterStyle}
                draggable={false}
              />
            ) : (
              <div className="canvas-empty">
                <Layers size={42} className="text-muted" />
                <b>No Angiogram Loaded</b>
                <span>Upload an angiogram frame in the panel above to begin analysis.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lesion Components Inspector Footer */}
      {result && lesionComponents.length > 0 && (
        <div className="lesion-inspector-strip">
          <div className="inspector-title">
            <CircleDot size={13} className="text-warning" />
            <span>Identified Lesions ({lesionComponents.length})</span>
          </div>
          <div className="lesion-chips">
            {lesionComponents.map((comp) => {
              const isSelected = selectedLesionId === comp.id;
              return (
                <button
                  key={comp.id}
                  className={`lesion-chip ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedLesionId(comp.id);
                    if (onSelectLesionComponent) onSelectLesionComponent(comp);
                  }}
                  title={`Bounding Box: [${comp.bbox.join(", ")}]`}
                >
                  <span className="chip-badge">#{comp.id}</span>
                  <span className="chip-area">{comp.area_px} px</span>
                  <span className="chip-pos">({comp.centroid[0]}, {comp.centroid[1]})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Negative Detection Footer (Zero Lesion Pixels) */}
      {result && lesionComponents.length === 0 && (
        <div className="lesion-inspector-strip clean">
          <div className="inspector-title">
            <CheckCircle2 size={13} className="text-success" />
            <span>No Stenosis Detected by Current Model</span>
          </div>
          <small className="text-muted">
            {result.negative_disclaimer || "No stenosis detected by the current model. (This result does not independently establish that the artery is clinically normal.)"}
          </small>
        </div>
      )}
    </div>
  );
}
