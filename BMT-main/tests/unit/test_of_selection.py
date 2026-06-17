import pytest
from sap.of_service import of_service
from sap.models import ProductionOrder


def make_of(doc_num, create_date):
    return ProductionOrder(abs_entry=doc_num, doc_num=doc_num, item_code="ITEM1", planned_qty=100, status="boposReleased", create_date=create_date, warehouse="W1")


def test_choose_best_of_closest_date():
    ofs = [
        make_of(1001, "2026-06-09"),
        make_of(1002, "2026-06-11"),
        make_of(1003, "2026-06-15"),
    ]
    best, meta = of_service.choose_best_of("2026-06-11 14:00", ofs)
    assert best is not None
    assert best.doc_num == 1002
    assert meta["selected"]["doc_num"] == 1002
    assert meta["reason"] == "closest_by_date"


def test_choose_best_of_no_event_date_returns_first():
    ofs = [
        make_of(2001, "2026-05-01"),
        make_of(2002, "2026-06-01"),
    ]
    best, meta = of_service.choose_best_of(None, ofs)
    assert best is not None
    assert best.doc_num == 2001
    assert meta["reason"] in ("fallback_latest", "closest_by_date")
