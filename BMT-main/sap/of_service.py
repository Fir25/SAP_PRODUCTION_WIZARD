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

    def choose_best_of(self, event_date: str | None, event_time: str | None, ofs: list[ProductionOrder]) -> tuple[ProductionOrder | None, dict]:
        """
        Choose the best OF based on proximity of creation datetime to the event datetime.
        Returns (best_of, metadata) where metadata contains selection reason and minute diffs.
        """
        metadata: dict = {"candidates": [], "selected": None, "reason": None}
        if not ofs:
            metadata["reason"] = "no_candidates"
            return (None, metadata)

        # Build event datetime from date and time if available
        from datetime import datetime

        event_dt = None
        try:
            if event_date:
                # Try combine date + time when provided
                if event_time:
                    combined = f"{event_date} {event_time}"
                    try:
                        event_dt = datetime.fromisoformat(combined)
                    except Exception:
                        # Try common SAP formats
                        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d %H%M%S", "%Y-%m-%d %H%M"):
                            try:
                                event_dt = datetime.strptime(combined, fmt)
                                break
                            except Exception:
                                continue
                else:
                    try:
                        event_dt = datetime.fromisoformat(event_date)
                    except Exception:
                        try:
                            event_dt = datetime.strptime(event_date[:19], "%Y-%m-%dT%H:%M:%S")
                        except Exception:
                            event_dt = None
        except Exception:
            event_dt = None

        best = None
        best_diff_min = None
        for o in ofs:
            # Creation date may include time; try to parse full datetime
            o_dt = None
            try:
                if o.create_date:
                    # Accept both date and datetime strings
                    try:
                        o_dt = datetime.fromisoformat(o.create_date)
                    except Exception:
                        # Try common formats
                        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
                            try:
                                o_dt = datetime.strptime(o.create_date[:19], fmt)
                                break
                            except Exception:
                                continue
            except Exception:
                o_dt = None

            diff_min = None
            if event_dt and o_dt:
                diff_min = abs(int((event_dt - o_dt).total_seconds() / 60))

            metadata["candidates"].append({
                "abs_entry": o.abs_entry,
                "doc_num": o.doc_num,
                "create_date": o.create_date,
                "diff_minutes": diff_min,
            })

            if diff_min is None:
                # fallback to latest document number if no datetime available
                if best is None:
                    best = o
                    best_diff_min = diff_min
            else:
                if best_diff_min is None or (diff_min < best_diff_min):
                    best = o
                    best_diff_min = diff_min

        if best is None:
            best = ofs[0]
            metadata["reason"] = "fallback_latest"
        else:
            metadata["reason"] = "closest_by_datetime"

        metadata["selected"] = {"abs_entry": best.abs_entry, "doc_num": best.doc_num, "diff_minutes": best_diff_min}
        return (best, metadata)

    async def get_best_of_for_event(self,
                                    item_code: str,
                                    event_date: str | None,
                                    event_time: str | None,) -> dict:
        """
        Fetch released OFs for given item_code and choose the best match for the provided event datetime.
        Returns a dict: {"best_of": ProductionOrder or None, "metadata": {...}}
        """
        ofs = await self.get_released_ofs(item_code)
        if not ofs:
            return {"best_of": None, "metadata": {"reason": "no_candidates"}}

        best, metadata = self.choose_best_of(event_date, event_time, ofs)

        # Detailed logging
        logger.info(f"Event Date: {event_date} Event Time: {event_time}")
        for c in metadata.get("candidates", []):
            logger.info(f"Candidate OF: DocNum={c.get('doc_num')} Create={c.get('create_date')} DiffMin={c.get('diff_minutes')}")

        if best:
            logger.info(
                f"   Selected OF — Item={item_code} DocNum={getattr(best, 'doc_num', None)} "
                f"Reason={metadata.get('reason')} DiffMin={metadata.get('selected', {}).get('diff_minutes') if metadata.get('selected') else None}"
            )
        else:
            logger.info(f"   No OF selected for Item={item_code}")

        return {"best_of": best, "metadata": metadata}

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