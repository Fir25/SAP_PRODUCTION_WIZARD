"""
handlers/pince_pf.py
====================
PincePF — Issue for Production (SF) + Receipt from Production (PF).

Mapping Pulse → champ config item_pf :
  PincePFV01  → item_pf_v1   (Vrac Supérieur)
  PincePFV02  → item_pf_v2   (Vrac Inférieur)
  PincePFE03  → item_pf_emb  (Emballé)


Flux :
  1. Résoudre Pulse → champ config → item_pf
  2. Valider bin_location → BinAbsEntry + warehouse
  3. Trouver l'OF Released pour item_pf
  4. Issue for Production  → consomme item_sf depuis le bin de l'événement
  5. Receipt from Production → reçoit item_pf dans le magasin de l'OF
"""

import logging
from datetime import datetime
from sap.models import (
    ProductionEvent, ProductConfig,
    IssuePayload, IssueLine,
    ReceiptPayload, ReceiptLine,
)
from sap.issue_service import issue_service, IssueCreationError
from sap.receipt_service import receipt_service, ReceiptCreationError
from sap.bin_validator import bin_validator, BinNotFoundError, BinValidationError
from sap.of_service import of_service, OFNotFoundError

logger = logging.getLogger(__name__)

# Mapping Pulse → attribut de ProductConfig contenant l'ItemCode PF
PULSE_MAP: dict[str, str] = {
    "PincePFV01": "item_pf_v1",
    "PincePFV02": "item_pf_v2",
    "PincePFE03": "item_pf_emb",
}


class PincePFHandler:

    async def handle(self, event: ProductionEvent, config: ProductConfig) -> None:

        # 1. RÉSOLUTION PULSE → item_pf
        item_attr = PULSE_MAP.get(event.pulse)
        if not item_attr:
            raise ValueError(
                f"Pulse inconnu : '{event.pulse}'. "
                f"Valeurs acceptées : {list(PULSE_MAP.keys())}"
            )

        item_pf: str  = getattr(config, item_attr)
        item_sf: str  = config.item_sf
        qty: float    = event.quantity

        event_date = event.date[:10] if event.date else ""
        today = datetime.now().strftime("%Y-%m-%d")
        doc_date = min(event_date, today) if event_date else today

        if not item_pf:
            raise ValueError(
                f"ItemCode PF vide pour pulse '{event.pulse}' "
                f"(champ '{item_attr}') dans @BMT_PROD"
            )
        if not item_sf:
            raise ValueError(
                f"ItemCode SF vide pour produit '{config.product}' dans @BMT_PROD"
            )

        logger.info(
            f"🔧 PincePF | Pulse={event.pulse} | "
            f"ItemPF={item_pf} | ItemSF={item_sf} | Qty={qty}"
        )

        # 2. VALIDATION BIN
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

        # 3. OF ACTIF pour item_pf
        try:
            of = await of_service.get_best_of(item_pf)
        except OFNotFoundError as e:
            raise ValueError(str(e)) from e

        logger.info(
            f"   OF sélectionné — AbsEntry:{of.abs_entry} "
            f"DocNum:{of.doc_num} Whs:{of.warehouse}"
        )

        # 4. ISSUE FOR PRODUCTION — consomme item_sf depuis le bin wagon
        try:
            issue_doc = await issue_service.create_issue(
                payload=IssuePayload(
                    doc_date=doc_date,
                    production_order=of.abs_entry,
                    lines=[IssueLine(
                        item_code=item_sf,
                        quantity=qty,
                        warehouse_code=warehouse,
                        bin_abs_entry=bin_abs_entry,
                    )],
                ),
                of_doc_entry=of.abs_entry,
            )
            logger.info(f"   Issue créé — DocEntry:{issue_doc}")
        except IssueCreationError as e:
            raise ValueError(f"Issue échoué : {e}") from e

        # 5. RECEIPT FROM PRODUCTION — reçoit item_pf dans le magasin de l'OF
        try:
            receipt_doc = await receipt_service.create_receipt(ReceiptPayload(
                doc_date=doc_date,
                production_order=of.abs_entry,
                lines=[ReceiptLine(
                    item_code=item_pf,
                    quantity=qty,
                    warehouse_code=of.warehouse,  # magasin défini dans l'OF
                    bin_abs_entry=None,            # pas de bin cible pour le PF
                )],
            ))
            logger.info(f"   Receipt créé — DocEntry:{receipt_doc}")
        except ReceiptCreationError as e:
            raise ValueError(f"Receipt échoué : {e}") from e

        logger.info(
            f"✅ PincePF complet | OF={of.abs_entry} | "
            f"ItemPF={item_pf} | ItemSF={item_sf} | Qty={qty}"
        )


pince_pf_handler = PincePFHandler()