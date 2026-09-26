import os
import sys

# ---------------------------------------------------------------------------
# Vercel Serverless Function — WSGI entry point
# ---------------------------------------------------------------------------
# Add the project root to sys.path so `backend.*` imports resolve correctly
# regardless of the working directory Vercel uses when invoking this file.
# ---------------------------------------------------------------------------

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Set VERCEL env var so database.py routes writes to /tmp (writable on Vercel)
os.environ.setdefault("VERCEL", "1")

from backend.app import create_app

# Vercel automatically detects a module-level `app` variable as the WSGI handler
app = create_app()
