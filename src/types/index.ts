export type EventStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WARNING' | 'ERROR';
export type EventType = 'PRODUCTION_RECEIPT' | 'MATERIAL_CONSUMPTION' | 'STOCK_TRANSFER' | 'STOCK_ADJUSTMENT';
export type UserRole = 'admin' | 'operator';
export type AuditAction = 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'VIEWED';

export interface ValidationRule {
  rule: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  message: string;
}

export interface WmsEvent {
  id: string;
  external_id: string | null;
  pulse?: string; // shorthand event type used in frontend (e.g., PincePFE03)
  event_type: EventType;
  status: EventStatus;
  production_order: string;
  item_code: string;
  item_description: string;
  original_quantity: number;
  modified_quantity: number | null;
  unit_of_measure: string;
  machine_id: string;
  machine_name: string;
  warehouse_code: string;
  bin_location: string;
  validation_rules: ValidationRule[];
  notes: string | null;
  sap_document_number: string | null;
  sap_response_code: string | null;
  sap_response_message: string | null;
  sap_date?: string | null;
  sap_time?: string | null;
  received_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  event_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: AuditAction;
  original_quantity: number | null;
  modified_quantity: number | null;
  rejection_reason: string | null;
  notes: string | null;
  sap_response_code: string | null;
  sap_response_message: string | null;
  sap_document_number: string | null;
  created_at: string;
  events?: { production_order: string; item_code: string; item_description: string };
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface DashboardKPIs {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  errors: number;
}
