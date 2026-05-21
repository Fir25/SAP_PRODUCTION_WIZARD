"""
core/websocket_manager.py
=========================
Simple WebSocket manager for broadcasting validation queue updates to connected clients.
"""

import logging
from typing import List
from fastapi import WebSocket
from fastapi.websockets import WebSocketDisconnect

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected ({len(self.active_connections)} total)")

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected ({len(self.active_connections)} remaining)")

    async def broadcast(self, message: dict) -> None:
        if not self.active_connections:
            return

        logger.debug(f"Broadcasting WebSocket message to {len(self.active_connections)} connection(s)")
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                self.disconnect(connection)
            except Exception as exc:
                logger.warning(f"Failed to send WebSocket message: {exc}")


websocket_manager = WebSocketManager()
