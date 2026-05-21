"""
config/logging_config.py
========================
Configuration du logging structuré : console + fichier.
"""

import logging
import sys
from config.settings import settings


def setup_logging() -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    handlers = [
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bmt_middleware.log", encoding="utf-8"),
    ]

    logging.basicConfig(level=level, format=fmt, datefmt=datefmt, handlers=handlers)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn").setLevel(logging.WARNING)