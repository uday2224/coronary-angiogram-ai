"""
Comprehensive automated test suite for Coronary Angiogram AI Workstation & Backend API.
Tests:
  1. GET  /api/health (Readiness, device, FDA IUO regulatory disclaimers)
  2. POST /api/analyze (Validation: missing file, wrong extension, corrupt file)
  3. POST /api/analyze (Positive stenosis inference on real angiogram)
  4. Mathematical consistency of MLD, MLA, RVD, %DS, and %AS
  5. Negative case handling (Zero positive stenosis pixels, 0.0% DS, no lesion beacon)
  6. Data provenance, calibration metadata, and IVUS/OCT disclaimers
  7. Sequential upload state clearance (independent analysis IDs, no residual state)
  8. GET  /api/analysis/<id>, /visualizations, /geometry, /cross-sections
  9. GET  /api/analytics/summary & /api/model/metrics
  10. GET /outputs/<filename> serving generated visual overlays
"""

import io
import sys
import json
import numpy as np
from PIL import Image
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app import create_app

def run_all_tests():
    print("==================================================================")
    print("RUNNING CORONARY ANGIOGRAM AI COMPREHENSIVE VALIDATION SUITE")
    print("==================================================================")
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    passed = 0
    total = 0

    def check(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name}: {details}")

    # 1. Health Endpoint
    r = client.get("/api/health")
    check("1. GET /api/health -> 200", r.status_code == 200)
    h_data = r.get_json()
    check("1.1 Pipeline is healthy & models loaded", h_data.get("model_loaded") is True)
    check("1.2 FDA IUO notice present", "Investigational Use Only" in h_data.get("regulatory_notice", ""))

    # 2. Input Validation Tests
    r_miss = client.post("/api/analyze")
    check("2.1 Missing file -> 400", r_miss.status_code == 400 and r_miss.get_json()["error"] == "FILE_MISSING")

    r_unsupp = client.post("/api/analyze", data={"file": (io.BytesIO(b"abc"), "test.txt")}, content_type="multipart/form-data")
    check("2.2 Unsupported extension -> 415", r_unsupp.status_code == 415 and r_unsupp.get_json()["error"] == "UNSUPPORTED_FILE")

    r_corrupt = client.post("/api/analyze", data={"file": (io.BytesIO(b"not an image"), "corrupt.png")}, content_type="multipart/form-data")
    check("2.3 Corrupt image -> 400", r_corrupt.status_code == 400 and r_corrupt.get_json()["error"] == "INVALID_IMAGE")

    # 3. Real Multi-Model Pipeline Inference (Positive Case)
    test_img = backend_dir.parent / "test_images" / "test_angiogram_1.png"
    check("3.0 Test angiogram exists", test_img.exists())

    pos_id = None
    if test_img.exists():
        with open(test_img, "rb") as f:
            r_inf = client.post("/api/analyze", data={"file": (f, "test_angiogram_1.png")}, content_type="multipart/form-data")
        check("3.1 Positive case POST /api/analyze -> 200", r_inf.status_code == 200)
        res = r_inf.get_json()
        check("3.2 Success flag is True", res.get("success") is True)
        results = res.get("results", {})
        pos_id = results.get("analysis_id")
        check("3.3 Analysis ID format valid (CAI-XXXXXXXX)", pos_id is not None and pos_id.startswith("CAI-"))
        check("3.4 Classification outcome present", results.get("prediction") in ("POSITIVE", "NEGATIVE"))

        # 4. Mathematical Consistency of MLD, MLA, RVD, and %DS
        geom = results.get("geometry", {})
        qm = geom.get("quantitative_metrics", {})
        check("4.1 Quantitative metrics dictionary present", bool(qm))

        rvd = qm.get("reference_diameter_mm", 0.0)
        mld = qm.get("minimal_lumen_diameter_mm", 0.0)
        mla = qm.get("minimal_lumen_area_mm2", 0.0)
        ds = qm.get("percent_diameter_stenosis", 0.0)
        as_pct = qm.get("percent_area_stenosis", 0.0)

        check("4.2 MLD <= RVD", mld <= rvd + 0.01)
        check("4.3 %DS calculation consistent: ((RVD - MLD)/RVD)*100", abs(ds - round(((rvd - mld) / rvd) * 100, 1)) < 0.2 if rvd > 0 else True)
        check("4.4 MLA derived from MLD radius: pi*(MLD/2)^2", abs(mla - round(np.pi * ((mld / 2) ** 2), 2)) < 0.2)

        # 5. Data Provenance & Calibration Metadata
        calib = geom.get("calibration_metadata", {})
        check("5.1 Calibration metadata present", bool(calib))
        check("5.2 Calibration status explicitly labeled", "Calculated from model-derived geometry" in calib.get("calibration_status", ""))
        check("5.3 Physical calibration flag is False (uncalibrated 2D)", calib.get("is_physically_calibrated") is False)

        pixel_m = geom.get("pixel_measurements", {})
        check("5.4 Raw pixel measurements present", "vessel_pixels" in pixel_m and "reference_diameter_px" in pixel_m)

        # Disclaimers for unsupported physical parameters
        check("5.5 IVUS/OCT disclaimer for plaque burden", "IVUS/OCT" in qm.get("plaque_burden_disclaimer", ""))
        check("5.6 AHA/ACC morphological disclaimer present", "insufficient morphological criteria" in qm.get("aha_acc_disclaimer", ""))

    # 6. Negative Case Validation (Zero Stenosis Mask / Blank Background)
    # Create a synthetic patent vessel image (clean straight cylinder)
    clean_arr = np.zeros((256, 256, 3), dtype=np.uint8)
    clean_arr[:, 118:138] = 200 # vertical bright vessel bar
    buf = io.BytesIO()
    Image.fromarray(clean_arr).save(buf, format="PNG")
    buf.seek(0)

    # Force a mock with adapter threshold=1.0 or directly test negative path
    adapter = app.extensions["model_adapter"]
    orig_thresh = adapter.threshold
    adapter.threshold = 0.999 # Force zero stenosis pixels

    r_neg = client.post("/api/analyze", data={"file": (buf, "clean_patent.png")}, content_type="multipart/form-data")
    adapter.threshold = orig_thresh # Restore threshold

    check("6.1 Negative case POST /api/analyze -> 200", r_neg.status_code == 200)
    neg_results = r_neg.get_json().get("results", {})
    check("6.2 Stenosis pixel count is exactly 0", neg_results.get("stenosis_pixels") == 0)
    check("6.3 Prediction is strictly NEGATIVE", neg_results.get("prediction") == "NEGATIVE")
    check("6.4 Prediction name is 'No Stenosis Detected'", neg_results.get("prediction_name") == "No Stenosis Detected")
    check("6.5 Mandatory negative disclaimer text exact match",
          "No stenosis detected by the current model." in neg_results.get("negative_disclaimer", "") and
          "clinically normal" in neg_results.get("negative_disclaimer", ""))

    neg_geom = neg_results.get("geometry", {})
    neg_qm = neg_geom.get("quantitative_metrics", {})
    check("6.6 Negative case %DS is 0.0%", neg_qm.get("percent_diameter_stenosis") == 0.0)
    check("6.7 Negative case %AS is 0.0%", neg_qm.get("percent_area_stenosis") == 0.0)
    check("6.8 Negative case lesion length is 0.0 mm", neg_qm.get("lesion_length_mm") == 0.0)
    check("6.9 Negative case 3D heart coordinates are None (no beacon)", neg_results.get("localization", {}).get("heart_3d_coordinates") is None)
    check("6.10 Negative case lesion components list is empty", len(neg_results.get("localization", {}).get("lesion_components", [])) == 0)

    # 7. Sequential Upload Independence Test
    check("7.1 Positive and negative analysis IDs are independent", pos_id != neg_results.get("analysis_id"))

    # 8. GET Individual Endpoints for Saved Record
    if pos_id:
        r_rec = client.get(f"/api/analysis/{pos_id}")
        check("8.1 GET /api/analysis/<id> -> 200", r_rec.status_code == 200 and r_rec.get_json().get("success") is True)

        r_vis = client.get(f"/api/analysis/{pos_id}/visualizations")
        check("8.2 GET /api/analysis/<id>/visualizations -> 200", r_vis.status_code == 200 and len(r_vis.get_json().get("visualizations", {})) >= 8)

        r_geom = client.get(f"/api/analysis/{pos_id}/geometry")
        check("8.3 GET /api/analysis/<id>/geometry -> 200", r_geom.status_code == 200 and "quantitative_metrics" in r_geom.get_json().get("geometry", {}))

        r_cs = client.get(f"/api/analysis/{pos_id}/cross-sections")
        check("8.4 GET /api/analysis/<id>/cross-sections -> 200", r_cs.status_code == 200 and "cross_sections" in r_cs.get_json())

        r_rep = client.get(f"/api/reports/{pos_id}")
        check("8.5 GET /api/reports/<id> -> 200", r_rep.status_code == 200 and "report_id" in r_rep.get_json().get("report", {}))

        sample_path = results.get("overlay_image")
        if sample_path:
            r_file = client.get(sample_path)
            check("8.6 GET /outputs/<file> -> 200 (image/png)", r_file.status_code == 200 and r_file.content_type.startswith("image/"))

    # 9. Summary and Metrics
    r_sum = client.get("/api/analytics/summary")
    check("9.1 GET /api/analytics/summary -> 200", r_sum.status_code == 200)

    r_met = client.get("/api/model/metrics")
    check("9.2 GET /api/model/metrics -> 200", r_met.status_code == 200)

    print("==================================================================")
    print(f"TEST RESULTS: {passed}/{total} checks PASSED ({(passed/total)*100:.1f}% SUCCESS RATE)")
    print("==================================================================")
    if passed < total:
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
