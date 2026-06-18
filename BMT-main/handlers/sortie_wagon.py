"""
handlers/sortie_wagon.py
========================
SortieWagon — Receipt from Production du semi-fini (SF).

Flux :
  1. Valider bin_location → BinAbsEntry + warehouse
  2. Trouver l'OF Released pour item_sf (ex: B12SF)
  3. Receipt from Production → entrée item_sf dans le bin wagon (B4WAG)

Quantité : saisie directement par l'utilisateur (briques), sans conversion.
"""

import logging
from datetime import datetime
from sap.models import ProductionEvent, ProductConfig, ReceiptPayload, ReceiptLine
from sap.receipt_service import receipt_service, ReceiptCreationError
from sap.bin_validator import bin_validator, BinNotFoundError, BinValidationError
from sap.of_service import of_service, OFNotFoundError

logger = logging.getLogger(__name__)


class SortieWagonHandler:

    async def handle(self, event: ProductionEvent, config: ProductConfig) -> None:

        event_date = event.date[:10] if event.date else ""
        today = datetime.now().strftime("%Y-%m-%d")
        doc_date = min(event_date, today) if event_date else today
        
        qty: float    = event.quantity

        logger.info(
            f" P001 | Produit={event.product} "
            f"| ItemSF={config.item_sf} "
            f"| Bin={event.bin_location} "
            f"| Qty={qty}"
        )

        # 1. Valider le bin location
        try:
            bin_abs_entry = await bin_validator.validate(event.bin_location)
        except (BinNotFoundError, BinValidationError) as e:
            raise ValueError(f"Bin invalide : {e}") from e

        # Le warehouse est le préfixe avant le premier tiret (ex: B4WAG-W001 → B4WAG)
        warehouse = (
            event.bin_location.split("-")[0]
            if "-" in event.bin_location
            else event.bin_location
        )
        logger.info(
            f"   Bin validé — {event.bin_location} "
            f"AbsEntry:{bin_abs_entry} Whs:{warehouse}"
        )

        # 2. Trouver l'OF Released pour item_sf — prefer best match by event date
        try:
            ev_date = event.date if getattr(event, 'date', None) else None
            ev_time = event.time if getattr(event, 'time', None) else None
            # If event already contains an of_numdoc selected, try to honor it
            if getattr(event, 'of_numdoc', None):
                try:
                    candidate_ofs = await of_service.get_released_ofs(config.item_sf)
                    of = next((o for o in candidate_ofs if str(o.doc_num) == str(event.of_numdoc) or str(o.abs_entry) == str(event.of_numdoc)), None)
                    meta = {"reason": "selected_by_event"} if of else {}
                except Exception:
                    of = None
                    meta = {}
            else:
                res = await of_service.get_best_of_for_event(config.item_sf, ev_date, ev_time)
                of = res.get('best_of')
                meta = res.get('metadata', {})
        except OFNotFoundError as e:
            raise ValueError(str(e)) from e

        logger.info(
            f"   OF sélectionné — AbsEntry:{of.abs_entry} "
            f"DocNum:{of.doc_num} ItemSF:{config.item_sf}"
        )

        # 3. Receipt from Production — entrée SF dans le bin wagon
        try:
            receipt_doc = await receipt_service.create_receipt(ReceiptPayload(
                doc_date=doc_date,
                production_order=of.abs_entry,
                lines=[ReceiptLine(
                    item_code=config.item_sf,    # obligatoire pour cibler le bon article
                    quantity=qty,
                    warehouse_code=warehouse,
                    bin_abs_entry=bin_abs_entry,
                )],
            ))
        except ReceiptCreationError as e:
            raise ValueError(f"Receipt échoué : {e}") from e

        logger.info(
            f" P001 complet "
            f"| Receipt DocEntry:{receipt_doc} "
            f"| ItemSF:{config.item_sf} "
            f"| OF:{of.abs_entry} "
            f"| Qty:{qty} "
            f"| Bin:{event.bin_location}"
        )


sortie_wagon_handler = SortieWagonHandler()