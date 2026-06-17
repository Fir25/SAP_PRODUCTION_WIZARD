"""
core/dynamic_pulse_router.py
===========================
Resolve pulse definitions loaded from SAP into handler instances.

Rules implemented (order matters):
- If U_Rubrique contains 'VRAC' -> VracHandler (delegates to pince_pf_handler)
- If U_Rubrique contains 'EMB'  -> EmballageHandler (delegates to pince_pf_handler)
- If Code startswith 'P' and Name contains 'Lancement' or 'LANC' -> OFLaunchHandler
- If Code == 'SortieWagon' -> sortie_wagon_handler
- If pulse matches existing PincePF codes -> pince_pf_handler
- Else -> GenericProductionHandler (fallback)

This module exposes `build_routing(pulse_rows)`.
"""
from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional

from sap.config_service import config_service
from handlers.pince_pf import pince_pf_handler
from handlers.sortie_wagon import sortie_wagon_handler
from handlers.generic_handlers import (
    VracHandler,
    EmballageHandler,
    OFLaunchHandler,
    GenericProductionHandler,
)

logger = logging.getLogger(__name__)


def _match_rubrique_for_vrac(rubrique: str | None) -> bool:
    if not rubrique:
        return False
    return 'VRAC' in rubrique.upper()


def _match_rubrique_for_emb(rubrique: str | None) -> bool:
    if not rubrique:
        return False
    return 'EMB' in rubrique.upper()


def _match_name_for_of_launch(name: str | None, code: str | None) -> bool:
    if not name and not code:
        return False
    n = (name or '').upper()
    c = (code or '').upper()
    if 'LANC' in n or 'LAUNCH' in n or 'LANCEMENT' in n:
        return True
    if c.startswith('P') and ('LANC' in n or 'OF' in n or 'LAUNCH' in n):
        return True
    return False


def build_routing(pulses: List[Dict[str, Any]]) -> Dict[str, object]:
    """Return mapping Code -> handler instance/function.

    Pulses is a list of dicts as returned by SAP (Code, Name, U_uom, U_Rubrique).
    """
    routing: Dict[str, object] = {}

    # instantiate handler instances or use existing module-level handler functions
    vrac_handler = sortie_wagon_handler  # per requirement: VRAC -> sortie_wagon_handler
    emb_handler = pince_pf_handler       # EMB -> pince_pf_handler
    oflaunch = OFLaunchHandler()
    generic = GenericProductionHandler()

    for p in pulses:
        code = p.get('Code') or p.get('code')
        name = p.get('Name') or p.get('name')
        rubrique = p.get('U_Rubrique') or p.get('u_rubrique') or p.get('U_RUBRIQUE')
        if not code:
            continue

        handler = None
        # explicit SortieWagon
        if code == 'SortieWagon':
            handler = sortie_wagon_handler
        # legacy PincePF codes
        elif code.startswith('PincePF'):
            handler = pince_pf_handler
        # rubric-based rules
        elif _match_rubrique_for_vrac(rubrique):
            handler = vrac_handler
        elif _match_rubrique_for_emb(rubrique):
            handler = emb_handler
        elif _match_name_for_of_launch(name, code):
            handler = oflaunch
        else:
            handler = generic

        routing[code] = handler
        logger.info(f"Pulse {code} resolved to {handler.__class__.__name__ if hasattr(handler,'__class__') else getattr(handler,'__name__',str(handler))}")

    logger.info(f"DynamicPulseRouter built {len(routing)} entries")
    return routing


async def resolve_handler(pulse_code: str):
    """
    Resolve a handler for the given pulse_code by consulting SAP pulse definitions.
    Returns a handler callable/object. Never raises on unknown pulses; returns generic handler.
    """
    pulses = await config_service.get_pulses()
    # Build quick lookup
    lookup = {p.get('Code'): p for p in pulses}
    p = lookup.get(pulse_code)

    # Default fallback
    generic = GenericProductionHandler()

    if not p:
        logger.warning(f"Pulse {pulse_code} not found in SAP pulse definitions — using GenericProductionHandler")
        return generic

    code = p.get('Code')
    name = p.get('Name')
    rubrique = p.get('U_Rubrique') or p.get('u_rubrique')

    logger.info(f"Resolving Pulse={code} Name={name} Rubrique={rubrique}")

    # Apply rules
    if code == 'SortieWagon' or _match_rubrique_for_vrac(rubrique):
        handler = sortie_wagon_handler
    elif _match_rubrique_for_emb(rubrique):
        handler = pince_pf_handler
    elif _match_name_for_of_launch(name, code):
        handler = OFLaunchHandler()
    elif code.startswith('PincePF'):
        handler = pince_pf_handler
    else:
        handler = generic

    logger.info(f"Pulse {code} resolved to handler={handler.__class__.__name__ if hasattr(handler,'__class__') else getattr(handler,'__name__',str(handler))}")
    return handler
