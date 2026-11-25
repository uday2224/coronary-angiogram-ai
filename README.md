# Coronary Angiogram AI Workstation & 3D Virtual Heart Platform

> **FDA INVESTIGATIONAL USE ONLY (IUO) — RESEARCH PROTOTYPE**  
> *Caution — Investigational Device. Limited by Federal law to investigational use. (21 CFR 812.5)*

An advanced medical imaging workstation and deep learning platform for coronary angiogram analysis, interactive 3D virtual heart visualization, coronary artery interior reconstruction, multi-slice cross-section inspection, hemodynamic blood-flow simulation, and quantitative reporting.

---

## 1. Project Directory Structure

```
coronary_angiogram_ai_starter_antigravity/
├── backend/                             # Python / Flask AI Backend API
│   ├── app/                             # Application source code
│   │   ├── __init__.py                  # Flask app factory, CORS, logger & model initialization
│   │   ├── routes.py                    # 10 REST API endpoints, image overlays & DB persistence
│   │   └── model_adapter.py             # Multi-model AI pipeline, Grad-CAM & QCA geometry
│   ├── models/                          # Trained neural network model weights
│   │   ├── .gitkeep                     # Keeps models directory tracked
│   │   ├── unetplusplus_resnet34_arcade_model.pkl    # Vessel segmentation model (Dice: 0.787)
│   │   ├── efficientnet_b0_arcade_stenosis_model.pkl # Stenosis classifier (ROC-AUC: 0.995)
│   │   └── arcade_stenosis_unet_best.pth             # Stenosis boundary model (Dice: 0.495)
│   ├── outputs/                         # Inference outputs (generated heatmaps & masks)
│   │   ├── .gitkeep                     # Keeps outputs directory tracked
│   │   └── analyses_history.json        # Persistent case database
│   ├── .venv/                           # Python 3.12 virtual environment (PyTorch + dependencies)
│   ├── .env                             # Active environment configuration
│   ├── .env.example                     # Environment template
│   ├── .gitignore                       # Backend git ignore rules
│   ├── requirements.txt                 # Backend Python package dependencies
│   ├── run.py                           # Flask server entrypoint (0.0.0.0:5000)
│   ├── test_app.py                      # Core unit tests
│   └── test_all_endpoints.py            # Comprehensive 22-step integration test suite
│
├── frontend/                            # React 18 + Vite Medical Imaging Workstation
│   ├── src/                             # Frontend application source
│   │   ├── main.jsx                     # React entrypoint
│   │   ├── App.jsx                      # Workstation layout, navigation tabs & pipeline runner
│   │   ├── styles.css                   # Dark medical workstation aesthetic stylesheet
│   │   └── components/                  # Specialized UI & 3D components
│   │       ├── FDABanner.jsx            # FDA IUO regulatory banner & disclosure modal
│   │       ├── VirtualHeart3D.jsx       # Interactive Three.js 3D Virtual Human Heart
│   │       ├── AngiogramViewer.jsx      # 8 radiographic visual layers, controls & zoom/pan
│   │       ├── ArteryInterior3D.jsx     # Signature 3D Artery Interior with 180° cutaway
│   │       ├── CrossSectionInspector.jsx# Multi-slice inspection (Proximal, MLA, Distal) & QCA
│   │       ├── BloodFlowViewer.jsx      # 3D Hemodynamic blood-flow simulator & colormap HUD
│   │       ├── AnalyticsDashboard.jsx   # Clinical benchmarks, confusion matrix & case history
│   │       └── ResearchReport.jsx       # Clinical case report with montage & PDF export
│   ├── index.html                       # HTML5 template with viewport configuration
│   ├── package.json                     # NPM packages & build scripts
│   ├── vite.config.js                   # Vite bundler configuration
│   ├── dist/                            # Production compiled bundle
│   └── node_modules/                    # Frontend dependencies (React, Three.js, Lucide)
│
├── notebooks/                           # Model research, training & validation notebooks
│   └── models_1_2_3.ipynb               # Original ARCADE training & evaluation notebook
│
├── test_images/                         # Sample fluoroscopic coronary angiograms
│   ├── test_angiogram_1.png             # Sample case 1 (High-resolution 512x512)
│   └── test_angiogram_10.png            # Sample case 2 (High-resolution 512x512)
│
├── docs/                                # Technical & regulatory documentation
│   ├── ARCHITECTURE.md                  # Comprehensive platform architecture & pipeline guide
│   ├── FDA_REGULATORY_COMPLIANCE.md     # Official Investigational Use Only (IUO) statement
│   └── ANTIGRAVITY_MASTER_PROMPT.md     # Project specification & requirements
│
├── .gitignore                           # Root workspace git ignore rules
├── README.md                            # Complete setup, architecture & usage manual
├── start_backend.bat                    # One-click Windows launcher for Flask API (port 5000)
└── start_frontend.bat                   # One-click Windows launcher for React Workstation (port 5173)
```

