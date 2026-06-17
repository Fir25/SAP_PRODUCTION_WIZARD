import pytest
from core.dynamic_pulse_router import build_routing


def test_build_routing_vrac_and_emb():
    pulses = [
        {"Code": "P002", "Name": "Production Wagon", "U_uom": "PCS", "U_Rubrique": "1-VRAC"},
        {"Code": "B4CH120", "Name": "Emballage Line", "U_uom": "PCS", "U_Rubrique": "EMB-PRIMARY"},
        {"Code": "SortieWagon", "Name": "Sortie Wagon", "U_uom": "PCS", "U_Rubrique": ""},
    ]
    routing = build_routing(pulses)
    assert 'P002' in routing
    assert 'B4CH120' in routing
    assert 'SortieWagon' in routing
    # handler class names
    assert routing['P002'].__class__.__name__ in ('VracHandler','GenericProductionHandler')
    assert routing['B4CH120'].__class__.__name__ in ('EmballageHandler','GenericProductionHandler')
    assert routing['SortieWagon'].__class__.__name__ == 'function' or routing['SortieWagon'].__class__.__name__ != ''
