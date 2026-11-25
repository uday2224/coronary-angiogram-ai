import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Crosshair,
  Layers,
} from "lucide-react";

export default function CrossSectionInspector({
  analysisResult,
  geometryData,
  selectedLesionId,
  onSelectLesion,
}) {
  const [selectedSlice, setSelectedSlice] = useState("mla"); // 'proximal', 'mla', 'distal'
  const [showProvenance, setShowProvenance] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false); // compare all lesion MLAs

  const proxCanvasRef = useRef(null);
  const mlaCanvasRef = useRef(null);
  const distCanvasRef = useRef(null);

  const geom = geometryData || analysisResult?.geometry;
  const hasAnalysis = Boolean(analysisResult && geom);
  const hasStenosis = Boolean(
    geom?.has_stenosis ?? (analysisResult?.prediction === "POSITIVE" && (analysisResult?.stenosis_pixels || 0) > 0)
  );

  const arteryName = geom?.artery_name || analysisResult?.localization?.artery || "Coronary Artery";
  const arteryCode = geom?.artery_code || analysisResult?.localization?.artery_code || "COR";
  const metrics = geom?.quantitative_metrics;
  const samples = geom?.samples || [];
  const calib = geom?.calibration_metadata;
  const pixelMetrics = geom?.pixel_measurements;

  // Multi-lesion collection
  const lesions = useMemo(() => {
    return analysisResult?.lesions || analysisResult?.localization?.lesions || analysisResult?.localization?.lesion_components || geom?.lesions || [];
  }, [analysisResult, geom]);

  const mappedLesions = useMemo(() => {
    return lesions.filter((l) => l.cross_sections != null || l.heart_3d_coordinates != null);
  }, [lesions]);

  // Active lesion state
  const [internalLesionId, setInternalLesionId] = useState(null);
  const activeLesionId = selectedLesionId || internalLesionId || (mappedLesions[0]?.lesion_id || lesions[0]?.lesion_id || "L1");
  const activeLesion = lesions.find((l) => l.lesion_id === activeLesionId) || mappedLesions[0] || lesions[0] || null;

  // Active lesion's cross section slices
  const activeCrossSections = useMemo(() => {
    if (activeLesion?.cross_sections) return activeLesion.cross_sections;
    return geom?.cross_sections;
  }, [activeLesion, geom]);

  // Active lesion's quantitative metrics
  const activeMetrics = useMemo(() => {
    if (activeLesion?.quantitative_metrics) return activeLesion.quantitative_metrics;
    return metrics;
  }, [activeLesion, metrics]);

  // Compute dynamic slices data based on real geometry
  const slicesData = useMemo(() => {
    if (!geom || !activeCrossSections) return null;

    const prox = activeCrossSections.proximal_reference;
    const mla = activeCrossSections.minimal_lumen_area;
    const dist = activeCrossSections.distal_reference;

    if (!prox || !mla || !dist) return null;

    const isLesionMapped = activeLesion?.artery_assignment_status !== "Unmapped";

    return {
      proximal: {
        title: prox.label || "Proximal Reference Slice",
        distance_mm: `${prox.distance_mm.toFixed(1)} mm`,
        outer_diam_mm: prox.outer_diameter_mm.toFixed(2),
        lumen_diam_mm: prox.lumen_diameter_mm.toFixed(2),
        vessel_area_mm2: (Math.PI * Math.pow(prox.outer_diameter_mm / 2, 2)).toFixed(2),
        lumen_area_mm2: prox.lumen_area_mm2.toFixed(2),
        plaque_burden: prox.plaque_burden || "Not available without IVUS/OCT",
        status: prox.status || "Patent Lumen",
        color: "#2ed573",
        rOuter: 54,
        rLumen: hasStenosis ? 48 : 50,
        eccentricity: 0.02,
      },
      mla: {
        title: hasStenosis && isLesionMapped ? `${activeLesion?.lesion_id || "MLA"} Minimal Lumen Area` : "Mid Segment (Patent Lumen)",
        distance_mm: `${mla.distance_mm.toFixed(1)} mm`,
        outer_diam_mm: mla.outer_diameter_mm.toFixed(2),
        lumen_diam_mm: mla.lumen_diameter_mm.toFixed(2),
        vessel_area_mm2: (Math.PI * Math.pow(mla.outer_diameter_mm / 2, 2)).toFixed(2),
        lumen_area_mm2: mla.lumen_area_mm2.toFixed(2),
        plaque_burden: mla.plaque_burden || "Not available without IVUS/OCT",
        status: mla.status || (hasStenosis ? "Stenosis Site" : "Patent Lumen"),
        color: hasStenosis ? "#ff4757" : "#2ed573",
        rOuter: 54,
        rLumen: hasStenosis ? Math.max(16, Math.round(54 * (mla.lumen_diameter_mm / mla.outer_diameter_mm))) : 50,
        eccentricity: hasStenosis ? 0.38 : 0.02,
      },
      distal: {
        title: dist.label || "Distal Reference Slice",
        distance_mm: `${dist.distance_mm.toFixed(1)} mm`,
        outer_diam_mm: dist.outer_diameter_mm.toFixed(2),
        lumen_diam_mm: dist.lumen_diameter_mm.toFixed(2),
        vessel_area_mm2: (Math.PI * Math.pow(dist.outer_diameter_mm / 2, 2)).toFixed(2),
        lumen_area_mm2: dist.lumen_area_mm2.toFixed(2),
        plaque_burden: dist.plaque_burden || "Not available without IVUS/OCT",
        status: dist.status || "Patent Distal Runoff",
        color: "#2ed573",
        rOuter: 54,
        rLumen: hasStenosis ? 48 : 50,
        eccentricity: 0.02,
      },
    };
  }, [geom, activeCrossSections, hasStenosis, activeLesion]);

  // Helper to draw cross-section on HTML5 canvas
  const drawCrossSection = (canvas, data) => {
    if (!canvas || !data) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Grid background
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 1. Vessel Outer Wall (Adventitia / Media)
    ctx.beginPath();
    ctx.arc(cx, cy, data.rOuter, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 2. Atherosclerotic Plaque (Render only if genuine narrowing detected)
    const plaqueWidth = data.rOuter - data.rLumen;
    if (hasStenosis && plaqueWidth > 6) {
      ctx.beginPath();
      ctx.arc(cx, cy, data.rOuter - 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(217, 119, 6, 0.85)";
      ctx.fill();
    }

    // 3. Patent Lumen (Residual blood channel)
    const lumenOffsetX = cx + (hasStenosis ? data.rOuter * data.eccentricity : 0);
    const lumenOffsetY = cy + (hasStenosis ? data.rOuter * (data.eccentricity * 0.4) : 0);

    ctx.beginPath();
    ctx.arc(lumenOffsetX, lumenOffsetY, data.rLumen, 0, Math.PI * 2);
    ctx.fillStyle = hasStenosis && plaqueWidth > 6 ? "#991b1b" : "#b91c1c";
    ctx.fill();
    ctx.strokeStyle = hasStenosis && plaqueWidth > 6 ? "#ef4444" : "#f87171";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center crosshair
    ctx.strokeStyle = "rgba(0, 210, 211, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    // Caliper ruler line across lumen
    ctx.strokeStyle = "#00d2d3";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lumenOffsetX - data.rLumen, lumenOffsetY);
    ctx.lineTo(lumenOffsetX + data.rLumen, lumenOffsetY);
    ctx.stroke();

    // Ruler ticks
    ctx.beginPath();
    ctx.moveTo(lumenOffsetX - data.rLumen, lumenOffsetY - 4);
    ctx.lineTo(lumenOffsetX - data.rLumen, lumenOffsetY + 4);
    ctx.moveTo(lumenOffsetX + data.rLumen, lumenOffsetY - 4);
    ctx.lineTo(lumenOffsetX + data.rLumen, lumenOffsetY + 4);
    ctx.stroke();
  };

  useEffect(() => {
    if (slicesData) {
      drawCrossSection(proxCanvasRef.current, slicesData.proximal);
      drawCrossSection(mlaCanvasRef.current, slicesData.mla);
      drawCrossSection(distCanvasRef.current, slicesData.distal);
    }
  }, [slicesData]);

  // If no analysis has been run yet
  if (!hasAnalysis) {
    return (
      <div className="cross-section-inspector-container empty-state">
        <div className="empty-panel">
          <FileQuestion size={48} className="text-muted" />
          <h3>No Angiogram Analyzed Yet</h3>
          <p>
            Please select and analyze a coronary fluoroscopic angiogram in the <b>Angiogram Workstation</b> tab.
            The cross-sectional caliber and lumen measurements will be dynamically computed from your uploaded image.
          </p>
        </div>
      </div>
    );
  }

  // Calculate dynamic SVG path for longitudinal caliber
  // SVG viewport: 500 wide, 160 tall.
  // x: 40 to 480 (range 440). y: 25 to 135 (range 110).
  const maxDiameter = Math.max(...samples.map((s) => s.outer_radius_mm * 2), 4.0);
  const minDiameter = 0.0;

  const points = samples.map((s) => {
    const x = 40 + (s.distance_mm / 80.0) * 440;
    const diam = s.lumen_radius_mm * 2;
    // Map diameter to y (higher diameter -> lower y)
    const normDiam = Math.max(0, Math.min(1, (diam - minDiameter) / (maxDiameter - minDiameter)));
    const y = 135 - normDiam * 105;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, diam, s };
  });

  const pathD = points.length > 0
    ? `M ${points[0].x},${points[0].y} ` + points.slice(1).map((p) => `L ${p.x},${p.y}`).join(" ")
    : "";

  // Stenosis lesion bounding zone in SVG coords
  const lesionPoints = points.filter((p) => p.s.is_stenosis_zone);
  const lesionBox = lesionPoints.length > 1 ? {
    x1: lesionPoints[0].x,
    x2: lesionPoints[lesionPoints.length - 1].x,
    width: lesionPoints[lesionPoints.length - 1].x - lesionPoints[0].x,
  } : null;

  // Find exact MLA point
  const mlaPoint = points.reduce((minP, p) => (p.diam < minP.diam ? p : minP), points[0] || { x: 260, y: 70, diam: 0 });

  return (
    <div className="cross-section-inspector-container">
      {/* Top Header Bar */}
      <div className="cs-header-bar">
        <div>
          <h2>Coronary Vessel Cross-Section & Caliber Analysis</h2>
          <p>
            Image-derived quantitative multi-slice lumen reconstruction. Grounded strictly in segmented angiogram geometry.
          </p>
        </div>
        <div className="cs-artery-badge">
          <span className="badge-lbl">TARGET ARTERY</span>
          <span className="badge-name font-mono">{activeLesion?.artery_name || arteryName} ({activeLesion?.artery_code || arteryCode})</span>
        </div>
      </div>

      {/* Multi-Lesion Selector Toolbar */}
      {hasStenosis && lesions.length > 0 && (
        <div className="cs-lesion-selection-toolbar">
          <div className="toolbar-left">
            <span className="tb-label font-mono">
              <Crosshair size={12} className="text-danger" />
              INSPECT LESION:
            </span>
            <div className="tb-chips">
              {lesions.map((l) => {
                const isAct = l.lesion_id === activeLesionId;
                const isMapped = l.artery_assignment_status !== "Unmapped" && (l.cross_sections != null || l.heart_3d_coordinates != null);
                return (
                  <button
                    key={l.lesion_id}
                    className={`cs-lesion-tab ${isAct ? "active" : ""} ${isMapped ? "mapped" : "unmapped"}`}
                    onClick={() => {
                      setInternalLesionId(l.lesion_id);
                      if (onSelectLesion) onSelectLesion(l.lesion_id);
                    }}
                  >
                    <strong>{l.lesion_id}</strong>
                    <span>{l.vessel_position || l.segment || l.artery_code}</span>
                    {l.diameter_stenosis != null && <b className="font-mono">{l.diameter_stenosis}%</b>}
                    {!isMapped && <small className="unmapped-tag">2D Only</small>}
                  </button>
                );
              })}
            </div>
          </div>
          {mappedLesions.length > 1 && (
            <div className="toolbar-right">
              <button
                className={`compare-btn ${comparisonMode ? "active" : ""}`}
                onClick={() => setComparisonMode(!comparisonMode)}
                title="Compare all detected lesion cross-sections side-by-side"
              >
                <Sparkles size={12} />
                <span>{comparisonMode ? "Standard 3-Slice View" : `Compare All Lesions (${mappedLesions.length})`}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Unmapped Lesion Disclaimer if currently selected */}
      {activeLesion && activeLesion.artery_assignment_status === "Unmapped" && (
        <div className="unmapped-lesion-notice">
          <Info size={16} className="text-warning" />
          <div>
            <b>Cross-Section Reconstruction Unavailable for {activeLesion.lesion_id}</b>
            <p>
              This detected component is an unmapped 2D projection fragment without validated 3D centerline or coronary anchor. 
              Cross-sectional lumen profiles are suppressed to avoid clinical fabrication. Full 2D measurements remain available in the Workstation and Case Report.
            </p>
          </div>
        </div>
      )}

      {/* Negative Case Notice Banner */}
      {!hasStenosis && (
        <div className="negative-stenosis-banner">
          <CheckCircle2 size={18} className="text-success" />
          <div className="neg-text">
            <b>No Stenosis Detected by Segmentation Model</b>
            <span>
              The segmented vessel caliber is uniform and patent across all cross-sections.
              <em> (This research result does not independently establish that the artery is clinically normal.)</em>
            </span>
          </div>
        </div>
      )}

      {/* Main 3-Slice Side-by-Side Comparison Grid */}
      {slicesData && (
        <div className="cs-slices-grid">
          {/* Slice 1: Proximal */}
          <div
            className={`cs-slice-card ${selectedSlice === "proximal" ? "selected" : ""}`}
            onClick={() => setSelectedSlice("proximal")}
          >
            <div className="slice-card-top">
              <span className="slice-tag normal">PROXIMAL REFERENCE</span>
              <span className="slice-dist font-mono">{slicesData.proximal.distance_mm}</span>
            </div>
            <div className="canvas-wrapper">
              <canvas ref={proxCanvasRef} width={180} height={180} />
              <div className="canvas-callout font-mono">D: {slicesData.proximal.lumen_diam_mm} mm</div>
            </div>
            <div className="slice-stats">
              <div className="stat-line">
                <span>Lumen Area:</span>
                <b className="font-mono">{slicesData.proximal.lumen_area_mm2} mm²</b>
              </div>
              <div className="stat-line">
                <span>Vessel Area:</span>
                <b className="font-mono">{slicesData.proximal.vessel_area_mm2} mm²</b>
              </div>
              <div className="stat-line">
                <span>Plaque Burden:</span>
                <b className="font-mono text-muted" title="Requires IVUS or OCT">Not available (IVUS/OCT)</b>
              </div>
            </div>
          </div>

          {/* Slice 2: MLA or Mid Segment */}
          <div
            className={`cs-slice-card ${hasStenosis ? "mla" : "normal"} ${selectedSlice === "mla" ? "selected" : ""}`}
            onClick={() => setSelectedSlice("mla")}
          >
            <div className="slice-card-top">
              <span className={`slice-tag ${hasStenosis ? "lesion" : "normal"}`}>
                {hasStenosis ? "MINIMAL LUMEN AREA (MLA)" : "MID SEGMENT (PATENT)"}
              </span>
              <span className="slice-dist font-mono">{slicesData.mla.distance_mm}</span>
            </div>
            <div className="canvas-wrapper">
              <canvas ref={mlaCanvasRef} width={180} height={180} />
              <div className={`canvas-callout font-mono ${hasStenosis ? "danger" : ""}`}>
                {hasStenosis ? "MLA" : "Mid D"}: {slicesData.mla.lumen_diam_mm} mm
              </div>
            </div>
            <div className="slice-stats">
              <div className="stat-line">
                <span>Lumen Area:</span>
                <b className={`font-mono ${hasStenosis ? "text-danger" : ""}`}>{slicesData.mla.lumen_area_mm2} mm²</b>
              </div>
              <div className="stat-line">
                <span>Diameter Reduction:</span>
                <b className={`font-mono ${hasStenosis ? "text-danger" : "text-success"}`}>
                  {hasStenosis ? `${metrics?.percent_diameter_stenosis || 0}%` : "0.0%"}
                </b>
              </div>
              <div className="stat-line">
                <span>Plaque Burden:</span>
                <b className="font-mono text-muted" title="Requires IVUS or OCT">Not available (IVUS/OCT)</b>
              </div>
            </div>
          </div>

          {/* Slice 3: Distal */}
          <div
            className={`cs-slice-card ${selectedSlice === "distal" ? "selected" : ""}`}
            onClick={() => setSelectedSlice("distal")}
          >
            <div className="slice-card-top">
              <span className="slice-tag distal">DISTAL REFERENCE</span>
              <span className="slice-dist font-mono">{slicesData.distal.distance_mm}</span>
            </div>
            <div className="canvas-wrapper">
              <canvas ref={distCanvasRef} width={180} height={180} />
              <div className="canvas-callout font-mono">D: {slicesData.distal.lumen_diam_mm} mm</div>
            </div>
            <div className="slice-stats">
              <div className="stat-line">
                <span>Lumen Area:</span>
                <b className="font-mono">{slicesData.distal.lumen_area_mm2} mm²</b>
              </div>
              <div className="stat-line">
                <span>Vessel Area:</span>
                <b className="font-mono">{slicesData.distal.vessel_area_mm2} mm²</b>
              </div>
              <div className="stat-line">
                <span>Plaque Burden:</span>
                <b className="font-mono text-muted" title="Requires IVUS or OCT">Not available (IVUS/OCT)</b>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anatomical Color Legend Bar */}
      <div className="cs-legend-bar">
        <div className="legend-item">
          <span className="leg-box wall" />
          <span>Vessel Wall (Adventitia / Media)</span>
        </div>
        {hasStenosis && (
          <div className="legend-item">
            <span className="leg-box plaque" />
            <span>Atherosclerotic Plaque (Intima)</span>
          </div>
        )}
        <div className="legend-item">
          <span className="leg-box lumen" />
          <span>Patent Blood Lumen (Channel)</span>
        </div>
        <div className="legend-item">
          <span className="leg-box caliper" />
          <span>Calibrated Caliper Ruler (mm)</span>
        </div>
      </div>

      {/* Quantitative Analysis & Longitudinal Profile Section */}
      <div className="cs-bottom-grid">
        {/* Left: Quantitative QCA Clinical Parameters */}
        <div className="cs-qca-panel">
          <div className="panel-title-row">
            <Activity size={16} className="text-accent" />
            <h3>Quantitative Caliber Metrics (Image-Derived)</h3>
          </div>

          <div className="qca-table">
            <div className="qca-row">
              <span className="param-name">Reference Vessel Diameter (RVD)</span>
              <span className="param-val font-mono">
                {metrics ? `${metrics.reference_diameter_mm.toFixed(2)} mm` : "N/A"}
              </span>
            </div>
            <div className={`qca-row ${hasStenosis ? "highlight-danger" : ""}`}>
              <span className="param-name">Minimal Lumen Diameter (MLD)</span>
              <span className="param-val font-mono">
                {metrics ? `${metrics.minimal_lumen_diameter_mm.toFixed(2)} mm` : "N/A"}
              </span>
            </div>
            <div className={`qca-row ${hasStenosis ? "highlight-danger" : ""}`}>
              <span className="param-name">Minimal Lumen Area (MLA)</span>
              <span className="param-val font-mono">
                {metrics ? `${metrics.minimal_lumen_area_mm2.toFixed(2)} mm²` : "N/A"}
              </span>
            </div>
            <div className={`qca-row ${hasStenosis ? "highlight-warning" : ""}`}>
              <span className="param-name">Diameter Stenosis (%DS)</span>
              <span className="param-val font-mono">
                {metrics ? `${metrics.percent_diameter_stenosis.toFixed(1)}%` : "0.0%"}
              </span>
            </div>
            <div className={`qca-row ${hasStenosis ? "highlight-warning" : ""}`}>
              <span className="param-name">Area Stenosis (%AS)</span>
              <span className="param-val font-mono">
                {metrics ? `${metrics.percent_area_stenosis.toFixed(1)}%` : "0.0%"}
              </span>
            </div>
            <div className="qca-row">
              <span className="param-name">Lesion Length</span>
              <span className="param-val font-mono">
                {hasStenosis && metrics?.lesion_length_mm ? `${metrics.lesion_length_mm.toFixed(1)} mm` : "0.0 mm (None)"}
              </span>
            </div>
            <div className="qca-row">
              <span className="param-name">AHA/ACC Classification</span>
              <span className="param-val font-mono text-muted" title="Requires multi-angle angiogram">
                {hasStenosis ? "Not available — insufficient morphological criteria" : "Not applicable"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Longitudinal Lumen Diameter Profile Chart (SVG) */}
        <div className="cs-profile-panel">
          <div className="panel-title-row">
            <TrendingDown size={16} className={hasStenosis ? "text-warning" : "text-success"} />
            <h3>Longitudinal Lumen Caliber Profile (0 – 80 mm)</h3>
          </div>

          <div className="profile-chart-wrapper">
            <svg viewBox="0 0 500 160" className="longitudinal-svg">
              {/* Grid Lines */}
              <line x1="40" y1="30" x2="480" y2="30" stroke="#1d334e" strokeDasharray="3 3" />
              <line x1="40" y1="65" x2="480" y2="65" stroke="#1d334e" strokeDasharray="3 3" />
              <line x1="40" y1="100" x2="480" y2="100" stroke="#1d334e" strokeDasharray="3 3" />
              <line x1="40" y1="135" x2="480" y2="135" stroke="#243e5e" />

              {/* RVD Ceiling Reference Line */}
              {metrics && (
                <>
                  <line
                    x1="40"
                    y1={135 - Math.min(1, metrics.reference_diameter_mm / maxDiameter) * 105}
                    x2="480"
                    y2={135 - Math.min(1, metrics.reference_diameter_mm / maxDiameter) * 105}
                    stroke="#2ed573"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x="44"
                    y={Math.max(20, 130 - Math.min(1, metrics.reference_diameter_mm / maxDiameter) * 105)}
                    fill="#2ed573"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    RVD ({metrics.reference_diameter_mm.toFixed(2)} mm)
                  </text>
                </>
              )}

              {/* Lesion Shaded Zone (Only if stenosis is detected) */}
              {hasStenosis && lesionBox && (
                <>
                  <rect
                    x={lesionBox.x1}
                    y="25"
                    width={lesionBox.width}
                    height="110"
                    fill="rgba(255, 71, 87, 0.12)"
                    rx="4"
                  />
                  <text
                    x={lesionBox.x1 + 6}
                    y="36"
                    fill="#ff4757"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    LESION ZONE
                  </text>
                </>
              )}

              {/* Dynamic Lumen Diameter Polyline */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={hasStenosis ? "#00d2d3" : "#2ed573"}
                  strokeWidth="2.5"
                />
              )}

              {/* MLA Marker Point (Only if stenosis is detected) */}
              {hasStenosis && mlaPoint && (
                <>
                  <circle cx={mlaPoint.x} cy={mlaPoint.y} r="5" fill="#ff4757" stroke="#fff" strokeWidth="1.5" />
                  <text
                    x={Math.max(40, Math.min(410, mlaPoint.x - 25))}
                    y={Math.min(150, mlaPoint.y + 16)}
                    fill="#ff4757"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    MLD: {metrics?.minimal_lumen_diameter_mm.toFixed(2)} mm
                  </text>
                </>
              )}

              {/* Y-Axis Caliber Labels */}
              <text x="10" y="34" fill="#6f87a3" fontSize="8" fontFamily="monospace">{maxDiameter.toFixed(1)} mm</text>
              <text x="10" y="85" fill="#6f87a3" fontSize="8" fontFamily="monospace">{(maxDiameter / 2).toFixed(1)} mm</text>
              <text x="10" y="135" fill="#6f87a3" fontSize="8" fontFamily="monospace">0.0 mm</text>

              {/* X-Axis Caliber Labels */}
              <text x="40" y="152" fill="#6f87a3" fontSize="8" fontFamily="monospace">0 mm (Ostium)</text>
              <text x="230" y="152" fill="#6f87a3" fontSize="8" fontFamily="monospace">40 mm (Mid)</text>
              <text x="430" y="152" fill="#6f87a3" fontSize="8" fontFamily="monospace">80 mm (Distal)</text>
            </svg>
          </div>
        </div>
      </div>

      {/* Expandable Data Provenance Section ("How was this calculated?") */}
      <div className="cs-provenance-container">
        <button
          className="provenance-toggle-btn"
          onClick={() => setShowProvenance(!showProvenance)}
          aria-expanded={showProvenance}
        >
          <div className="toggle-left">
            <Info size={15} className="text-accent" />
            <span>Data Provenance & Scientific Methodology ("How was this calculated?")</span>
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
                <span className="prov-lbl">Source Image Mask</span>
                <span className="prov-val font-mono">
                  {analysisResult?.stenosis_pixels
                    ? `${analysisResult.stenosis_pixels.toLocaleString()} lesion px / ${analysisResult.vessel_pixels?.toLocaleString()} vessel px`
                    : "0 positive lesion pixels (Patent vessel)"}
                </span>
              </div>
              <div className="prov-item">
                <span className="prov-lbl">Calibration Status</span>
                <span className="prov-val badge-uncalibrated">
                  {calib?.calibration_status || "Calculated from model-derived geometry"}
                </span>
              </div>
              <div className="prov-item">
                <span className="prov-lbl">Pixel Spacing Scaling</span>
                <span className="prov-val font-mono">
                  {calib?.calibration_source || "0.20 mm/px (Research Standard Scaling)"}
                </span>
              </div>
            </div>

            <div className="prov-formulas">
              <h4>Quantitative Formulation & Limitations</h4>
              <ul>
                <li>
                  <strong>Diameter Stenosis (%DS):</strong> <code>%DS = ((RVD - MLD) / RVD) × 100%</code>, where RVD is the mean caliber of proximal and distal unstenosed reference segments.
                </li>
                <li>
                  <strong>Area Stenosis (%AS):</strong> <code>%AS = ((Ref_Area - MLA) / Ref_Area) × 100%</code>.
                </li>
                <li>
                  <strong>Physical Calibration:</strong> Absolute physical millimeter measurements require catheter scaling (e.g., 5F/6F catheter tip reference) or DICOM pixel spacing metadata. Values displayed are research estimates calibrated at 0.20 mm/pixel.
                </li>
                <li>
                  <strong>Plaque Morphology & AHA/ACC:</strong> Single-plane 2D projection angiograms cannot resolve circumferential plaque composition without intravascular ultrasound (IVUS) or optical coherence tomography (OCT).
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
