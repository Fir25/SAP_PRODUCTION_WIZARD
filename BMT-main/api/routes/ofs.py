"""
api/routes/ofs.py
=================
Endpoints to expose released OFs and best OF suggestions.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException
from sap.of_service import of_service
from core.validation_queue import validation_queue
from sap.config_service import config_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ofs", tags=["ofs"])


@router.get("/released/{item_code}")
async def get_released_ofs(item_code: str):
    try:
        # If a product code is provided, try to resolve Item_SF first
        logger.info(f"Searching OF for Product={item_code}")
        try:
            item_sf = await config_service.get_item_sf(item_code)
        except Exception:
            item_sf = None

        if item_sf:
            logger.info(f"Resolved Item_SF={item_sf}")
            search_code = item_sf
            logger.info(f"Searching Released OF for ItemCode={search_code}")
        else:
            if item_code:
                logger.warning(f"No Item_SF configuration found for Product={item_code}")
            search_code = item_code

        ofs = await of_service.get_released_ofs(search_code, force_refresh=False)
        result = [
            {
                "doc_entry": o.abs_entry,
                "doc_num": o.doc_num,
                "warehouse": o.warehouse,
                "creation_date": o.create_date,
            }
            for o in ofs
        ]
        return result
    except Exception as e:
        logger.exception(f"Erreur fetching released OFs for {item_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/best/{event_id}")
async def get_best_of_for_event_endpoint(event_id: str):
    try:
        doc_entry = int(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event id")

    queued = validation_queue.get_event(doc_entry)
    if not queued:
        raise HTTPException(status_code=404, detail=f"Event {doc_entry} not found in validation queue")

    item_code = queued.current_product
    logger.info(f"Searching OF for Product={item_code}")
    try:
        item_sf = await config_service.get_item_sf(item_code)
    except Exception:
        item_sf = None

    if item_sf:
        logger.info(f"Resolved Item_SF={item_sf}")
        search_code = item_sf
        logger.info(f"Searching Released OF for ItemCode={search_code}")
    else:
        logger.warning(f"No Item_SF configuration found for Product={item_code}")
        search_code = item_code
    ev_date = queued.sap_event.date if getattr(queued.sap_event, 'date', None) else None
    ev_time = queued.sap_event.time if getattr(queued.sap_event, 'time', None) else None

    try:
        res = await of_service.get_best_of_for_event(search_code, ev_date, ev_time)
        best = res.get('best_of')
        meta = res.get('metadata', {})
        recommended = None
        if best:
            recommended = {
                "doc_entry": best.abs_entry,
                "doc_num": best.doc_num,
                "warehouse": best.warehouse,
                "creation_date": best.create_date,
            }
        return {
            "recommended_of": recommended,
            "selection_reason": meta.get('reason'),
            "difference_minutes": meta.get('selected', {}).get('diff_minutes') if meta.get('selected') else None,
            "metadata": meta,
        }
    except Exception as e:
        logger.exception(f"Erreur computing best OF for event {doc_entry}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
