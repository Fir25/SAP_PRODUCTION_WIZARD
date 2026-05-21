"""
core/config_resolver.py
========================
Résolution de la configuration produit depuis @BMT_PROD.
Cherche par U_Product (ex: 'B12'), pas par ItemCode.
"""

import logging
from sap.session import sap_session
from sap.models import ProductConfig

logger = logging.getLogger(__name__)

TABLE_CONFIG = "BMT_PROD"


class ConfigNotFoundError(Exception):
    pass


class ConfigResolver:

    async def get_config(self, product: str) -> ProductConfig:
        """
        Récupère la configuration d'un produit depuis @BMT_PROD.
        Cherche sur U_Product (ex: 'B12').
        Lève ConfigNotFoundError si le produit est absent de la table.
        """
        filter_q = f"$filter=U_Product eq '{product}'"

        async with await sap_session.get_client() as client:
            response = await client.get(f"/{TABLE_CONFIG}?{filter_q}")

        if response.status_code != 200:
            raise ConfigNotFoundError(
                f"Erreur lecture @BMT_PROD pour produit '{product}' "
                f"(HTTP {response.status_code})"
            )

        values = response.json().get("value", [])

        if not values:
            raise ConfigNotFoundError(
                f"Produit '{product}' absent de @BMT_PROD"
            )

        raw = values[0]
        logger.debug(f" Config trouvée pour produit '{product}': {raw}")
        return self._parse(raw)

    @staticmethod
    def _parse(raw: dict) -> ProductConfig:
        return ProductConfig(
            product=raw.get("U_Product", ""),
            item_pf_v1=raw.get("U_Item_PF_V1", ""),
            item_pf_v2=raw.get("U_Item_PF_V2", ""),
            item_pf_emb=raw.get("U_Item_PF_EMB", ""),
            item_sf=raw.get("U_Item_SF", ""),
            routing=raw.get("U_Routing", ""),
            routing_is_default=raw.get("U_Routing_Is_Default", "N"),
            wagon_to_pcs=int(raw.get("U_Wagon_To_PCS") or 0),
            pince_vracsup_to_pcs=int(raw.get("U_Pince_VracSup_To_PCS") or 0),
            pince_vracinf_to_pcs=int(raw.get("U_Pince_VracInf_To_PCS") or 0),
            pince_emb_to_pcs=int(raw.get("U_Pince_Emb_To_PCS") or 0),
            code_recette_emb=raw.get("U_Code_Recette_Emb", ""),
        )


config_resolver = ConfigResolver()