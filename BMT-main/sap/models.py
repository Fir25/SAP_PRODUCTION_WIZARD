"""
sap/models.py
=============
Modèles de données pour les objets SAP B1 BMT.
Alignés sur les champs réels vus dans SAP (générateur de requêtes).
"""

from dataclasses import dataclass, field
from typing import Optional


# ------------------------------------------------------------------
# ÉVÉNEMENT DE PRODUCTION (@BMT_PROD_EVENTS)
# Champs réels SAP : U_Product, U_Pulse, U_BinLocation,
#                    U_Quantity, U_Date, U_Time,
#                    U_Is_Valid_User, U_Is_Interfaced
# ------------------------------------------------------------------

@dataclass
class ProductionEvent:
    """
    Représente une ligne de @BMT_PROD_EVENTS.
    L'utilisateur la crée dans SAP via le formulaire BMT_PROD_EVENTS.
    Le middleware lit les lignes où U_Is_Interfaced = 'N'.
    """
    doc_entry:     int    # Clé primaire SAP (DocEntry)
    product:       str    # U_Product      — ex: B12
    pulse:         str    # U_Pulse        — SortieWagon / PincePFV01 / ...
    bin_location:  str    # U_BinLocation  — ex: B4WAG-W001
    quantity:      float  # U_Quantity     — quantité saisie
    date:          str    # U_Date         — YYYY-MM-DD
    time:          str    # U_Time         — HH:MM
    is_valid_user: str = "N"  # U_Is_Valid_User — Y si validé par l'utilisateur
    is_interfaced: str = "N"  # U_Is_Interfaced  — N=à traiter, Y=traité
    remark:        str = ""   # Remark SAP (champ libre, 50 car. max)
    of_numdoc:     Optional[str] = None   # Ordre de fabrication lié (ProductionOrder.DocEntry)

    @property
    def is_sortie_wagon(self) -> bool:
        return self.pulse == "SortieWagon"

    @property
    def is_pince_pf(self) -> bool:
        return self.pulse.startswith("PincePF")


# ------------------------------------------------------------------
# CONFIGURATION PRODUIT (@BMT_PROD)
# Champs réels SAP : U_Product, U_Item_PF_V1, U_Item_PF_V2,
#                    U_Item_PF_EMB, U_Item_SF, U_Routing,
#                    U_Routing_Is_Default, U_Wagon_To_PCS,
#                    U_Pince_VracSup_To_PCS, U_Pince_VracInf_To_PCS,
#                    U_Pince_Emb_To_PCS, U_Code_Recette_Emb
# ------------------------------------------------------------------

@dataclass
class ProductConfig:
    """
    Représente une ligne de @BMT_PROD.
    Une ligne par produit fini (B12, B8, H16...).
    """
    product:               str    # Code produit — clé primaire
    item_pf_v1:            str    # ItemCode PF Vrac Supérieur  ex: B12_V1
    item_pf_v2:            str    # ItemCode PF Vrac Inférieur  ex: B12_V2
    item_pf_emb:           str    # ItemCode PF Emballé         ex: B12_161
    item_sf:               str    # ItemCode Semi-Fini          ex: B12SF
    routing:               str    # Code gamme SAP              ex: G0001
    routing_is_default:    str    # Y / N
    wagon_to_pcs:          int    # Nb briques / wagon          ex: 2160
    pince_vracsup_to_pcs:  int    # Facteur pince vrac sup      ex: 720
    pince_vracinf_to_pcs:  int    # Facteur pince vrac inf      ex: 720
    pince_emb_to_pcs:      int    # Facteur pince emballé       ex: 720
    code_recette_emb:      str    # Code recette emballé


# ------------------------------------------------------------------
# ORDRE DE FABRICATION (ProductionOrders)
# Champs SAP : AbsoluteEntry, DocumentNumber, ItemNo,
#              PlannedQuantity, ProductionOrderStatus,
#              CreationDate, ProductionOrderWarehouse
# ------------------------------------------------------------------

@dataclass
class ProductionOrder:
    abs_entry:   int
    doc_num:     int
    item_code:   str
    planned_qty: float
    status:      str
    create_date: str
    warehouse:   str = ""   # ProductionOrderWarehouse — magasin de réception du PF


# ------------------------------------------------------------------
# PAYLOADS SAP — Issue for Production / Receipt from Production
# ------------------------------------------------------------------

@dataclass
class IssueLine:
    item_code:      str
    quantity:       float
    warehouse_code: str
    bin_abs_entry:  Optional[int] = None


@dataclass
class ReceiptLine:
    item_code:      str
    quantity:       float
    warehouse_code: str
    bin_abs_entry:  Optional[int] = None


@dataclass
class IssuePayload:
    doc_date:         str
    production_order: int
    lines:            list[IssueLine] = field(default_factory=list)


@dataclass
class ReceiptPayload:
    doc_date:         str
    production_order: int
    lines:            list[ReceiptLine] = field(default_factory=list)