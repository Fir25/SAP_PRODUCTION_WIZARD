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
from sap.of_service import of_service
from sap.session import sap_session
from sap.config_service import config_service
from core.config_resolver import config_resolver, ConfigNotFoundError
from core.validation_queue import validation_queue
from core.websocket_manager import websocket_manager
from models.validation import EventStatus, ValidationError
from handlers.pince_pf import pince_pf_handler
from handlers.sortie_wagon import sortie_wagon_handler
from core.dynamic_pulse_router import resolve_handler
from handlers.generic_handlers import GenericProductionHandler
import core.event_router as event_router

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

# Pulse routing is loaded dynamically from core.event_router.PULSE_ROUTING


class ApproveEventRequest(BaseModel):
    modified_quantity: float
    notes: Optional[str] = None


class RejectEventRequest(BaseModel):
    rejection_reason: str
    notes: Optional[str] = None


class UpdateEventRequest(BaseModel):
    """Request model for updating event fields (correction workflow)."""
    production_order: Optional[str] = None
    item_code: Optional[str] = None
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


async def map_production_event_to_api(event: ProductionEvent) -> dict:
    """
    Map SAP ProductionEvent to frontend-compatible API format.
    
    Maps SAP UDT fields to the WmsEvent interface expected by the React frontend.
    """
    # Determine event type based on dynamic routing (resolve handler dynamically)
    try:
        handler = await resolve_handler(event.pulse)
    except Exception:
        handler = None

    if handler is sortie_wagon_handler:
        event_type = "PRODUCTION_RECEIPT"
    elif handler is pince_pf_handler:
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
    
    # Add pulse routing validation (clear error if no handler assigned)
    # Resolve handler and provide rule status
    try:
        h = await resolve_handler(event.pulse)
        if isinstance(h, GenericProductionHandler):
            validation_rules.append({"rule": "PULSE_ROUTING", "status": "WARNING",
                           "message": f"Pulse '{event.pulse}' resolved to GenericHandler (no specialized logic)"})
        else:
            validation_rules.append({"rule": "PULSE_ROUTING", "status": "OK",
                           "message": f"Pulse '{event.pulse}' → handler disponible"})
    except Exception:
        validation_rules.append({"rule": "PULSE_ROUTING", "status": "WARNING",
                       "message": f"Pulse '{event.pulse}' non supporté — fallback GenericHandler utilisé"})

    # Add prior remark validation
    if event.remark:
        validation_rules.append({"rule": "PRIOR_REMARK", "status": "WARNING",
                       "message": f"Remarque SAP : {event.remark}"})
    
    # Combine date and time for received_at with robust parsing
    received_at = _iso(event.date, event.time)
    
    production_order_val = event.of_numdoc if getattr(event, 'of_numdoc', None) else None

    return {
        "id": str(event.doc_entry),
        "external_id": f"SAP-{event.doc_entry}",
        "event_type": event_type,
        "status": status,
        "production_order": production_order_val,
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


async def _pulse_to_event_type(pulse: str) -> str:
    """Map pulse code to event type by resolving handler."""
    try:
        handler = await resolve_handler(pulse)
    except Exception:
        handler = None
    if handler is sortie_wagon_handler:
        return "PRODUCTION_RECEIPT"
    if handler is pince_pf_handler:
        return "MATERIAL_CONSUMPTION"
    return "UNKNOWN"


async def _pulse_label(pulse: str) -> str:
    """Get human-readable label for pulse by resolving handler."""
    try:
        handler = await resolve_handler(pulse)
    except Exception:
        handler = None
    if handler is sortie_wagon_handler:
        return "Sortie Wagon"
    if handler is pince_pf_handler:
        return f"Pince PF ({pulse})"
    return pulse


async def _build_validation_rules(ev: ProductionEvent) -> list[dict[str, str]]:
    """Build validation rules from SAP event data."""
    rules = [
        {"rule": "PRODUCT_EXISTS", "status": "OK", "message": f"Product {ev.product} exists in SAP"},
        {"rule": "QUANTITY_POSITIVE", "status": "OK" if ev.quantity > 0 else "ERROR", "message": "Quantity is positive"},
    ]
    
    if ev.bin_location:
        rules.append({"rule": "BIN_LOCATION", "status": "OK", "message": f"Bin location: {ev.bin_location}"})
    else:
        rules.append({"rule": "BIN_LOCATION", "status": "WARNING", "message": "Bin location not specified"})
    
    try:
        h = await resolve_handler(ev.pulse)
        if isinstance(h, GenericProductionHandler):
            rules.append({"rule": "PULSE_ROUTING", "status": "WARNING", "message": f"Pulse '{ev.pulse}' mapped to GenericHandler"})
        else:
            rules.append({"rule": "PULSE_ROUTING", "status": "OK", "message": f"Pulse '{ev.pulse}' has handler"})
    except Exception:
        rules.append({"rule": "PULSE_ROUTING", "status": "WARNING", "message": f"Pulse '{ev.pulse}' not mapped (error resolving)"})
    
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
        "production_order": ev.of_numdoc if getattr(ev, 'of_numdoc', None) else None,
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
        # Build lookup of pulse metadata from SAP
        pulses = await config_service.get_pulses()
        pulses_lookup = {p.get('Code'): p for p in pulses}

        events = []
        for ev in pending_events:
            pulse_code = ev.sap_event.pulse
            pulse_info = pulses_lookup.get(pulse_code)
            logger.info(
                f"   ↳ DocEntry={ev.doc_entry} | Status={ev.status.value} "
                f"| Produit={ev.current_product} | Pulse={pulse_code}"
            )

            ev_dict = ev.to_dict()
            # attach pulse metadata for frontend
            if pulse_info:
                ev_dict['pulse_code'] = pulse_info.get('Code')
                ev_dict['pulse_name'] = pulse_info.get('Name')
                ev_dict['pulse_rubrique'] = pulse_info.get('U_Rubrique') or pulse_info.get('u_rubrique')
                ev_dict['pulse_uom'] = pulse_info.get('U_uom') or pulse_info.get('u_uom')
            else:
                ev_dict['pulse_code'] = pulse_code
                ev_dict['pulse_name'] = None
                ev_dict['pulse_rubrique'] = None
                ev_dict['pulse_uom'] = None

            # Enrich with best OF suggestion (non-blocking)
            try:
                ev_date = ev.sap_event.date if getattr(ev.sap_event, 'date', None) else None
                best_of, meta = await of_service.get_best_of_for_event(ev.sap_event.product, ev_date)
                ev_dict["best_production_order"] = str(best_of.doc_num) if best_of else None
                ev_dict["production_order_source"] = "best_match" if meta.get("reason") == "closest_by_date" else "released"
                ev_dict["best_of_meta"] = meta
            except Exception:
                ev_dict["best_production_order"] = None
                ev_dict["production_order_source"] = None

            events.append(ev_dict)

        return events

    except Exception as e:
        logger.error(f"Erreur inattendue /events/pending: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metadata")
async def get_events_metadata():
    """
    Return unique event types (pulse codes) and products from the validation queue.
    Used to populate dropdown filters in the wizard frontend.
    """
    try:
        queued_events = validation_queue.get_all_events()
        
        # Extract unique pulse codes (event types)
        pulse_codes = sorted(list(set(e.sap_event.pulse for e in queued_events)))
        
        # Extract unique products
        products = sorted(list(set(e.sap_event.product for e in queued_events)))
        
        logger.info(
            f"📋 /events/metadata — {len(pulse_codes)} pulse codes, "
            f"{len(products)} products"
        )
        
        return {
            "event_types": pulse_codes,
            "products": products,
        }
    
    except Exception as e:
        logger.error(f"Erreur inattendue /events/metadata: {e}")
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
        f"OF={request.production_order} Item={request.item_code} "
        f"Bin={request.bin_location} Qty={request.quantity} "
        f"Product={request.product} Whs={request.warehouse}"
    )

    try:
        # Validate provided production_order (OF) exists in SAP if user supplied one
        if request.production_order:
            async with await sap_session.get_client() as client:
                found = False
                # Try numeric AbsoluteEntry first (AbsoluteEntry is the internal key)
                if str(request.production_order).isdigit():
                    try:
                        resp = await client.get(f"/ProductionOrders({int(request.production_order)})")
                    except Exception as e:
                        logger.exception(f"SAP request failed when checking AbsoluteEntry={request.production_order}")
                        raise HTTPException(status_code=502, detail=f"Erreur vérification OF dans SAP: {e}")

                    if resp.status_code == 200:
                        found = True
                    elif resp.status_code not in (404,):
                        logger.error(
                            f"Unexpected SAP response when checking AbsoluteEntry={request.production_order}: HTTP {resp.status_code} {resp.text}"
                        )
                        raise HTTPException(status_code=502, detail=f"Erreur vérification OF dans SAP: HTTP {resp.status_code} {resp.text}")

                if not found:
                    # Try by DocumentNumber filter (DocumentNumber is numeric in SAP)
                    try:
                        if str(request.production_order).isdigit():
                            filter_q = f"$filter=DocumentNumber eq {int(request.production_order)}"
                        else:
                            filter_q = f"$filter=DocumentNumber eq '{request.production_order}'"
                        resp = await client.get(f"/ProductionOrders?{filter_q}")
                    except Exception as e:
                        logger.exception(f"SAP request failed when searching ProductionOrders by DocumentNumber='{request.production_order}'")
                        raise HTTPException(status_code=502, detail=f"Erreur vérification OF dans SAP: {e}")

                    if resp.status_code == 200:
                        try:
                            data = resp.json()
                        except Exception as e:
                            logger.exception(f"Failed to parse SAP response JSON when checking DocumentNumber='{request.production_order}': {resp.text}")
                            raise HTTPException(status_code=502, detail=f"Erreur vérification OF dans SAP: invalid JSON response: {resp.text}")

                        if data.get('value'):
                            found = True
                    else:
                        logger.error(
                            f"Unexpected SAP response when searching DocumentNumber='{request.production_order}': HTTP {resp.status_code} {resp.text}"
                        )
                        raise HTTPException(status_code=502, detail=f"Erreur vérification OF dans SAP: HTTP {resp.status_code} {resp.text}")

                if not found:
                    raise HTTPException(status_code=422, detail=f"Production Order '{request.production_order}' not found in SAP")

        # Update event in validation queue (persist corrections to SAP)
        try:
            updated_event = await validation_queue.update_event(
                doc_entry=doc_entry,
                bin_location=request.bin_location,
                quantity=request.quantity,
                product=request.product,
                warehouse=request.warehouse,
                production_order=request.production_order,
                notes=request.notes,
            )
        except UDTWriteError as e:
            logger.error(f"SAP update failed for DocEntry={doc_entry}: {e}")
            raise HTTPException(status_code=502, detail=str(e))
        
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
    Validate an event BEFORE approval.

    Workflow:
    PENDING_REVIEW
    → VALIDATION
    → VALID
    → APPROVE ALLOWED
    """

    try:
        doc_entry = int(event_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"event_id invalide: '{event_id}'"
        )

    logger.info(f"🔍 Validation demandée — DocEntry={doc_entry}")

    try:

        # =========================================================
        # 1. LOAD EVENT FROM VALIDATION QUEUE
        # =========================================================
        queued_event = validation_queue.get_event(doc_entry)

        if queued_event is None:
            raise HTTPException(
                status_code=404,
                detail=f"Événement DocEntry={doc_entry} introuvable"
            )

        logger.info(
            f"📋 Event trouvé — Status actuel: {queued_event.status}"
        )

        # =========================================================
        # 2. VALIDATION RULES
        # =========================================================
        errors = []

        # Validate quantity
        quantity = (
            queued_event.corrected_quantity
            if queued_event.corrected_quantity is not None
            else queued_event.sap_event.quantity
        )

        if quantity <= 0:
            errors.append("La quantité doit être supérieure à 0")

        # Validate bin location
        bin_location = (
            queued_event.corrected_bin_location
            if queued_event.corrected_bin_location
            else queued_event.sap_event.bin_location
        )

        if not bin_location:
            errors.append("Bin Location obligatoire")

        # Validate product
        product = (
            queued_event.corrected_product
            if queued_event.corrected_product
            else queued_event.sap_event.product
        )

        if not product:
            errors.append("Produit obligatoire")

        # =========================================================
        # 3. VALIDATION FAILED
        # =========================================================
        if errors:

            validation_queue.set_status(
                doc_entry,
                EventStatus.INVALID
            )

            logger.warning(
                f"❌ Validation échouée — DocEntry={doc_entry} "
                f"Errors={errors}"
            )

            return {
                "status": "INVALID",
                "errors": errors
            }

        # =========================================================
        # 4. VALIDATION SUCCESS
        # =========================================================

        # IMPORTANT !!!
        # THIS FIXES YOUR BUG
        validation_queue.set_status(
            doc_entry,
            EventStatus.VALID
        )

        logger.info(
            f"✅ DocEntry={doc_entry} status changé vers VALID"
        )

        # Optional websocket refresh
        try:
            await _broadcast_queue_event(queued_event)
        except Exception:
            pass

        # =========================================================
        # 5. RETURN SUCCESS
        # =========================================================
        return {
            "status": "VALID",
            "errors": []
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(
            f"❌ Erreur validation DocEntry={doc_entry}: {e}"
        )

        validation_queue.set_status(
            doc_entry,
            EventStatus.INVALID
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


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
        
        # 4. Mark as approved (log old/new status and user action)
        old_status = queued_event.status
        logger.info(f"User action=APPROVE — DocEntry={doc_entry} OldStatus={old_status.value} NewStatus={EventStatus.APPROVED.value}")
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
        
        # Route to handler (resolve dynamically)
        handler = await resolve_handler(event_to_post.pulse)
        logger.info(f"Resolved handler for Pulse={event_to_post.pulse}: {handler.__class__.__name__ if hasattr(handler,'__class__') else getattr(handler,'__name__',str(handler))}")
        await handler.handle(event_to_post, config)
        logger.info(f"   Handler exécuté pour DocEntry={doc_entry}")

        # 6. Mark as interfaced in SAP AFTER successful SAP posting
        await udt_service.set_interfaced(doc_entry)
        logger.info(f"✅ DocEntry={doc_entry} marqué Is_Interfaced=Y dans SAP après approbation")
        
        # 7. Mark as processed in validation queue
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
        await validation_queue.update_event(
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
    
    # ROUTING CHECK — resolve dynamically and convert missing mapping into a WARNING via Generic handler
    try:
        handler = await resolve_handler(event_to_validate.pulse)
    except Exception as e:
        errors.append(ValidationError(
            field="pulse",
            message=f"Erreur résolution pulse: {e}",
            severity="ERROR"
        ))
        return errors

    # If resolved to generic fallback, warn but do not fail validation
    if isinstance(handler, GenericProductionHandler):
        errors.append(ValidationError(
            field="pulse",
            message=f"Pulse non spécialisé: {event_to_validate.pulse} (utilisation GenericHandler)",
            severity="WARNING"
        ))
    
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
