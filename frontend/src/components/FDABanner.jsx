import React, { useState } from "react";
import { AlertTriangle, ShieldAlert, Info, X, ChevronRight, FileText } from "lucide-react";

export default function FDABanner() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="fda-banner" role="banner" aria-label="FDA Regulatory Notice">
        <div className="fda-banner-content">
          <div className="fda-badge">
            <ShieldAlert size={14} className="fda-icon" />
            <span>FDA STATUS: INVESTIGATIONAL USE ONLY (IUO)</span>
          </div>
          <p className="fda-text">
            <strong>RESEARCH PROTOTYPE ONLY</strong> — Not an FDA-cleared or CE-marked diagnostic medical device. Output predictions, segmentation masks, and 3D mappings are algorithmic estimations derived from the ARCADE challenge models. Not for clinical diagnostic or therapeutic decision-making.
          </p>
          <button
            className="fda-details-btn"
            onClick={() => setModalOpen(true)}
            aria-label="View FDA and Regulatory Disclosures"
          >
            <Info size={13} />
            <span>Regulatory Details</span>
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="fda-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fda-modal-header">
              <div className="fda-modal-title">
                <ShieldAlert size={20} className="text-warning" />
                <h3>Regulatory & Clinical Research Disclosures</h3>
              </div>
              <button
                className="close-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="fda-modal-body">
              <div className="disclosure-section">
                <h4>1. Investigational Device Exemption (IDE) Notice</h4>
                <p>
                  This software platform is an <strong>Investigational Use Only (IUO)</strong> research prototype intended solely for scientific evaluation, retrospective benchmarking, and computer vision research in medical imaging. It has not received 510(k) clearance, De Novo classification, or Premarket Approval (PMA) from the United States Food and Drug Administration (FDA) or European Medicines Agency (EMA).
                </p>
              </div>

              <div className="disclosure-section">
                <h4>2. Training & Validation Evidence</h4>
                <p>
                  All neural network models utilized within this platform (U-Net++, EfficientNet-B0, U-Net) were trained on the publicly available <strong>ARCADE</strong> (Automatic Region and Lesion Assessment for Coronary Artery Disease) dataset consisting of annotated X-ray coronary angiography frames.
                </p>
                <ul>
                  <li><strong>Coronary Vessel Segmentation:</strong> U-Net++ ResNet34 (Validation Dice: 0.787, IoU: 0.655)</li>
                  <li><strong>Stenosis Classification:</strong> EfficientNet-B0 (Validation F1: 0.968, ROC-AUC: 0.995)</li>
                  <li><strong>Stenosis Outline:</strong> U-Net ResNet34 (Validation Dice: 0.495, IoU: 0.363)</li>
                  <li><strong>Explainability:</strong> Grad-CAM feature attribution hooks on Conv5 features</li>
                </ul>
              </div>

              <div className="disclosure-section">
                <h4>3. Scientific & Clinical Boundaries</h4>
                <ul>
                  <li>2D projection X-ray angiography does not inherently establish true 3D spatial coordinates without stereoscopic biplane calibration or multi-angle 3D reconstruction.</li>
                  <li>The 3D Virtual Heart lesion markers represent <strong>anatomical reference projections</strong> derived from arterial branch morphology, not measured 3D physical coordinates.</li>
                  <li>Pixel area calculations reflect mask extent in the 2D frame and must not be interpreted as anatomical percentage diameter stenosis (%DS) or fractional flow reserve (FFR).</li>
                </ul>
              </div>

              <div className="disclosure-section">
                <h4>4. Clinical Oversight Required</h4>
                <p>
                  All clinical decisions regarding percutaneous coronary intervention (PCI), coronary artery bypass grafting (CABG), or medical management must be made exclusively by board-certified cardiologists based on primary diagnostic angiography and hemodynamic measurements.
                </p>
              </div>
            </div>

            <div className="fda-modal-footer">
              <span className="text-muted">Software Build: v2.4-Arcade-Research</span>
              <button className="primary-btn" onClick={() => setModalOpen(false)}>
                I Acknowledge Research Boundaries
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
