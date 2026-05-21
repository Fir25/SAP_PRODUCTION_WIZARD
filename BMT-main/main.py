"""
main.py
=======
Point d'entrée du middleware BMT IIoT.( python -m uvicorn main:app --reload)
Lance FastAPI + démarre le moteur de polling au startup.
"""

import logging
# pyrefly: ignore [missing-import]
import uvicorn
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketDisconnect
from contextlib import asynccontextmanager
from config.settings import settings
from config.logging_config import setup_logging
from core.event_router import event_router
from core.websocket_manager import websocket_manager
from sap.session import sap_session
from api.routes.events import router as events_router

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    logger.info(" Démarrage middleware BMT IIoT...")
    
    # Try to connect to SAP, but don't fail if unavailable (development mode)
    try:
        await sap_session.login()
        await event_router.start()
    except Exception as e:
        logger.warning(f"SAP connection failed (running in API-only mode): {e}")
        logger.info("API routes will work with mock data")
    
    yield
    # SHUTDOWN
    logger.info("Arrêt middleware BMT IIoT...")
    try:
        await event_router.stop()
        await sap_session.logout()
    except Exception as e:
        logger.warning(f"Error during shutdown: {e}")


app = FastAPI(
    title="BMT IIoT Middleware",
    version="1.0.0",
    description="Middleware SAP B1 — Ligne de production BMT",
    lifespan=lifespan,
)

# Add CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # React frontend dev server
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",  # Alternative port
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(events_router)


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "sap_session": sap_session.is_session_valid(),
        "env": settings.APP_ENV,
    }

