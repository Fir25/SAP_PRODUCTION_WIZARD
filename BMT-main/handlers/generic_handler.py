"""
handlers/generic_handler.py
==========================
Simple adapter that exposes a `GenericHandler` and `lancement_of_handler` to be used
by the dynamic router. It re-uses implementations defined in `generic_handlers.py`.
"""
from handlers.generic_handlers import (
    GenericProductionHandler as _GenericProductionHandler,
    OFLaunchHandler as _OFLaunchHandler,
)

# Exported names expected by the rest of the codebase
class GenericHandler(_GenericProductionHandler):
    pass

# instance for OF launch semantics
lancement_of_handler = _OFLaunchHandler()

# Also provide a module-level generic handler instance
generic_handler = GenericHandler()
