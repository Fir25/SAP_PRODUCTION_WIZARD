"""
sap/udt_service.py
==================
Lecture et mise à jour des tables UDT SAP B1 :
  @BMT_PROD_EVENTS → lire Is_Interfaced=N + marquer Y après traitement
  @BMT_PROD        → config produit (délégué à config_resolver)

Champs réels confirmés via générateur de requêtes SAP :
  U_Product, U_Pulse, U_BinLocation, U_Quantity,
  U_Date, U_Time, U_Is_Valid_User, U_Is_Interfaced, Remark
"""

import logging
from datetime import date
from typing import Optional
from sap.session import sap_session
from sap.models import ProductionEvent

logger = logging.getLogger(__name__)

TABLE_EVENTS = "BMT_PROD_EVENTS"
TABLE_CONFIG  = "BMT_PROD"

REMARK_MAX_LEN = 50   # longueur max du champ Remark dans SAP

# ===========================================================================
# 🔧 FILTRE TEMPORAIRE — MODE TEST
# ---------------------------------------------------------------------------
# Mettre TEST_MODE = True  → traite uniquement les événements d'aujourd'hui
# Mettre TEST_MODE = False → comportement normal (tous les Is_Interfaced=N)
#
# ⚠️  Penser à remettre False avant la mise en production !
# ===========================================================================
TEST_MODE = True


class UDTService:

    async def get_pending_events(self) -> list[ProductionEvent]:
        """
        Retourne les événements en attente de traitement (U_Is_Interfaced = 'N').

        - TEST_MODE = True  → filtre sur U_Date = aujourd'hui uniquement
        - TEST_MODE = False → tous les événements sans filtre de date (production)

        Triés par date/heure croissante dans les deux cas.
        """
        if TEST_MODE:
            # ---------------------------------------------------------------
            # VERSION TEST : filtre sur la date du jour uniquement
            # Permet de tester sans être pollué par les anciens événements
            # ---------------------------------------------------------------
            today = date.today().strftime("%Y-%m-%d")
            filter_q = (
                f"$filter=U_Is_Interfaced eq 'N' and U_Date eq '{today}'"
                "&$orderby=U_Date asc,U_Time asc"
            )
            logger.info(f"⚙️  [TEST_MODE] Filtre actif — uniquement événements du {today}")
        else:
            # ---------------------------------------------------------------
            # VERSION PRODUCTION : tous les événements Is_Interfaced=N
            # Comportement original — ne pas modifier
            # ---------------------------------------------------------------
            filter_q = (
                "$filter=U_Is_Interfaced eq 'N'"
                "&$orderby=U_Date asc,U_Time asc"
            )

        async with await sap_session.get_client() as client:
            response = await client.get(f"/{TABLE_EVENTS}?{filter_q}")

        if response.status_code != 200:
            raise UDTReadError(
                f"Impossible de lire {TABLE_EVENTS} "
                f"(HTTP {response.status_code}): {response.text}"
            )

        raw_list = response.json().get("value", [])

        if TEST_MODE:
            today = date.today().strftime("%Y-%m-%d")
            logger.info(
                f"📋 {len(raw_list)} événement(s) à traiter "
                f"(Is_Interfaced=N, date={today})"
            )
        else:
            logger.info(f"📋 {len(raw_list)} événement(s) à traiter (Is_Interfaced=N)")

        return [self._parse_event(r) for r in raw_list]

    async def get_event_by_doc_entry(self, doc_entry: int) -> Optional[ProductionEvent]:
        """Retourne un événement par son DocEntry, ou None s'il n'existe pas."""
        async with await sap_session.get_client() as client:
            response = await client.get(f"/{TABLE_EVENTS}({doc_entry})")

        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise UDTReadError(
                f"Erreur lecture événement DocEntry={doc_entry} "
                f"(HTTP {response.status_code})"
            )
        return self._parse_event(response.json())

    async def set_interfaced(self, doc_entry: int) -> None:
        """Marque un événement comme traité (U_Is_Interfaced = 'Y')."""
        await self._patch_event(doc_entry, {"U_Is_Interfaced": "Y"})
        logger.info(f"✅ Événement DocEntry={doc_entry} → Is_Interfaced=Y")

    async def set_error_remark(self, doc_entry: int, error_msg: str) -> None:
        """
        Enregistre un message d'erreur dans le champ Remark de l'événement.
        Tronqué à REMARK_MAX_LEN caractères pour respecter la limite SAP.
        """
        remark = error_msg[:REMARK_MAX_LEN]
        await self._patch_event(doc_entry, {"Remark": remark})
        logger.warning(f"❌ Événement DocEntry={doc_entry} — Erreur: {remark}")

    async def _patch_event(self, doc_entry: int, payload: dict) -> None:
        async with await sap_session.get_client() as client:
            response = await client.patch(
                f"/{TABLE_EVENTS}({doc_entry})",
                json=payload,
            )
        if response.status_code not in (200, 204):
            raise UDTWriteError(
                f"Impossible de mettre à jour DocEntry={doc_entry} "
                f"(HTTP {response.status_code}): {response.text}"
            )

    @staticmethod
    def _parse_event(raw: dict) -> ProductionEvent:
        return ProductionEvent(
            doc_entry=raw.get("DocEntry", 0),
            product=raw.get("U_Product", ""),
            pulse=raw.get("U_Pulse", ""),
            bin_location=raw.get("U_BinLocation", ""),
            quantity=float(raw.get("U_Quantity") or 0),
            date=raw.get("U_Date", ""),
            time=raw.get("U_Time", ""),
            is_valid_user=raw.get("U_Is_Valid_User", "N"),
            is_interfaced=raw.get("U_Is_Interfaced", "N"),
            remark=raw.get("Remark", ""),
        )


class UDTReadError(Exception):
    pass


class UDTWriteError(Exception):
    pass


udt_service = UDTService()