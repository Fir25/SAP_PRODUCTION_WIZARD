"""
core/event_router.py
====================
Middleware IIoT - Routing SAP → Validation Queue (Human Validation Workflow)

NEW BEHAVIOR:
- Events are loaded from SAP and added to validation queue
- NO automatic SAP posting
- Events wait for human approval through React wizard
- SAP posting only occurs after explicit human approval
"""
import asyncio
import logging

from sap.udt_service import udt_service, UDTReadError
from core.config_resolver import config_resolver, ConfigNotFoundError
from core.validation_queue import validation_queue
from core.websocket_manager import websocket_manager
from models.validation import ValidationError, EventStatus

from handlers.pince_pf import pince_pf_handler
from handlers.sortie_wagon import sortie_wagon_handler
from sap.config_service import config_service
from core.dynamic_pulse_router import build_routing as build_dynamic_routing

logger = logging.getLogger(__name__)

POLLING_INTERVAL_SECONDS = 10


# =========================
# ROUTING PRINCIPAL
# =========================
PULSE_ROUTING = {}


async def load_pulse_routing():
    """Load pulse definitions from SAP and build routing map.

    Pulse table is expected to contain a Type column with values like
    'PINCE_PF' or 'SORTIE_WAGON' which determine the handler.
    """
    try:
        pulses = await config_service.get_pulses()
        logger.info(f"Loaded {len(pulses)} pulses from SAP")
        # build dynamic routing using the dedicated resolver
        routing = build_dynamic_routing(pulses)
        global PULSE_ROUTING
        PULSE_ROUTING = routing
        logger.info(f"Loaded {len(PULSE_ROUTING)} routing rules from SAP (dynamic)")
        if PULSE_ROUTING:
            assignments = ", ".join([f"{k}:{('PINCE_PF' if v is pince_pf_handler else 'SORTIE_WAGON' if v is sortie_wagon_handler else 'UNKNOWN')}" for k, v in PULSE_ROUTING.items()])
            logger.info(f"Pulse routing assignments: {assignments}")
    except Exception as e:
        logger.exception(f"Failed to load pulse routing from SAP: {e}")

class EventRouter:

    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info(f" EventRouter démarré ({POLLING_INTERVAL_SECONDS}s) - MODE VALIDATION HUMAINE")
        asyncio.create_task(self._loop())

    async def stop(self):
        self._running = False
        logger.info("EventRouter arrêté")

    async def _loop(self):
        while self._running:
            try:
                await self._process()
            except UDTReadError as e:
                logger.error(f"Erreur UDT SAP: {e}")
            except Exception as e:
                logger.exception(f"Erreur Router: {e}")

            await asyncio.sleep(POLLING_INTERVAL_SECONDS)

    async def _process(self):
        events = await udt_service.get_pending_events()
        if not events:
            return

        for event in events:
            await self._handle(event)

    async def _handle(self, event):
        """
        NEW BEHAVIOR: Add event to validation queue WITHOUT automatic validation OR SAP interfacing.
        Events enter as PENDING_REVIEW for human correction BEFORE validation.
        Events are NOT marked as Is_Interfaced=Y until AFTER human approval.
        """
        logger.info(
            f" DocEntry={event.doc_entry} "
            f"Produit={event.product} Pulse={event.pulse}"
        )

        try:
            existing = validation_queue.get_event(event.doc_entry)
            if existing:
                logger.info(
                    f"⏭️ DocEntry={event.doc_entry} already in validation queue; skipping re-import"
                )
                return

            # Add event to validation queue as PENDING_REVIEW
            # NO automatic validation - human will validate explicitly
            queued_event = validation_queue.add_event(event)
            validation_queue.set_status(event.doc_entry, EventStatus.PENDING_REVIEW)
            
            logger.info(
                f"✅ DocEntry={event.doc_entry} added to queue - PENDING_REVIEW (awaiting human correction)"
            )

            # CRITICAL: DO NOT mark as interfaced in SAP yet
            # Events must remain visible in SAP until human approval
            # Is_Interfaced=Y will only be set AFTER successful SAP posting in approve endpoint
            logger.info(f"📋 DocEntry={event.doc_entry} kept in SAP (Is_Interfaced=N) until human approval")

            await websocket_manager.broadcast({
                "type": "queue_event_created",
                "event": queued_event.to_dict(),
            })

        except Exception as e:
            logger.exception(f"Erreur DocEntry={event.doc_entry}: {e}")
            # Set error remark but DO NOT mark as interfaced
            await udt_service.set_error_remark(event.doc_entry, str(e))


event_router = EventRouter()