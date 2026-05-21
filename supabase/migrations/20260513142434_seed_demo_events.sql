/*
  # Seed Demo Events for WMS Validation Wizard

  Inserts realistic demo production events to showcase the validation wizard.
  Covers all status types: PENDING, APPROVED, REJECTED, WARNING, ERROR.
*/

INSERT INTO events (
  external_id, event_type, status,
  production_order, item_code, item_description, original_quantity, modified_quantity, unit_of_measure,
  machine_id, machine_name, warehouse_code, bin_location,
  validation_rules, notes, sap_document_number, sap_response_code, sap_response_message,
  received_at, processed_at
) VALUES
(
  'EVT-2024-001', 'PRODUCTION_RECEIPT', 'PENDING',
  'OF-2024-1042', 'ITEM-A4521', 'Aluminum Housing 40x40', 150, NULL, 'EA',
  'MACHINE-01', 'CNC Press Line 1', 'WH-PROD', 'R01-S02-B03',
  '[{"rule":"OF_STATUS","status":"OK","message":"Production order is active"},{"rule":"ITEM_EXISTS","status":"OK","message":"Item found in SAP catalog"},{"rule":"BIN_VALID","status":"OK","message":"Bin location R01-S02-B03 exists"},{"rule":"QTY_POSITIVE","status":"OK","message":"Quantity 150 is valid"}]',
  '', NULL, NULL, NULL,
  now() - interval '5 minutes', NULL
),
(
  'EVT-2024-002', 'MATERIAL_CONSUMPTION', 'PENDING',
  'OF-2024-1043', 'RAW-B7810', 'Steel Rod 12mm', 0, NULL, 'KG',
  'MACHINE-03', 'Rolling Mill Station 3', 'WH-RAW', 'R02-S01-B01',
  '[{"rule":"OF_STATUS","status":"OK","message":"Production order is active"},{"rule":"ITEM_EXISTS","status":"OK","message":"Item found in SAP catalog"},{"rule":"BIN_VALID","status":"OK","message":"Bin location R02-S01-B01 exists"},{"rule":"QTY_POSITIVE","status":"ERROR","message":"Quantity must be greater than 0"}]',
  '', NULL, NULL, NULL,
  now() - interval '12 minutes', NULL
),
(
  'EVT-2024-003', 'PRODUCTION_RECEIPT', 'WARNING',
  'OF-2024-1040', 'ITEM-C3301', 'Plastic Cover Assembly', 320, NULL, 'EA',
  'MACHINE-02', 'Injection Mold Line 2', 'WH-PROD', 'R03-S04-B07',
  '[{"rule":"OF_STATUS","status":"OK","message":"Production order is active"},{"rule":"ITEM_EXISTS","status":"OK","message":"Item found in SAP catalog"},{"rule":"BIN_VALID","status":"OK","message":"Bin location exists"},{"rule":"QTY_POSITIVE","status":"OK","message":"Quantity is valid"},{"rule":"QTY_EXCEEDS_ORDER","status":"WARNING","message":"Quantity 320 exceeds planned order quantity 300 by 6.7%"}]',
  '', NULL, NULL, NULL,
  now() - interval '25 minutes', NULL
),
(
  'EVT-2024-004', 'STOCK_TRANSFER', 'APPROVED',
  'OF-2024-1038', 'ITEM-D9912', 'Electronic PCB Module', 75, 75, 'EA',
  'MACHINE-05', 'Assembly Station A', 'WH-FG', 'R01-S01-B02',
  '[{"rule":"OF_STATUS","status":"OK","message":"Production order is active"},{"rule":"ITEM_EXISTS","status":"OK","message":"Item found"},{"rule":"BIN_VALID","status":"OK","message":"Bin valid"},{"rule":"QTY_POSITIVE","status":"OK","message":"Quantity valid"}]',
  'Verified on floor', 'SAP-10042381', '200', 'Document created successfully',
  now() - interval '2 hours', now() - interval '1 hour 50 minutes'
),
(
  'EVT-2024-005', 'MATERIAL_CONSUMPTION', 'REJECTED',
  'OF-2024-1035', 'RAW-F5521', 'Copper Wire 2.5mm²', 200, 200, 'M',
  'MACHINE-04', 'Winding Machine B', 'WH-RAW', 'R04-S02-B05',
  '[{"rule":"OF_STATUS","status":"ERROR","message":"Production order OF-2024-1035 is closed"},{"rule":"ITEM_EXISTS","status":"OK","message":"Item found"},{"rule":"BIN_VALID","status":"OK","message":"Bin valid"},{"rule":"QTY_POSITIVE","status":"OK","message":"Quantity valid"}]',
  'Production order already closed', NULL, NULL, NULL,
  now() - interval '3 hours', now() - interval '2 hours 45 minutes'
),
(
  'EVT-2024-006', 'PRODUCTION_RECEIPT', 'ERROR',
  'OF-2024-1044', 'ITEM-G1177', 'Rubber Gasket 50mm', 500, NULL, 'EA',
  'MACHINE-06', 'Vulcanization Press', 'WH-PROD', 'R99-S99-B99',
  '[{"rule":"OF_STATUS","status":"OK","message":"Production order is active"},{"rule":"ITEM_EXISTS","status":"OK","message":"Item found"},{"rule":"BIN_VALID","status":"ERROR","message":"Bin R99-S99-B99 does not exist in warehouse WH-PROD"},{"rule":"QTY_POSITIVE","status":"OK","message":"Quantity valid"}]',
  '', NULL, NULL, NULL,
  now() - interval '45 minutes', NULL
),
(
  'EVT-2024-007', 'PRODUCTION_RECEIPT', 'PENDING',
  'OF-2024-1045', 'ITEM-H2290', 'Bearing Assembly 6205', 48, NULL, 'EA',
  'MACHINE-01', 'CNC Press Line 1', 'WH-PROD', 'R01-S03-B06',
  '[{"rule":"OF_STATUS","status":"OK","message":"Production order is active"},{"rule":"ITEM_EXISTS","status":"OK","message":"Item found in SAP catalog"},{"rule":"BIN_VALID","status":"OK","message":"Bin location valid"},{"rule":"QTY_POSITIVE","status":"OK","message":"Quantity is valid"}]',
  '', NULL, NULL, NULL,
  now() - interval '2 minutes', NULL
),
(
  'EVT-2024-008', 'STOCK_ADJUSTMENT', 'APPROVED',
  'OF-2024-1041', 'ITEM-K8830', 'Drive Shaft 300mm', 12, 10, 'EA',
  'MACHINE-07', 'Grinding Station C', 'WH-PROD', 'R02-S03-B04',
  '[{"rule":"OF_STATUS","status":"OK","message":"Production order is active"},{"rule":"ITEM_EXISTS","status":"OK","message":"Item found"},{"rule":"BIN_VALID","status":"OK","message":"Bin valid"},{"rule":"QTY_POSITIVE","status":"OK","message":"Quantity valid"}]',
  'Quantity adjusted after physical count', 'SAP-10042395', '200', 'Document created successfully',
  now() - interval '4 hours', now() - interval '3 hours 30 minutes'
);
