"""
handlers/generic_handlers.py
===========================
Simple generic handlers used when pulses are resolved dynamically from SAP.
They expose a `.handle(event, config)` coroutine like the existing handlers.
"""
import logging
from sap.models import ProductionEvent, ProductConfig

logger = logging.getLogger(__name__)


class VracHandler:
    async def handle(self, event: ProductionEvent, config: ProductConfig) -> None:
        logger.info(f"VracHandler handling DocEntry={event.doc_entry} Product={event.product} Qty={event.quantity}")
        # Delegate to existing pince_pf logic where appropriate — for now behave as no-op
        return None


class EmballageHandler:
    async def handle(self, event: ProductionEvent, config: ProductConfig) -> None:
        logger.info(f"EmballageHandler handling DocEntry={event.doc_entry} Product={event.product} Qty={event.quantity}")
        # No-op placeholder; production-specific logic can be implemented later
        return None


class OFLaunchHandler:
    async def handle(self, event: ProductionEvent, config: ProductConfig) -> None:
        logger.info(f"OFLaunchHandler handling DocEntry={event.doc_entry} Product={event.product} Qty={event.quantity}")
        # OF launch semantics are domain-specific — placeholder no-op
        return None


class GenericProductionHandler:
    async def handle(self, event: ProductionEvent, config: ProductConfig) -> None:
        logger.info(f"GenericProductionHandler handling DocEntry={event.doc_entry} Pulse={event.pulse} Product={event.product} Qty={event.quantity}")
        # Generic fallback: do not perform SAP posting; allow approval flow to mark interfaced afterwards
        return None
