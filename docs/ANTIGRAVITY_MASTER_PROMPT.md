# Antigravity Master Prompt — Coronary Angiogram AI

Act as a senior full-stack engineer and ML integration engineer. Build on this starter repository.

## Project status
- Model training is already completed by the owner.
- Frontend and backend must now be built and completed; there is no existing frontend/backend to preserve.
- The owner will provide trained artifacts, which may include `.pth`, `.pt`, `.pkl`, `.pickle`, and related model/config files.
- Do not retrain, replace, or fabricate the trained models.
- The provided starter contains React/Vite frontend and Flask backend scaffolding.

## First inspect, then plan
1. Inspect all repository files and list model artifacts.
2. Identify the exact artifact format and contents.
3. Find the original training notebook/code/configuration.
4. Determine architecture, preprocessing, input shape, normalization, output tensor, label meaning, and threshold from evidence.
5. If these details are unavailable, ask the owner for the training notebook or export code. Do not guess.
6. Provide a concise implementation plan before major edits.

Previously discussed candidate details for one segmentation model: U-Net with ResNet34 encoder, 3 input channels, one output class, 256x256 input, ImageNet normalization, threshold 0.3, checkpoint path previously used in Colab `/content/drive/MyDrive/REDDY/models/arcade_stenosis_unet_best.pth`. Verify these details against the actual checkpoint/training code. A state-dict `.pth` is not necessarily a complete serialized model.

## Model integration
Implement `backend/app/model_adapter.py`:
- Load each required model once at backend startup.
- Match exact architecture and preprocessing.
- Support CPU and available CUDA.
- Use evaluation/inference mode.
- Return actual predictions only.
- Preserve original image dimensions for output masks.
- Configure thresholds based on training/validation evidence.
- Determine the role of every artifact; do not assume every pickle is a segmentation model.
- Pickle deserialization can execute arbitrary code: load only trusted files.
- Do not invent confidence scores, stenosis percentage, severity grade, or CAD diagnosis.

## Backend
Complete Flask endpoints:
- `GET /api/health`
- `POST /api/analyze` with multipart field `file`
- `GET /outputs/<filename>`
Add file validation, upload limits, unique output names, secure output serving, CORS restricted to configured frontend origin, useful errors and logs. Load models once. Never report success when inference did not run.

## Frontend
Complete a polished, responsive React application:
- Desktop, tablet, and mobile layouts.
- Drag/drop and file picker for PNG/JPG.
- Image preview, file validation, upload/analyze states.
- API readiness indicator.
- Call Flask using `FormData` and `VITE_API_BASE_URL`.
- Display original image, binary mask, overlay, and contour from real API results.
- View switching, zoom/pan if feasible, fit/reset, and original/overlay comparison.
- Preserve aspect ratio and do not distort images.
- Accessible controls and useful error states.
- Do not create fake history or mock prediction results.

## Visualization and clinical boundaries
The red overlay/contour must be derived from the actual model mask. Segmentation alone does not establish clinical stenosis percentage, severity, or CAD diagnosis. Do not create decorative artery art as a substitute for prediction. Label the system as an experimental research prototype, not a diagnostic device.

## Configuration and security
- Keep model artifacts out of Git.
- Use environment variables for configuration.
- Provide Windows and Linux/macOS setup instructions.
- Do not hardcode temporary tunnel URLs.
- Do not expose real patient data through public tunnels or unsecured deployments.

## Validation and deliverables
- Run backend tests and frontend production build.
- Verify `/api/health`.
- Test missing/invalid uploads and inference errors.
- Test real inference with owner-supplied model and test angiogram.
- Verify all output image URLs and responsive breakpoints.
- Document each model artifact and its purpose.
- Provide completed/pending/blocked checklist.
- If model files or training details are absent, clearly state what is needed and do not pretend integration is complete.

Work incrementally and preserve this starter's useful structure.
