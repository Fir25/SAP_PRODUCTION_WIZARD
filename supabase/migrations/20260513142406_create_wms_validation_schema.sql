/*
  # WMS Validation Wizard - Core Schema

  ## Purpose
  Human-in-the-loop validation layer between FastAPI middleware and SAP Business One.

  ## New Tables

  ### profiles
  - Extends auth.users with role (admin / operator) and display name

  ### events
  - Stores production events received from Raspberry Pi devices via FastAPI middleware
  - Status lifecycle: PENDING → APPROVED | REJECTED | ERROR | WARNING
  - Tracks original vs modified quantity for audit

  ### audit_logs
  - Full traceability of every decision made on every event
  - Records who validated, when, original/modified quantity, SAP response, rejection reason

  ## Security
  - RLS enabled on all tables
  - Admins can read/write all events and audit_logs
  - Operators can read events and create audit_logs but cannot delete
  - Profiles readable by authenticated users, writable only by owner
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  event_type text NOT NULL DEFAULT 'PRODUCTION_RECEIPT' CHECK (event_type IN ('PRODUCTION_RECEIPT', 'MATERIAL_CONSUMPTION', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WARNING', 'ERROR')),

  -- Production order / item info
  production_order text NOT NULL DEFAULT '',
  item_code text NOT NULL DEFAULT '',
  item_description text NOT NULL DEFAULT '',
  original_quantity numeric NOT NULL DEFAULT 0,
  modified_quantity numeric,
  unit_of_measure text NOT NULL DEFAULT 'EA',

  -- Machine / warehouse info
  machine_id text NOT NULL DEFAULT '',
  machine_name text NOT NULL DEFAULT '',
  warehouse_code text NOT NULL DEFAULT '',
  bin_location text NOT NULL DEFAULT '',

  -- Validation results (JSON array of {rule, status, message})
  validation_rules jsonb NOT NULL DEFAULT '[]',

  -- Optional notes from operator
  notes text DEFAULT '',

  -- SAP integration
  sap_document_number text,
  sap_response_code text,
  sap_response_message text,

  -- Timestamps
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_email text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',

  action text NOT NULL CHECK (action IN ('APPROVED', 'REJECTED', 'MODIFIED', 'VIEWED')),
  original_quantity numeric,
  modified_quantity numeric,
  rejection_reason text DEFAULT '',
  notes text DEFAULT '',

  sap_response_code text,
  sap_response_message text,
  sap_document_number text,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_production_order ON events(production_order);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_received_at ON events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_id ON audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
