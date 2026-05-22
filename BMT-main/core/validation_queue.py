"""
core/validation_queue.py
========================
In-memory validation queue for human correction workflow.
Stores events pending validation and tracks their state.
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime

from models.validation import QueuedEvent, EventStatus, ValidationError
from sap.models import ProductionEvent

logger = logging.getLogger(__name__)


class ValidationQueue:
    """
    In-memory storage for events awaiting human validation.
    Thread-safe singleton pattern for production use.
    """
    
    def __init__(self):
        self._events: Dict[int, QueuedEvent] = {}
        self._lock = None  # For thread safety in production
    
    def add_event(self, sap_event: ProductionEvent) -> QueuedEvent:
        """Add an event to the queue. Returns existing event if already present."""
        # Check if event already exists in queue (deduplication)
        existing = self._events.get(sap_event.doc_entry)
        if existing:
            logger.info(
                f"🔄 Event already in queue: DocEntry={sap_event.doc_entry} "
                f"Status={existing.status.value} - skipping duplicate"
            )
            return existing
        
        queued_event = QueuedEvent(sap_event=sap_event)
        self._events[sap_event.doc_entry] = queued_event
        logger.info(
            f"📥 Event added to queue: DocEntry={sap_event.doc_entry} "
            f"Product={sap_event.product} Pulse={sap_event.pulse}"
        )
        return queued_event
    
    def get_event(self, doc_entry: int) -> Optional[QueuedEvent]:
        """Get an event by DocEntry."""
        return self._events.get(doc_entry)
    
    def get_all_events(self) -> List[QueuedEvent]:
        """Get all events in the queue."""
        return list(self._events.values())
    
    def get_events_by_status(self, status: EventStatus) -> List[QueuedEvent]:
        """Get all events with a specific status."""
        return [e for e in self._events.values() if e.status == status]
    
    def update_event(
        self,
        doc_entry: int,
        bin_location: Optional[str] = None,
        quantity: Optional[float] = None,
        product: Optional[str] = None,
        warehouse: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Optional[QueuedEvent]:
        """Update event with user corrections."""
        event = self._events.get(doc_entry)
        if not event:
            logger.warning(f"Event not found for update: DocEntry={doc_entry}")
            return None
        
        if bin_location is not None:
            event.corrected_bin_location = bin_location
        if quantity is not None:
            event.corrected_quantity = quantity
        if product is not None:
            event.corrected_product = product
        if warehouse is not None:
            event.corrected_warehouse = warehouse
        if notes is not None:
            event.user_notes = notes
        
        event.updated_at = datetime.utcnow()
        logger.info(
            f"✏️  Event updated: DocEntry={doc_entry} "
            f"Bin={event.current_bin_location} Qty={event.current_quantity}"
        )
        return event
    
    def set_status(self, doc_entry: int, status: EventStatus) -> Optional[QueuedEvent]:
        """Update event status."""
        event = self._events.get(doc_entry)
        if not event:
            logger.warning(f"Event not found for status update: DocEntry={doc_entry}")
            return None
        
        old_status = event.status
        event.status = status
        event.updated_at = datetime.utcnow()
        
        if status == EventStatus.APPROVED:
            event.validated_at = datetime.utcnow()
        elif status == EventStatus.PROCESSED:
            event.processed_at = datetime.utcnow()
        
        logger.info(
            f"📊 Status updated: DocEntry={doc_entry} "
            f"{old_status.value} → {status.value}"
        )
        return event
    
    def set_validation_errors(
        self,
        doc_entry: int,
        errors: List[ValidationError],
    ) -> Optional[QueuedEvent]:
        """Set validation errors for an event."""
        event = self._events.get(doc_entry)
        if not event:
            logger.warning(f"Event not found for validation errors: DocEntry={doc_entry}")
            return None
        
        event.validation_errors = errors
        if errors:
            # If there are errors, set status to INVALID
            has_errors = any(e.severity == "ERROR" for e in errors)
            if has_errors:
                event.status = EventStatus.INVALID
        else:
            # No errors, set to VALID
            event.status = EventStatus.VALID
        
        event.updated_at = datetime.utcnow()
        logger.info(
            f"🔍 Validation errors set: DocEntry={doc_entry} "
            f"Errors={len(errors)} Status={event.status.value}"
        )
        return event
    
    def clear_validation_errors(self, doc_entry: int) -> Optional[QueuedEvent]:
        """Clear validation errors for an event."""
        event = self._events.get(doc_entry)
        if not event:
            return None
        
        event.validation_errors = []
        event.status = EventStatus.PENDING_REVIEW
        event.updated_at = datetime.utcnow()
        logger.info(f"✅ Validation errors cleared: DocEntry={doc_entry}")
        return event
    
    def set_sap_result(
        self,
        doc_entry: int,
        document_number: Optional[str],
        response_code: Optional[str],
        response_message: Optional[str],
    ) -> Optional[QueuedEvent]:
        """Set SAP posting results."""
        event = self._events.get(doc_entry)
        if not event:
            logger.warning(f"Event not found for SAP result: DocEntry={doc_entry}")
            return None
        
        event.sap_document_number = document_number
        event.sap_response_code = response_code
        event.sap_response_message = response_message
        event.updated_at = datetime.utcnow()
        return event
    
    def remove_event(self, doc_entry: int) -> bool:
        """Remove an event from the queue."""
        if doc_entry in self._events:
            del self._events[doc_entry]
            logger.info(f"🗑️  Event removed from queue: DocEntry={doc_entry}")
            return True
        return False
    
    def clear_all(self) -> None:
        """Clear all events from the queue."""
        count = len(self._events)
        self._events.clear()
        logger.info(f"🗑️  Queue cleared: {count} events removed")


# Singleton instance
validation_queue = ValidationQueue()
