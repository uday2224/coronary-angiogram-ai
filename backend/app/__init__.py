import logging
import os
from pathlib import Path

from flask import Flask, request
from flask_cors import CORS
from dotenv import load_dotenv

from .routes import api
from .model_adapter import ModelAdapter


def create_app():
    load_dotenv()

    # --- Logging ---
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    logger = logging.getLogger(__name__)

    app = Flask(__name__)

    # --- Paths ---
    base = Path(__file__).resolve().parents[1]
    out = base / "outputs"
    out.mkdir(parents=True, exist_ok=True)
    models_dir = base / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # --- Configuration ---
    app.config.update(
        OUTPUT_DIR=str(out),
        MODELS_DIR=str(models_dir),
        MAX_CONTENT_LENGTH=int(os.getenv("MAX_UPLOAD_MB", "12")) * 1024 * 1024,
        HOST=os.getenv("FLASK_HOST", os.getenv("HOST", "0.0.0.0")),
        PORT=int(os.getenv("PORT", os.getenv("FLASK_PORT", "5000"))),
        MODEL_TYPE=os.getenv("MODEL_TYPE", "integrated_pipeline"),
        SEGMENTATION_THRESHOLD=float(os.getenv("SEGMENTATION_THRESHOLD", "0.3")),
    )

    # --- CORS ---
    CORS(
        app,
        resources={
            r"/*": {
                "origins": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        },
    )
    logger.info("CORS enabled for all origins on /api and /outputs")

    # --- Blueprint ---
    app.register_blueprint(api)

    # Explicit global CORS headers for all requests & preflights
    @app.before_request
    def handle_options_preflight():
        if request.method == "OPTIONS":
            response = app.make_default_options_response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
            return response

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        return response

    # --- Load AI Pipeline once at startup ---
    adapter = ModelAdapter(
        model_type=app.config["MODEL_TYPE"],
        models_dir=models_dir,
        threshold=app.config["SEGMENTATION_THRESHOLD"],
    )
    adapter.load()
    app.extensions["model_adapter"] = adapter

    logger.info("App initialized — pipeline ready: %s", adapter.loaded)

    return app
