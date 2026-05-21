"""
sap/issue_service.py
====================
Issue for Production (SF consumption)
Endpoint : POST /InventoryGenExits
Structure : BaseEntry + BaseLine + Quantity + WarehouseCode (sans ItemCode ni BaseType)
"""

import logging
from sap.session import sap_session
from sap.models import IssuePayload

logger = logging.getLogger(__name__)


class IssueService:

    async def create_issue(self, payload: IssuePayload, of_doc_entry: int) -> int:
        body = self._build_body(payload, of_doc_entry)
        logger.info(f"Payload Issue for Production SAP: {body}")

        async with await sap_session.get_client() as client:
            response = await client.post("/InventoryGenExits", json=body)

        if response.status_code not in (200, 201):
            raise IssueCreationError(
                f"Erreur création Issue for Production "
                f"(HTTP {response.status_code}): {response.text}"
            )

        data = response.json()
        doc_entry = data.get("DocEntry")
        doc_num = data.get("DocNum")

        logger.info(f"📤 Issue for Production créé — DocEntry:{doc_entry} DocNum:{doc_num}")
        return doc_entry

    @staticmethod
    def _build_body(payload: IssuePayload, of_doc_entry: int) -> dict:
        lines = []

        for i, line in enumerate(payload.lines):
            entry = {
                "LineNum":       i,
                "BaseEntry":     of_doc_entry,
                "BaseLine":      i,           # 0 = première ligne BOM (B12SF)
                "Quantity":      float(line.quantity),
                "WarehouseCode": line.warehouse_code,
            }

            if line.bin_abs_entry is not None and line.quantity > 0:
                entry["DocumentLinesBinAllocations"] = [
                    {
                        "BinAbsEntry":           line.bin_abs_entry,
                        "Quantity":              float(line.quantity),
                        "BaseLineNumber":        i,
                        "AllowNegativeQuantity": "tNO",
                    }
                ]

            lines.append(entry)

        return {
            "DocDate":       payload.doc_date,
            "DocumentLines": lines,
        }


class IssueCreationError(Exception):
    pass


issue_service = IssueService()