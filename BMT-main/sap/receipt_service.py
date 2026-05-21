"""
sap/receipt_service.py
======================
Création d'un document Receipt from Production (PF ou SF).
POST /InventoryGenEntries
"""

import logging
from sap.session import sap_session
from sap.models import ReceiptPayload

logger = logging.getLogger(__name__)


class ReceiptService:

    async def create_receipt(self, payload: ReceiptPayload) -> int:
        body = self._build_body(payload)
        logger.info(f" Payload Receipt SAP: {body}")

        async with await sap_session.get_client() as client:
            response = await client.post("/InventoryGenEntries", json=body)

        if response.status_code not in (200, 201):
            raise ReceiptCreationError(
                f"Erreur création Receipt from Production "
                f"(HTTP {response.status_code}): {response.text}"
            )

        data = response.json()
        doc_entry = data.get("DocEntry")
        doc_num = data.get("DocNum")

        logger.info(
            f"📥 Receipt créé — DocEntry:{doc_entry} DocNum:{doc_num} "
            f"| OF:{payload.production_order}"
        )
        return doc_entry

    @staticmethod
    def _build_body(payload: ReceiptPayload) -> dict:
        lines = []

        for i, line in enumerate(payload.lines):
            entry = {
                "LineNum": i,
                "Quantity": float(line.quantity),
                "WarehouseCode": line.warehouse_code,
                "BaseType": 202,
                "BaseEntry": payload.production_order,
            }

            # ⚠️ IMPORTANT : bin allocations simplifiées SAP B1 compliant
            if line.bin_abs_entry is not None and line.quantity > 0:
                entry["DocumentLinesBinAllocations"] = [
                    {
                        "BinAbsEntry": line.bin_abs_entry,
                        "Quantity": float(line.quantity),
                        "BaseLineNumber": i,
                        "AllowNegativeQuantity": "tNO",
                    }
                ]

            lines.append(entry)

        return {
            "DocDate": payload.doc_date,
            "DocumentLines": lines,
        }


class ReceiptCreationError(Exception):
    pass


receipt_service = ReceiptService()