"""
sap/session.py
==============
Gestion de la session SAP B1 Service Layer.
- Login automatique au démarrage
- Stockage du cookie de session (B1SESSION)
- Refresh automatique si session expirée (401)
- Utilisé par TOUS les autres services SAP
"""

import httpx
import logging
from datetime import datetime, timedelta
from config.settings import settings

logger = logging.getLogger(__name__)

# Durée de vie de la session SAP B1 (par défaut 30 min, on refresh à 25 min)
SESSION_LIFETIME_MINUTES = 25


class SAPSession:
    """
    Singleton gérant la session SAP B1.
    Tous les services SAP utilisent get_client() pour avoir un client httpx
    déjà authentifié avec le bon cookie.
    """

    def __init__(self):
        self._cookie: str | None = None
        self._session_id: str | None = None
        self._last_login: datetime | None = None
        self._base_url = f"https://{settings.SAP_HOST}:{settings.SAP_PORT}/b1s/v1"

    # ------------------------------------------------------------------
    # Méthodes publiques
    # ------------------------------------------------------------------

    async def get_client(self) -> httpx.AsyncClient:
        """
        Retourne un client httpx prêt à l'emploi avec le cookie SAP valide.
        Effectue un login si nécessaire (premier appel ou session expirée).

        Usage dans les autres services :
            async with await session.get_client() as client:
                resp = await client.get("/ProductionOrders")
        """
        await self._ensure_logged_in()
        return self._build_client()

    async def login(self) -> None:
        """
        Force un nouveau login SAP B1.
        Appelé automatiquement par get_client() si besoin.
        """
        logger.info("Connexion à SAP B1 Service Layer...")
        logger.info(f"Target URL: {self._base_url}/Login")
        logger.info(f"Company DB: {settings.SAP_COMPANY}")
        logger.info(f"User: {settings.SAP_USER}")

        payload = {
            "CompanyDB": settings.SAP_COMPANY,
            "UserName":  settings.SAP_USER,
            "Password":  settings.SAP_PASSWORD,
        }

        try:
            async with httpx.AsyncClient(verify=False, timeout=30) as client:
                logger.info("Sending login request...")
                response = await client.post(
                    f"{self._base_url}/Login",
                    json=payload,
                )
        except httpx.ConnectError as e:
            logger.error(f"Connection Error: {e}")
            logger.error("This usually means:")
            logger.error("  1. SAP Service Layer is not running")
            logger.error("  2. Port 50000 is blocked by firewall")
            logger.error("  3. Network routing issue")
            logger.error("  4. Middleware is not on SAP server network")
            raise SAPLoginError(
                f"Cannot connect to SAP Service Layer at {settings.SAP_HOST}:{settings.SAP_PORT}. "
                f"Error: {e}. "
                f"Ensure middleware is deployed on SAP server network or use API-only mode."
            )
        except httpx.TimeoutException as e:
            logger.error(f"Timeout Error: {e}")
            raise SAPLoginError(
                f"Connection to SAP Service Layer timed out. "
                f"Check network connectivity and firewall settings."
            )
        except Exception as e:
            logger.error(f"Unexpected Error: {e}")
            raise SAPLoginError(f"Unexpected error during SAP login: {e}")

        if response.status_code != 200:
            logger.error(
                f"Échec du login SAP — HTTP {response.status_code}: {response.text}"
            )
            if response.status_code == 401:
                logger.error("Authentication failed - check credentials")
            elif response.status_code == 404:
                logger.error("Service Layer endpoint not found - check URL")
            elif response.status_code == 500:
                logger.error("SAP Service Layer internal error")
            raise SAPLoginError(
                f"Login SAP échoué (HTTP {response.status_code}): {response.text}"
            )

        data = response.json()
        self._session_id = data.get("SessionId")

        # Récupérer le cookie B1SESSION depuis les headers
        raw_cookie = response.headers.get("Set-Cookie", "")
        self._cookie = self._extract_b1session(raw_cookie)

        if not self._cookie:
            logger.error("No B1SESSION cookie in response headers")
            raise SAPLoginError("Cookie B1SESSION absent dans la réponse SAP Login")

        self._last_login = datetime.now()
        logger.info(f"✅ Session SAP ouverte — SessionId: {self._session_id}")
        logger.info(f"Session valid until: {self._last_login + timedelta(minutes=SESSION_LIFETIME_MINUTES)}")

    async def logout(self) -> None:
        """
        Ferme proprement la session SAP B1.
        À appeler à l'arrêt de l'application (shutdown FastAPI).
        """
        if not self._cookie:
            return

        try:
            async with self._build_client() as client:
                await client.post(f"{self._base_url}/Logout")
            logger.info("Session SAP fermée proprement.")
        except Exception as e:
            logger.warning(f"Logout SAP échoué (ignoré) : {e}")
        finally:
            self._cookie = None
            self._session_id = None
            self._last_login = None

    def is_session_valid(self) -> bool:
        """Vérifie si la session est encore valide (dans les 25 minutes)."""
        if not self._cookie or not self._last_login:
            return False
        age = datetime.now() - self._last_login
        return age < timedelta(minutes=SESSION_LIFETIME_MINUTES)

    # ------------------------------------------------------------------
    # Méthodes privées
    # ------------------------------------------------------------------

    async def _ensure_logged_in(self) -> None:
        """Login si pas de session ou session expirée."""
        if not self.is_session_valid():
            await self.login()

    def _build_client(self) -> httpx.AsyncClient:
        """Construit un client httpx avec le cookie SAP et les bons headers."""
        return httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Content-Type": "application/json",
                "Cookie": f"B1SESSION={self._cookie}",
            },
            verify=False,   # SAP B1 utilise souvent un cert auto-signé
            timeout=30,
        )

    @staticmethod
    def _extract_b1session(raw_cookie: str) -> str | None:
        """
        Extrait la valeur B1SESSION depuis le header Set-Cookie.
        Exemple : 'B1SESSION=abc123; path=/; HttpOnly'  →  'abc123'
        """
        for part in raw_cookie.split(";"):
            part = part.strip()
            if part.startswith("B1SESSION="):
                return part.split("=", 1)[1]
        return None


# ------------------------------------------------------------------
# Exceptions
# ------------------------------------------------------------------

class SAPLoginError(Exception):
    """Levée quand le login SAP B1 échoue."""
    pass


class SAPSessionExpiredError(Exception):
    """Levée quand SAP répond 401 (session expirée)."""
    pass


# ------------------------------------------------------------------
# Instance globale (singleton)
# ------------------------------------------------------------------
# Importé dans tous les autres services :
#   from sap.session import sap_session
#
sap_session = SAPSession() 