---

## 2. Quickstart Guide

### Option A: One-Click Windows Launch (Recommended)
1. Double-click `start_backend.bat` (Starts the Flask API on port `5000`).
2. Double-click `start_frontend.bat` (Starts the React / Vite UI on port `5173`).
3. Open your browser at **`http://localhost:5173`**.

### Option B: Terminal Launch
#### Backend (Terminal 1)
```powershell
cd backend
.venv\Scripts\python.exe run.py
```

#### Frontend (Terminal 2)
```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
cd frontend
npm.cmd run dev
```

---

## 3. Detailed Component & File Guide

### A. Backend API (`backend/`)
| File / Directory | Purpose |
| :--- | :--- |
| `backend/app/model_adapter.py` | PyTorch model loader, evaluation mode, ImageNet normalization, Grad-CAM hook, vascular skeletonization, and 3D coordinate geometry engine. |
| `backend/app/routes.py` | 10 REST endpoints handling file validation, pipeline execution, 8 output overlays generation, and persistence. |
| `backend/app/__init__.py` | App factory setting up CORS, logging, and singleton model adapter lifecycle. |
| `backend/models/*.pkl, *.pth` | Trained model weights extracted from the ARCADE dataset. |
| `backend/outputs/` | Storage for generated radiographic overlays, Grad-CAM heatmaps, and case JSON database. |
| `backend/test_all_endpoints.py` | 22-step integration test suite verifying health, validation, inference, geometry, and reporting. |

### B. Frontend Medical Workstation (`frontend/`)
| Component | Functionality |
| :--- | :--- |
| `FDABanner.jsx` | Fixed top regulatory banner with expandable FDA 21 CFR 812.5 disclosure modal. |
| `VirtualHeart3D.jsx` | Anatomical 3D heart with chambers, great vessels, coronary branches, camera presets, and pulsing lesion beacon. |
| `ArteryInterior3D.jsx` | 180° longitudinal cutaway, internal lumen tunnel, protruding plaque, longitudinal travel slider (0–100 mm), and synchronized circular 2D cross-section canvas. |
| `CrossSectionInspector.jsx` | Multi-slice comparison (Proximal, Minimal Lumen Area, Distal), caliber calipers, and longitudinal profile graph. |
| `BloodFlowViewer.jsx` | 1,200-particle hemodynamic simulation showing Bernoulli acceleration jet and velocity colormap HUD. |
| `AngiogramViewer.jsx` | 8 radiographic visual layers, brightness/contrast sliders, invert fluoroscopy, and interactive pan/zoom. |
| `AnalyticsDashboard.jsx` | Model benchmark progress bars, 200-case ARCADE confusion matrix, and searchable case log. |
| `ResearchReport.jsx` | Clinical case report with metadata, 4-plate image montage, QCA metrics, and `@media print` PDF formatting. |

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend status, model readiness, and FDA regulatory notice. |
| `POST` | `/api/analyze` | Multi-model analysis of uploaded angiogram (PNG/JPEG). |
| `GET` | `/api/analysis/<id>` | Full analysis result for a given case ID. |
| `GET` | `/api/analysis/<id>/visualizations` | URLs for all 8 visual layers. |
| `GET` | `/api/analysis/<id>/geometry` | Centerline samples, longitudinal lumen profile, and QCA metrics. |
| `GET` | `/api/analysis/<id>/cross-sections` | Multi-slice cross-sections (Proximal, MLA, Distal). |
| `GET` | `/api/analytics/summary` | Aggregate workstation analytics, case history, and benchmarks. |
| `GET` | `/api/model/metrics` | Validation benchmarks (Dice, IoU, ROC-AUC, F1). |
| `GET` | `/api/reports/<id>` | Structured case report schema for printing/PDF export. |
| `GET` | `/outputs/<filename>` | Serves generated visual layer images securely. |

---

## 5. Verification & Testing

To run the complete 22-check integration test suite:
```powershell
cd backend
.venv\Scripts\python.exe test_all_endpoints.py
```

To build the frontend for production:
```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
cd frontend
npm.cmd run build
```
