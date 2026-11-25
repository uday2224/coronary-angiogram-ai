# System Architecture — Coronary Angiogram AI Workstation

## 1. Overview
The **Coronary Angiogram AI Platform** is an advanced medical imaging workstation designed to provide deep learning segmentation, classification, explainability, 3D anatomical virtual heart localization, and 3D coronary artery interior cutaway reconstruction from 2D fluoroscopic coronary angiograms.

```
                                  [ Angiogram Input (PNG / JPEG) ]
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │    Stage 1: Vessel Segmentation       │
                             │        U-Net++ (ResNet34)             │
                             │         Input: 256x256x3              │
                             │       Validation Dice: 0.787          │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │ Stage 2: Vessel ROI Bounding Box      │
                             │        Candidate crop extraction      │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │ Stage 3: Stenosis Classification      │
                             │        EfficientNet-B0                │
                             │         Input: 224x224x3              │
                             │   ROC-AUC: 0.995 | F1: 0.968          │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │ Stage 4: Explainability (Grad-CAM)    │
                             │    Conv5 feature activation maps      │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │ Stage 5: Lesion Outline Segmentation  │
                             │          U-Net (ResNet34)             │
                             │       Validation Dice: 0.495          │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │ Stage 6: Geometry & QCA Analytics     │
                             │  Centerline extraction, lumen radius, │
                             │  plaque thickness, MLA & %AS          │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │ Stage 7: 3D Anatomical Mapping        │
                             │  Projection onto LAD / LCX / RCA      │
                             └───────────────────┬───────────────────┘
                                                 │
                     ┌───────────────────────────┴───────────────────────────┐
                     ▼                                                       ▼
        ┌─────────────────────────┐                             ┌─────────────────────────┐
        │  3D Virtual Human Heart │                             │ 3D Artery Interior      │
        │  Chamber/coronary tree  │                             │ 180° cutaway, lumen,    │
        │  pulsing lesion beacon  │                             │ plaque, travel slider   │
        └─────────────────────────┘                             └─────────────────────────┘
```

---

## 2. Model Specifications & Checkpoints

| Model Component | Architecture | Weights Checkpoint | Target Task | Input Shape | Primary Metric |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vessel Segmentation** | U-Net++ (ResNet34 Encoder) | `backend/models/unetplusplus_resnet34_arcade_model.pkl` | Full coronary tree mask | 256×256×3 | Val Dice: **0.787** / IoU: **0.655** |
| **Stenosis Classifier** | EfficientNet-B0 | `backend/models/efficientnet_b0_arcade_stenosis_model.pkl` | Binary stenosis detection | 224×224×3 | Val ROC-AUC: **0.995** / F1: **0.968** |
| **Lesion Segmentation** | U-Net (ResNet34 Encoder) | `backend/models/arcade_stenosis_unet_best.pth` | Stenosis contour outline | 256×256×3 | Val Dice: **0.495** / IoU: **0.347** |
| **Feature Saliency** | Grad-CAM (Target layer: `_conv_head`) | Analytical Hook | Explainability heatmap | Dynamic ROI | Localization alignment |

---

## 3. Backend Modules (`backend/`)

- **`app/__init__.py`**: Flask application factory, CORS policies, output directory creation, and singleton `ModelAdapter` lifecycle management.
- **`app/routes.py`**:
  - `GET /api/health`: Service readiness, model loading state, and FDA IUO disclosure.
  - `POST /api/analyze`: Multi-stage pipeline execution, image synthesis, and analysis storage.
  - `GET /api/analysis/<id>`: Full record retrieval.
  - `GET /api/analysis/<id>/visualizations`: URLs for all 8 radiographic visual layers.
  - `GET /api/analysis/<id>/geometry`: Centerline samples, longitudinal lumen profile, and QCA metrics.
  - `GET /api/analysis/<id>/cross-sections`: Proximal reference, Minimal Lumen Area (MLA), and distal reference slices.
  - `GET /api/analytics/summary`: Aggregate clinical metrics, ARCADE benchmark statistics, and recent cases.
  - `GET /api/model/metrics`: Detailed training and validation history for all integrated models.
  - `GET /api/reports/<id>`: Structured clinical research report schema formatted for printing and PDF generation.
  - `GET /outputs/<filename>`: Secure output layer serving.
- **`app/model_adapter.py`**: PyTorch neural network loading, evaluation modes, ImageNet normalization, Grad-CAM backpropagation, vascular skeletonization, and 3D coordinate geometry synthesis.

---

## 4. Frontend Modules (`frontend/`)

- **`App.jsx`**: Main workstation navigation, top FDA regulatory bar, file drop zone, analysis runner, and active tab viewports.
- **`styles.css`**: Professional dark clinical workstation aesthetic (midnight blue palette `#060e1a`, cyan accents `#00d2d3`, lesion highlights `#ff4757`).
- **`components/FDABanner.jsx`**: Prominent FDA Investigational Use Only (IUO) notice with expandable regulatory compliance modal.
- **`components/VirtualHeart3D.jsx`**: Interactive Three.js 3D Virtual Human Heart with chambers, great vessels, coronary arterial network, camera view presets, and pulsing lesion beacons.
- **`components/ArteryInterior3D.jsx`**: 3D coronary artery interior reconstruction featuring a 180° longitudinal cutaway, internal lumen tunnel, protruding plaque, longitudinal travel slider (0–100 mm), and synchronized circular 2D cross-section canvas.
- **`components/CrossSectionInspector.jsx`**: Side-by-side comparative inspection of Proximal Reference, MLA, and Distal Reference slices with calibrated caliper rulers and longitudinal lumen profile graph.
- **`components/BloodFlowViewer.jsx`**: Three.js 1,200-particle hemodynamic simulation showing Bernoulli acceleration jet through the stenosis with velocity colormap HUD.
- **`components/AngiogramViewer.jsx`**: 8 radiographic visual layers, brightness/contrast sliders, invert fluoroscopy, and interactive pan/zoom.
- **`components/AnalyticsDashboard.jsx`**: Model benchmark progress bars, 200-case ARCADE confusion matrix, and searchable historical case log.
- **`components/ResearchReport.jsx`**: Clinical case report with metadata, 4-plate image montage, QCA metrics, and `@media print` PDF formatting.
