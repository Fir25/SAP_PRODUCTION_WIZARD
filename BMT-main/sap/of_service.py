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
        # Backwards-compatible: if called without event_date, pick the latest by DocumentNumber
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

    def choose_best_of(self, event_date: str | None, ofs: list[ProductionOrder]) -> tuple[ProductionOrder | None, dict]:
        """
        Choose the best OF based on proximity of creation date to the event_date.
        Returns (best_of, metadata) where metadata contains selection reason and date diffs.
        """
        metadata: dict = {"candidates": [], "selected": None, "reason": None}
        if not ofs:
            metadata["reason"] = "no_candidates"
            return (None, metadata)

        # Parse event_date to comparable YYYY-MM-DD if provided
        try:
            if event_date:
                ev_date = event_date[:10]
            else:
                ev_date = None
        except Exception:
            ev_date = None

        best = None
        best_diff = None
        for o in ofs:
            # Creation date may be in various formats; take first 10 chars
            o_date = (o.create_date or '')[:10]
            diff = None
            if ev_date and o_date:
                try:
                    from datetime import datetime
                    d_ev = datetime.fromisoformat(ev_date)
                    d_o = datetime.fromisoformat(o_date)
                    diff = abs((d_ev - d_o).days)
                except Exception:
                    diff = None

            metadata["candidates"].append({
                "abs_entry": o.abs_entry,
                "doc_num": o.doc_num,
                "create_date": o_date,
                "diff_days": diff,
            })

            if diff is None:
                # fallback to first available
                if best is None:
                    best = o
                    best_diff = diff
            else:
                if best_diff is None or (diff < best_diff):
                    best = o
                    best_diff = diff

        if best is None:
            best = ofs[0]
            metadata["reason"] = "fallback_latest"
        else:
            metadata["reason"] = "closest_by_date"

        metadata["selected"] = {"abs_entry": best.abs_entry, "doc_num": best.doc_num, "diff_days": best_diff}
        return (best, metadata)

    async def get_best_of_for_event(self, item_code: str, event_date: str | None) -> tuple[ProductionOrder, dict]:
        """
        Fetch released OFs for given item_code and choose the best match for the provided event_date.
        Returns (ProductionOrder, metadata).
        """
        ofs = await self.get_released_ofs(item_code)
        if not ofs:
            raise OFNotFoundError(f"Aucun OF Released trouvé pour ItemCode='{item_code}'")

        best, metadata = self.choose_best_of(event_date, ofs)

        logger.info(
            f"   OF best-match — Item={item_code} Selected={getattr(best, 'doc_num', None)} "
            f"Reason={metadata.get('reason')} Diff={metadata.get('selected', {}).get('diff_days') if metadata.get('selected') else None}"
        )
        return (best, metadata)

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