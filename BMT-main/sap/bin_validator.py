"""
sap/bin_validator.py
====================
Validation d'un Bin Location dans SAP B1.
Retourne l'AbsEntry du bin si valide et actif.
"""

import logging
from sap.session import sap_session

logger = logging.getLogger(__name__)


class BinValidator:

    async def validate(self, bin_code: str) -> int:
        """
        Vérifie que le Bin Location existe dans SAP B1 et qu'il est actif.
        Retourne l'AbsEntry du bin.
        Lève BinNotFoundError si absent ou inactif.
        Lève BinValidationError en cas d'erreur de communication SAP.
        """
        filter_q = (
            f"$filter=BinCode eq '{bin_code}'"
            f"&$select=AbsEntry,BinCode,Inactive"
        )

        async with await sap_session.get_client() as client:
            response = await client.get(f"/BinLocations?{filter_q}")

        if response.status_code != 200:
            raise BinValidationError(
                f"Erreur lors de la vérification du bin '{bin_code}' "
                f"(HTTP {response.status_code}): {response.text}"
            )

        results = response.json().get("value", [])

        if not results:
            raise BinNotFoundError(
                f"Bin Location '{bin_code}' introuvable dans SAP B1"
            )

        bin_data = results[0]

        if bin_data.get("Inactive") == "tYES":
            raise BinNotFoundError(
                f"Bin Location '{bin_code}' est inactif dans SAP B1"
            )

        abs_entry = bin_data.get("AbsEntry")
        logger.info(f"✅ Bin '{bin_code}' validé — AbsEntry: {abs_entry}")
        return abs_entry

    async def is_valid(self, bin_code: str) -> bool:
        """Retourne True si le bin existe et est actif, False sinon."""
        try:
            await self.validate(bin_code)
            return True
        except (BinNotFoundError, BinValidationError):
            return False


class BinNotFoundError(Exception):
    pass


class BinValidationError(Exception):
    pass


bin_validator = BinValidator()