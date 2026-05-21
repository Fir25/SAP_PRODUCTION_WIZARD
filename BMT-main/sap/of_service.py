"""
sap/of_service.py
=================
Recherche des OFs Released dans SAP B1.

Statut Released   = 'boposReleased'
Champ statut SAP  = ProductionOrderStatus
Champ entrepôt    = Warehouse  (nom réel dans SAP B1 FP2508 Service Layer ;
Tri               : DocumentNumber desc → dernier OF ouvert en premier
"""

import logging
import time
from sap.session import sap_session
from sap.models import ProductionOrder

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60
TOP_OF = 3


class OFService:

    def __init__(self):
        self._cache: dict[str, tuple[float, list[ProductionOrder]]] = {}

    async def get_released_ofs(
        self,
        item_code: str,
        force_refresh: bool = False,
    ) -> list[ProductionOrder]:
        now = time.time()
        cached = self._cache.get(item_code)

        if not force_refresh and cached:
            ts, ofs = cached
            if now - ts < CACHE_TTL_SECONDS:
                logger.debug(f"Cache OF valide pour {item_code} ({len(ofs)} OF(s))")
                return ofs

        ofs = await self._fetch_released_ofs(item_code)
        self._cache[item_code] = (now, ofs)
        return ofs

    async def get_best_of(self, item_code: str) -> ProductionOrder:
        ofs = await self.get_released_ofs(item_code)
        if not ofs:
            raise OFNotFoundError(
                f"Aucun OF Released trouvé pour ItemCode='{item_code}'"
            )
        best = ofs[0]
        logger.info(
            f"   OF sélectionné — AbsEntry:{best.abs_entry} "
            f"DocNum:{best.doc_num} Whs:{best.warehouse} "
            f"(parmi {len(ofs)} OF(s) Released)"
        )
        return best

    def invalidate_cache(self, item_code: str | None = None) -> None:
        if item_code:
            self._cache.pop(item_code, None)
        else:
            self._cache.clear()

    async def _fetch_released_ofs(self, item_code: str) -> list[ProductionOrder]:
        filter_q = (
            f"$filter=ProductionOrderStatus eq 'boposReleased'"
            f" and ItemNo eq '{item_code}'"
            f"&$orderby=DocumentNumber desc"
            f"&$top={TOP_OF}"
            f"&$select=AbsoluteEntry,DocumentNumber,ItemNo,"
            f"PlannedQuantity,ProductionOrderStatus,CreationDate,Warehouse"
        )

        async with await sap_session.get_client() as client:
            response = await client.get(f"/ProductionOrders?{filter_q}")

        if response.status_code != 200:
            raise OFFetchError(
                f"Erreur lecture OFs pour '{item_code}' "
                f"(HTTP {response.status_code}): {response.text}"
            )

        raw_list = response.json().get("value", [])
        ofs = [self._parse_of(r) for r in raw_list]
        logger.info(f"🏭 {len(ofs)} OF(s) Released trouvé(s) pour {item_code}")
        return ofs

    @staticmethod
    def _parse_of(raw: dict) -> ProductionOrder:
        return ProductionOrder(
            abs_entry=raw.get("AbsoluteEntry", 0),
            doc_num=raw.get("DocumentNumber", 0),
            item_code=raw.get("ItemNo", ""),
            planned_qty=float(raw.get("PlannedQuantity") or 0),
            status=raw.get("ProductionOrderStatus", ""),
            create_date=raw.get("CreationDate", ""),
            warehouse=raw.get("Warehouse", ""),
        )


class OFNotFoundError(Exception):
    pass


class OFFetchError(Exception):
    pass


of_service = OFService()