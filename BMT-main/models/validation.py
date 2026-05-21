"""
models/validation.py
====================
Event validation status and queue models for human validation workflow.
"""

from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from sap.models import ProductionEvent


class EventStatus(str, Enum):
    """Event status for human-in-the-loop validation workflow."""
    PENDING_REVIEW = "PENDING_REVIEW"        # Event loaded from SAP, awaiting human review
    PENDING_VALIDATION = "PENDING_REVIEW"
    VALIDATING = "VALIDATING"                # Validation in progress
    VALID = "VALID"                          # Validation passed, ready for approval
    INVALID = "INVALID"                      # Validation failed, needs correction
    NEEDS_CORRECTION = "INVALID"
    APPROVED = "APPROVED"                    # Approved by user, ready for SAP posting
    PROCESSED = "PROCESSED"                  # Successfully posted to SAP
    REJECTED = "REJECTED"                    # Rejected by user


@dataclass
class ValidationError:
    """Structured validation error."""
    field: str
    message: str
    severity: str  # "ERROR", "WARNING", "INFO"


@dataclass
class QueuedEvent:
    """Event in validation queue with human correction capabilities."""
    # Original SAP event data
    sap_event: ProductionEvent
    
    # Validation state
    status: EventStatus = EventStatus.PENDING_REVIEW
    validation_errors: List[ValidationError] = field(default_factory=list)
    
    # User corrections (editable fields)
    corrected_bin_location: Optional[str] = None
    corrected_quantity: Optional[float] = None
    corrected_product: Optional[str] = None
    corrected_warehouse: Optional[str] = None
    user_notes: Optional[str] = None
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    validated_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    
    # SAP posting results
    sap_document_number: Optional[str] = None
    sap_response_code: Optional[str] = None
    sap_response_message: Optional[str] = None
    
    @property
    def doc_entry(self) -> int:
        """Get DocEntry from SAP event."""
        return self.sap_event.doc_entry
    
    @property
    def current_bin_location(self) -> str:
        """Get current bin location (corrected if set, otherwise original)."""
        return self.corrected_bin_location or self.sap_event.bin_location
    
    @property
    def current_quantity(self) -> float:
        """Get current quantity (corrected if set, otherwise original)."""
        return self.corrected_quantity if self.corrected_quantity is not None else self.sap_event.quantity
    
    @property
    def current_product(self) -> str:
        """Get current product (corrected if set, otherwise original)."""
        return self.corrected_product or self.sap_event.product

    @property
    def api_status(self) -> str:
        """Map internal workflow status to frontend-friendly status values."""
        mapping = {
            EventStatus.PENDING_REVIEW: "PENDING",
            EventStatus.VALIDATING: "PENDING",
            EventStatus.VALID: "PENDING",
            EventStatus.INVALID: "ERROR",
            EventStatus.APPROVED: "APPROVED",
            EventStatus.PROCESSED: "APPROVED",
            EventStatus.REJECTED: "REJECTED",
        }
        return mapping.get(self.status, "PENDING")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        def _iso(date_str: str, time_str: str = "") -> str:
            try:
                if time_str:
                    combined = f"{date_str} {time_str}"
                    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d %H%M%S", "%Y-%m-%d %H%M"):
                        try:
                            dt = datetime.strptime(combined, fmt)
                            return dt.isoformat()
                        except Exception:
                            continue
                    try:
                        return datetime.fromisoformat(combined.replace(' ', 'T')).isoformat()
                    except Exception:
                        return datetime.utcnow().isoformat()
                else:
                    return datetime.strptime(date_str, "%Y-%m-%d").isoformat()
            except Exception:
                return datetime.utcnow().isoformat()

        received_at = _iso(self.sap_event.date, self.sap_event.time)

        return {
            "id": str(self.sap_event.doc_entry),
            "external_id": str(self.sap_event.doc_entry),
            "status": self.api_status,
            "production_order": self.current_product,
            "item_code": self.current_product,
            "item_description": f"{self.current_product} — {self.sap_event.pulse}",
            "original_quantity": self.sap_event.quantity,
            "modified_quantity": self.corrected_quantity,
            "unit_of_measure": "PCS",
            "machine_id": self.sap_event.pulse,
            "machine_name": self.sap_event.pulse,
            "warehouse_code": self.corrected_warehouse or (
                self.sap_event.bin_location.split("-")[0] 
                if self.sap_event.bin_location and "-" in self.sap_event.bin_location 
                else self.sap_event.bin_location or ""
            ),
            "bin_location": self.current_bin_location,
            "validation_rules": [
                {
                    "rule": error.field,
                    "status": error.severity,
                    "message": error.message
                }
                for error in self.validation_errors
            ],
            "notes": self.user_notes or self.sap_event.remark,
            "received_at": received_at,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "sap_document_number": self.sap_document_number,
            "sap_response_code": self.sap_response_code,
            "sap_response_message": self.sap_response_message,
            # Raw SAP fields
            "doc_entry": self.sap_event.doc_entry,
            "pulse": self.sap_event.pulse,
            "is_valid_user": self.sap_event.is_valid_user,
            "is_interfaced": self.sap_event.is_interfaced,
            "sap_date": self.sap_event.date,
            "sap_time": self.sap_event.time,
        }
