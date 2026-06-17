"""
sap/config_service.py
======================
Load configuration tables from SAP Service Layer (pulses, products, warehouses).

Provides a cached view with TTL and startup load helper.
"""
from __future__ import annotations

import logging
import time
from typing import Dict, Any, List, Optional

from sap.session import sap_session

logger = logging.getLogger(__name__)


class SAPConfigService:
    def __init__(self, ttl: int = 60):
        self._cache: Dict[str, Any] = {}
        self._ts: Dict[str, float] = {}
        self._ttl = ttl

    async def _fetch_table(self, table: str, select: Optional[str] = None, filter_q: Optional[str] = None) -> List[dict]:
        q = ""
        if select:
            q += f"&$select={select}"
        if filter_q:
            q += f"&{filter_q}"
        path = f"/{table}?$orderby=Code asc{q}"
        async with await sap_session.get_client() as client:
            resp = await client.get(path)
        if resp.status_code != 200:
            logger.error(f"Failed to read SAP table {table}: HTTP {resp.status_code} {resp.text}")
            raise RuntimeError(f"Failed to read SAP table {table}: HTTP {resp.status_code}")
        return resp.json().get("value", [])

    async def get_pulses(self, force: bool = False) -> List[dict]:
        key = "pulses"
        if not force and key in self._cache and (time.time() - self._ts.get(key, 0) < self._ttl):
            return self._cache[key]
        # Try typical BMT_TYPE_PULSE or fallback to UDF table name
        for table in ("BMT_TYPE_PULSE", "@BMT_TYPE_PULSE"):
            try:
                # include U_uom and U_Rubrique fields expected in BMT_TYPE_PULSE
                rows = await self._fetch_table(table, select="Code,Name,U_uom,U_Rubrique")
                if rows:
                    self._cache[key] = rows
                    self._ts[key] = time.time()
                    logger.info(f"Loaded {len(rows)} pulses from SAP table {table}")
                    return rows
            except Exception:
                continue
        logger.warning("No pulses table found in SAP; returning empty list")
        self._cache[key] = []
        self._ts[key] = time.time()
        return []

    async def get_products(self, force: bool = False) -> List[dict]:
        key = "products"
        if not force and key in self._cache and (time.time() - self._ts.get(key, 0) < self._ttl):
            return self._cache[key]
        # Use Items or custom table
        try:
            rows = await self._fetch_table("Items", select="ItemCode,ItemName")
            self._cache[key] = rows
            self._ts[key] = time.time()
            logger.info(f"Loaded {len(rows)} products from SAP Items")
            return rows
        except Exception as e:
            logger.error(f"Failed to load products from SAP: {e}")
            self._cache[key] = []
            self._ts[key] = time.time()
            return []

    async def get_warehouses(self, force: bool = False) -> List[dict]:
        key = "warehouses"
        if not force and key in self._cache and (time.time() - self._ts.get(key, 0) < self._ttl):
            return self._cache[key]
        try:
            rows = await self._fetch_table("Warehouses", select="WhsCode,WhsName")
            self._cache[key] = rows
            self._ts[key] = time.time()
            logger.info(f"Loaded {len(rows)} warehouses from SAP")
            return rows
        except Exception as e:
            logger.error(f"Failed to load warehouses from SAP: {e}")
            self._cache[key] = []
            self._ts[key] = time.time()
            return []

    def invalidate(self, key: Optional[str] = None) -> None:
        if key:
            self._cache.pop(key, None)
            self._ts.pop(key, None)
        else:
            self._cache.clear()
            self._ts.clear()


config_service = SAPConfigService()
