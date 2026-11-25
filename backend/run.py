import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("FLASK_PORT", app.config.get("PORT", 5000))))
    host = os.getenv("FLASK_HOST", os.getenv("HOST", "0.0.0.0"))
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() in ("true", "1", "yes")
    use_reloader = os.getenv("FLASK_USE_RELOADER", "False").lower() in ("true", "1", "yes")

    print(f"Starting server on {host}:{port}")
    app.run(
        host=host,
        port=port,
        debug=debug_mode,
        use_reloader=use_reloader,
    )
