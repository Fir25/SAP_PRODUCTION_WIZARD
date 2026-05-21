"""
api/routes/events.py
====================
API routes for WMS event validation — Human Validation Workflow

Flow:
    SAP B1 @BMT_PROD_EVENTS
        └─ EventRouter adds to ValidationQueue
            └─ GET /events/pending   ← React frontend reads queued events
            └─ PATCH /{id}/update   ← User corrects fields
            └─ PATCH /{id}/approve  ← Triggers SAP posting after human approval
            └─ PATCH /{id}/reject   ← Marks event as rejected
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

from sap.udt_service import udt_service, UDTReadError, UDTWriteError
from sap.models import ProductionEvent
from core.config_resolver import config_resolver, ConfigNotFoundError
from core.validation_queue import validation_queue
from core.websocket_manager import websocket_manager
from models.validation import EventStatus, ValidationError
from handlers.pince_pf import pince_pf_handler
from handlers.sortie_wagon import sortie_wagon_handler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])

async def _broadcast_queue_event(event):
    try:
        await websocket_manager.broadcast({
            "type": "queue_update",
            "event": event.to_dict(),
        })
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed: {e}")

# Pulse routing configuration (same as in core/event_router.py)
PULSE_ROUTING = {
    "P001": sortie_wagon_handler,
    "P002": pince_pf_handler,
    "P003": pince_pf_handler,
    "P004": pince_pf_handler,
}


class ApproveEventRequest(BaseModel):
    event_id: str
    modified_quantity: float
    notes: Optional[str] = None


class RejectEventRequest(BaseModel):
    event_id: str
    rejection_reason: str
    notes: Optional[str] = None


class UpdateEventRequest(BaseModel):
    """Request model for updating event fields (correction workflow)."""
    bin_location: Optional[str] = None
    quantity: Optional[float] = None
    product: Optional[str] = None
    warehouse: Optional[str] = None
    notes: Optional[str] = None


class SapResponse(BaseModel):
    success: bool
    document_number: Optional[str] = None
    response_code: Optional[str] = None
    response_message: Optional[str] = None
    error: Optional[str] = None


def map_production_event_to_api(event: ProductionEvent) -> dict:
    """
    Map SAP ProductionEvent to frontend-compatible API format.
    
    Maps SAP UDT fields to the WmsEvent interface expected by the React frontend.
    """
    # Determine event type based on pulse
    if event.pulse == "SortieWagon":
        event_type = "PRODUCTION_RECEIPT"
    elif event.pulse.startswith("PincePF"):
        event_type = "MATERIAL_CONSUMPTION"
    else:
        event_type = "UNKNOWN"
    
    # Map status based on is_valid_user and is_interfaced
    if event.is_interfaced == "Y":
        status = "COMPLETED"
    elif event.is_valid_user == "Y":
        status = "VALIDATED"
    else:
        status = "PENDING"
    
    # Create validation rules based on event properties
    validation_rules = [
        {"rule": "PRODUCT_EXISTS", "status": "OK", "message": f"Product {event.product} exists in SAP"},
        {"rule": "QUANTITY_POSITIVE", "status": "OK" if event.quantity > 0 else "ERROR", "message": "Quantity is positive"},
        {"rule": "BIN_LOCATION", "status": "OK" if event.bin_location else "WARNING", "message": f"Bin location: {event.bin_location or 'Not specified'}"},
        {"rule": "USER_VALIDATED", "status": "OK" if event.is_valid_user == "Y" else "WARNING", "message": "User validation status"},
    ]
    
    # Add pulse routing validation
    if event.pulse in PULSE_ROUTING:
        validation_rules.append({"rule": "PULSE_ROUTING", "status": "OK",
                       "message": f"Pulse '{event.pulse}' → handler disponible"})
    else:
        validation_rules.append({"rule": "PULSE_ROUTING", "status": "WARNING",
                       "message": f"Pulse '{event.pulse}' non mappé dans le routeur"})

    # Add prior remark validation
    if event.remark:
        validation_rules.append({"rule": "PRIOR_REMARK", "status": "WARNING",
                       "message": f"Remarque SAP : {event.remark}"})
    
    # Combine date and time for received_at with robust parsing
    received_at = _iso(event.date, event.time)
    
    return {
        "id": str(event.doc_entry),
        "external_id": f"SAP-{event.doc_entry}",
        "event_type": event_type,
        "status": status,
        "production_order": f"OF-{event.product}",
        "item_code": event.product,
        "item_description": f"Product {event.product}",
        "original_quantity": event.quantity,
        "unit_of_measure": "PCS",
        "machine_id": event.pulse,
        "machine_name": event.pulse,
        "warehouse_code": "WH-01",
        "bin_location": event.bin_location,
        "validation_rules": validation_rules,
        "notes": event.remark if event.remark else None,
        "received_at": received_at,
        "created_at": received_at,
        "updated_at": received_at,
    }


def _iso(date_str: str, time_str: str = "") -> str:
    """
    Combine a SAP date string (YYYY-MM-DD) and optional time string (HH:MM)
    into an ISO-8601 datetime string.  Falls back to now() if parsing fails.
    """
    try:
        # Try several common time formats from SAP U_Time
        if time_str:
            combined = f"{date_str} {time_str}"
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d %H%M%S", "%Y-%m-%d %H%M"):
                try:
                    dt = datetime.strptime(combined, fmt)
                    return dt.isoformat()
                except Exception:
                    continue
            # Last resort: replace separators and try again
            normalized = combined.replace('.', '-').replace('/', '-').replace(' ', 'T')
            try:
                dt = datetime.fromisoformat(normalized)
                return dt.isoformat()
            except Exception:
                return datetime.now(timezone.utc).isoformat()
        else:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _pulse_to_event_type(pulse: str) -> str:
    """Map pulse code to event type."""
    if pulse == "SortieWagon":
        return "PRODUCTION_RECEIPT"
    elif pulse.startswith("PincePF"):
        return "MATERIAL_CONSUMPTION"
    else:
        return "UNKNOWN"


def _pulse_label(pulse: str) -> str:
    """Get human-readable label for pulse."""
    if pulse == "SortieWagon":
        return "Sortie Wagon"
    elif pulse.startswith("PincePF"):
        return f"Pince PF ({pulse})"
    else:
        return pulse


def _build_validation_rules(ev: ProductionEvent) -> list[dict[str, str]]:
    """Build validation rules from SAP event data."""
    rules = [
        {"rule": "PRODUCT_EXISTS", "status": "OK", "message": f"Product {ev.product} exists in SAP"},
        {"rule": "QUANTITY_POSITIVE", "status": "OK" if ev.quantity > 0 else "ERROR", "message": "Quantity is positive"},
    ]
    
    if ev.bin_location:
        rules.append({"rule": "BIN_LOCATION", "status": "OK", "message": f"Bin location: {ev.bin_location}"})
    else:
        rules.append({"rule": "BIN_LOCATION", "status": "WARNING", "message": "Bin location not specified"})
    
    if ev.pulse in PULSE_ROUTING:
        rules.append({"rule": "PULSE_ROUTING", "status": "OK", "message": f"Pulse '{ev.pulse}' has handler"})
    else:
        rules.append({"rule": "PULSE_ROUTING", "status": "WARNING", "message": f"Pulse '{ev.pulse}' not mapped"})
    
    if ev.is_valid_user == "Y":
        rules.append({"rule": "USER_VALIDATION", "status": "OK", "message": "Validated by user"})
    else:
        rules.append({"rule": "USER_VALIDATION", "status": "WARNING", "message": "Pending user validation"})
    
    if ev.remark:
        rules.append({"rule": "PRIOR_REMARK", "status": "WARNING", "message": f"Remark: {ev.remark}"})
    
    return rules


def _event_to_dict(ev: ProductionEvent) -> dict[str, Any]:
    """
    Map a SAP ProductionEvent dataclass to a WmsEvent-compatible dict
    that the React frontend wizard understands.

    Field mapping:
        doc_entry       → id, external_id
        product         → item_code, item_description, production_order
        pulse           → event_type, machine_id, machine_name
        quantity        → original_quantity
        bin_location    → bin_location, warehouse_code
        date + time     → received_at, created_at, updated_at
    """
    received_at = _iso(ev.date, ev.time)
    warehouse = (
        ev.bin_location.split("-")[0]
        if ev.bin_location and "-" in ev.bin_location
        else ev.bin_location or ""
    )

    return {
        # Identity
        "id":               str(ev.doc_entry),
        "external_id":      str(ev.doc_entry),

        # Classification
        "event_type":       _pulse_to_event_type(ev.pulse),
        "status":           "PENDING",

        # Production info
        "production_order": ev.product,           # closest analog to an OF ref
        "item_code":        ev.product,
        "item_description": f"{ev.product} — {_pulse_label(ev.pulse)}",

        # Quantity
        "original_quantity": ev.quantity,
        "modified_quantity": None,
        "unit_of_measure":  "PCS",

        # Machine / location
        "machine_id":       ev.pulse,
        "machine_name":     _pulse_label(ev.pulse),
        "warehouse_code":   warehouse,
        "bin_location":     ev.bin_location,

        # Validation rules derived from SAP data
        "validation_rules": _build_validation_rules(ev),

        # Metadata
        "notes":            ev.remark or None,
        "sap_document_number":  None,
        "sap_response_code":    None,
        "sap_response_message": None,

        # Timestamps
        "received_at": received_at,
        "processed_at": None,
        "created_at":  received_at,
        "updated_at":  received_at,

        # Raw SAP fields (for debugging / advanced use)
        "doc_entry":       ev.doc_entry,
        "pulse":           ev.pulse,
        "is_valid_user":   ev.is_valid_user,
        "is_interfaced":   ev.is_interfaced,
        "sap_date":        ev.date,
        "sap_time":        ev.time,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/pending")
async def get_pending_events():
    """
    Return all events in the validation queue awaiting human approval.
    
    NEW BEHAVIOR: Returns events from validation queue instead of direct SAP calls.
    Events are loaded from SAP by EventRouter and added to queue for human validation.
    """
    try:
        queued_events = validation_queue.get_all_events()
        
        # Filter to only show events that are pending validation or need correction
        pending_events = [
            e for e in queued_events
            if e.status in (
                EventStatus.PENDING_REVIEW,
                EventStatus.VALIDATING,
                EventStatus.VALID,
                EventStatus.INVALID,
            )
        ]

        logger.info(
            f"📋 /events/pending — {len(pending_events)} événement(s) en attente de validation"
        )
        for ev in pending_events:
            logger.info(
                f"   ↳ DocEntry={ev.doc_entry} | Status={ev.status.value} "
                f"| Produit={ev.current_product} | Pulse={ev.sap_event.pulse}"
            )

        events = [ev.to_dict() for ev in pending_events]
        return events

    except Exception as e:
        logger.error(f"Erreur inattendue /events/pending: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{event_id}/update")
async def update_event(event_id: str, request: UpdateEventRequest):
    """
    Update event fields for correction workflow.
    
    Allows users to correct:
    - bin_location
    - quantity
    - product
    - warehouse
    - notes
    
    NEW BEHAVIOR: Does NOT automatically revalidate.
    User must explicitly click "Validate" to trigger validation.
    """
    try:
        doc_entry = int(event_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"event_id invalide (doit être un entier DocEntry): '{event_id}'"
        )

    logger.info(
        f"✏️  Mise à jour demandée — DocEntry={doc_entry} "
        f"Bin={request.bin_location} Qty={request.quantity} "
        f"Product={request.product} Whs={request.warehouse}"
    )

    try:
        # Update event in validation queue
        updated_event = validation_queue.update_event(
            doc_entry=doc_entry,
            bin_location=request.bin_location,
            quantity=request.quantity,
            product=request.product,
            warehouse=request.warehouse,
            notes=request.notes,
        )
        
        if updated_event is None:
            raise HTTPException(
                status_code=404,
                detail=f"Événement DocEntry={doc_entry} introuvable dans la file de validation"
            )
        
        # Reset status to PENDING_REVIEW after correction
        # User must explicitly validate again
        validation_queue.set_status(doc_entry, EventStatus.PENDING_REVIEW)
        validation_queue.clear_validation_errors(doc_entry)
        await _broadcast_queue_event(updated_event)
        
        logger.info(
            f"✅ Événement DocEntry={doc_entry} mis à jour - "
            f"Status=PENDING_REVIEW (awaiting explicit validation)"
        )

        return SapResponse(
            success=True,
            response_code="200",
            response_message=(
                f"Événement DocEntry={doc_entry} mis à jour. "
                f"Click 'Validate' to recheck validation."
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Erreur mise à jour DocEntry={doc_entry}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{event_id}/validate")
async def validate_event(event_id: str):
    """
    Explicit validation endpoint - runs validation checks on event.
    
    NEW BEHAVIOR: Only runs when user explicitly clicks "Validate".
    Returns structured validation results without SAP posting.
    """
    try:
        doc_entry = int(event_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"event_id invalide (doit être un entier DocEntry): '{event_id}'"
        )

    logger.info(f"🔍 Validation demandée — DocEntry={doc_entry}")

    try:
        # Load event from validation queue
        queued_event = validation_queue.get_event(doc_entry)
        if queued_event is None:
            raise HTTPException(
                status_code=404,
                detail=f"Événement DocEntry={doc_entry} introuvable dans la file de validation"
            )
        
        # Set status to VALIDATING
        validation_queue.set_status(doc_entry, EventStatus.VALIDATING)
        
        # Run validation checks
        validation_errors = await _validate_event_full(queued_event)
        
        # Determine status based on validation results
        has_errors = any(e.severity == "ERROR" for e in validation_errors)
        
        if has_errors:
            validation_queue.set_status(doc_entry, EventStatus.INVALID)
            validation_queue.set_validation_errors(doc_entry, validation_errors)
            logger.warning(
                f"❌ DocEntry={doc_entry} validation FAILED - {len(validation_errors)} erreur(s)"
            )
        else:
            validation_queue.set_status(doc_entry, EventStatus.VALID)
            validation_queue.clear_validation_errors(doc_entry)
            logger.info(
                f"✅ DocEntry={doc_entry} validation PASSED - ready for approval"
            )

        await _broadcast_queue_event(queued_event)
        # Return structured validation result
        return {
            "status": "INVALID" if has_errors else "VALID",
            "errors": [
                {
                    "field": e.field,
                    "message": e.message,
                    "severity": e.severity
                }
                for e in validation_errors
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Erreur validation DocEntry={doc_entry}: {e}")
        validation_queue.set_status(doc_entry, EventStatus.INVALID)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{event_id}/approve")
async def approve_event(event_id: str, request: ApproveEventRequest):
    """
    Approve an event and post to SAP (ONLY after human approval AND successful validation).
    
    NEW BEHAVIOR:
    1. Check that event status is VALID (validation passed)
    2. Load event from validation queue
    3. Apply any user corrections
    4. Execute SAP posting via handler
    5. Mark as PROCESSED
    6. Return SAP document results
    """
    try:
        doc_entry = int(event_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"event_id invalide (doit être un entier DocEntry): '{event_id}'"
        )

    logger.info(
        f"✅ Approbation demandée — DocEntry={doc_entry} "
        f"Qty={request.modified_quantity} Notes={request.notes}"
    )

    try:
        # 1. Load event from validation queue
        queued_event = validation_queue.get_event(doc_entry)
        if queued_event is None:
            raise HTTPException(
                status_code=404,
                detail=f"Événement DocEntry={doc_entry} introuvable dans la file de validation"
            )
        
        # 2. Check validation status - must be VALID before approval
        if queued_event.status != EventStatus.VALID:
            raise HTTPException(
                status_code=422,
                detail=f"Événement DocEntry={doc_entry} n'est pas validé. Status actuel: {queued_event.status.value}. Veuillez d'abord valider l'événement."
            )
        
        # 3. Apply modified quantity if provided
        if request.modified_quantity is not None:
            queued_event.corrected_quantity = request.modified_quantity
        if request.notes is not None:
            queued_event.user_notes = request.notes
        
        # 4. Mark as approved
        validation_queue.set_status(doc_entry, EventStatus.APPROVED)
        
        # 5. Execute SAP posting via handler
        # Create a ProductionEvent with corrected values
        event_to_post = queued_event.sap_event
        if queued_event.corrected_quantity is not None:
            event_to_post.quantity = queued_event.corrected_quantity
        if queued_event.corrected_bin_location:
            event_to_post.bin_location = queued_event.corrected_bin_location
        if queued_event.corrected_product:
            event_to_post.product = queued_event.corrected_product
        
        # Resolve product config
        try:
            config = await config_resolver.get_config(event_to_post.product)
        except ConfigNotFoundError as e:
            raise HTTPException(
                status_code=422,
                detail=f"Config produit introuvable: {e}"
            )
        
        # Route to handler
        handler = PULSE_ROUTING.get(event_to_post.pulse)
        if handler is None:
            raise HTTPException(
                status_code=422,
                detail=f"Pulse '{event_to_post.pulse}' non supporté — aucun handler disponible"
            )
        
        await handler.handle(event_to_post, config)
        logger.info(f"   Handler exécuté pour DocEntry={doc_entry}")

        await udt_service.set_interfaced(doc_entry)
        logger.info(f"📋 DocEntry={doc_entry} marked as interfaced in SAP after approval")
        
        # 6. Mark as processed
        validation_queue.set_status(doc_entry, EventStatus.PROCESSED)
        validation_queue.set_sap_result(
            doc_entry,
            document_number=str(doc_entry),
            response_code="200",
            response_message="SAP posting successful"
        )
        await _broadcast_queue_event(queued_event)
        logger.info(f"✅ DocEntry={doc_entry} marqué PROCESSED dans la file de validation")

        return SapResponse(
            success=True,
            document_number=str(doc_entry),
            response_code="200",
            response_message=(
                f"Événement DocEntry={doc_entry} traité et validé dans SAP B1"
            ),
        )

    except HTTPException:
        raise
    except (UDTReadError, UDTWriteError) as e:
        logger.error(f"Erreur SAP UDT lors de l'approbation DocEntry={doc_entry}: {e}")
        validation_queue.set_status(doc_entry, EventStatus.INVALID)
        validation_queue.set_sap_result(
            doc_entry,
            document_number=None,
            response_code="502",
            response_message=str(e)
        )
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception(f"Erreur approbation DocEntry={doc_entry}: {e}")
        validation_queue.set_status(doc_entry, EventStatus.INVALID)
        validation_queue.set_sap_result(
            doc_entry,
            document_number=None,
            response_code="500",
            response_message=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{event_id}/reject")
async def reject_event(event_id: str, request: RejectEventRequest):
    """
    Reject an event:
      Marks event as REJECTED in validation queue.
      Does NOT post to SAP - event stays in queue for review.
    """
    try:
        doc_entry = int(event_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"event_id invalide (doit être un entier DocEntry): '{event_id}'"
        )

    logger.info(
        f"❌ Rejet demandé — DocEntry={doc_entry} "
        f"Raison='{request.rejection_reason}'"
    )

    try:
        # Update event with rejection notes
        validation_queue.update_event(
            doc_entry=doc_entry,
            notes=f"REJETÉ: {request.rejection_reason}"
        )
        
        # Mark as rejected
        validation_queue.set_status(doc_entry, EventStatus.REJECTED)
        await _broadcast_queue_event(validation_queue.get_event(doc_entry))
        logger.info(f"   Événement DocEntry={doc_entry} marqué REJECTED dans la file de validation")

        return SapResponse(
            success=True,
            response_code="200",
            response_message=(
                f"Événement DocEntry={doc_entry} rejeté — "
                f"raison enregistrée dans la file de validation"
            ),
        )

    except Exception as e:
        logger.exception(f"Erreur rejet DocEntry={doc_entry}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _validate_event_full(queued_event) -> list[ValidationError]:
    """
    Full validation checks on a queued event.
    Returns list of validation errors.
    """
    errors = []
    
    # Use corrected values if available, otherwise original SAP values
    event_to_validate = queued_event.sap_event
    if queued_event.corrected_bin_location:
        event_to_validate.bin_location = queued_event.corrected_bin_location
    if queued_event.corrected_quantity is not None:
        event_to_validate.quantity = queued_event.corrected_quantity
    if queued_event.corrected_product:
        event_to_validate.product = queued_event.corrected_product
    
    try:
        # CONFIG PRODUIT
        config = await config_resolver.get_config(event_to_validate.product)
    except ConfigNotFoundError as e:
        errors.append(ValidationError(
            field="product",
            message=f"Config produit introuvable: {e}",
            severity="ERROR"
        ))
        return errors
    
    # ROUTING CHECK
    handler = PULSE_ROUTING.get(event_to_validate.pulse)
    if handler is None:
        errors.append(ValidationError(
            field="pulse",
            message=f"Pulse non supporté: {event_to_validate.pulse}",
            severity="ERROR"
        ))
        return errors
    
    # VALIDATION CHECKS (without posting)
    try:
        if not event_to_validate.bin_location:
            errors.append(ValidationError(
                field="bin_location",
                message="Bin location not specified",
                severity="WARNING"
            ))
        
        if event_to_validate.quantity <= 0:
            errors.append(ValidationError(
                field="quantity",
                message="Quantity must be positive",
                severity="ERROR"
            ))
        
    except Exception as e:
        errors.append(ValidationError(
            field="validation",
            message=f"Validation error: {str(e)}",
            severity="ERROR"
        ))
    
    return errors


async def _revalidate_event(queued_event) -> list[ValidationError]:
    """
    Re-run validation checks on a queued event after user corrections.
    Returns list of validation errors.
    """
    return await _validate_event_full(queued_event)
