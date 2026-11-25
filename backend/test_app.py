"""
Backend tests for Coronary Angiogram AI Pipeline.

Tests:
  - GET /api/health -> 200, checks model and pipeline status
  - POST /api/analyze -> validation for missing, wrong extension, corrupt file
  - POST /api/analyze -> real inference with test angiogram (if models are loaded)
  - GET /outputs/<filename> -> serves generated files securely
"""

import io
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.get_json()
    assert data["success"] is True
    assert "model_loaded" in data
    assert "models" in data
    assert data["models"]["unetpp_vessels"] is True
    assert data["models"]["efficientnet_classification"] is True
    assert data["models"]["unet_stenosis"] is True


def test_analyze_missing_file(client):
    r = client.post("/api/analyze")
    assert r.status_code == 400
    assert r.get_json()["error"] == "FILE_MISSING"


def test_analyze_unsupported_file(client):
    data = {"file": (io.BytesIO(b"dummy text"), "notes.txt")}
    r = client.post("/api/analyze", data=data, content_type="multipart/form-data")
    assert r.status_code == 415
    assert r.get_json()["error"] == "UNSUPPORTED_FILE"


def test_analyze_invalid_image(client):
    data = {"file": (io.BytesIO(b"not an image"), "corrupt.png")}
    r = client.post("/api/analyze", data=data, content_type="multipart/form-data")
    assert r.status_code == 400
    assert r.get_json()["error"] == "INVALID_IMAGE"


def test_real_inference_on_angiogram(client):
    test_img = backend_dir.parent / "test_images" / "test_angiogram_1.png"
    if not test_img.exists():
        pytest.skip("Test angiogram not found")

    with open(test_img, "rb") as f:
        data = {"file": (f, "test_angiogram_1.png")}
        r = client.post("/api/analyze", data=data, content_type="multipart/form-data")

    assert r.status_code == 200
    res = r.get_json()
    assert res["success"] is True
    results = res["results"]

    # Verify all expected pipeline outputs exist
    for key in [
        "original_image",
        "overlay_image",
        "contour_image",
        "segmentation_mask",
        "vessel_mask",
        "vessel_overlay",
        "gradcam_image",
        "vessel_roi",
    ]:
        assert key in results, f"Missing output image {key}"
        assert results[key].startswith("/outputs/")

        # Verify output file is actually reachable
        file_resp = client.get(results[key])
        assert file_resp.status_code == 200

    # Verify classification results
    assert "prediction" in results
    assert results["prediction"] in ("POSITIVE", "NEGATIVE")
    assert "confidence" in results
    assert 0.0 <= results["confidence"] <= 1.0
    assert "vessel_pixels" in results
    assert results["vessel_pixels"] > 0
