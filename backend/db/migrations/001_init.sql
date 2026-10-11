-- Moon Star Power & Technology — core schema (PostgreSQL / Supabase)
-- Money: NUMERIC(14,2). Quantities: NUMERIC(14,3). Never floats.

CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE permissions (
  key         TEXT PRIMARY KEY,
  grp         TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id  INT  NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  perm_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, perm_key)
);

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL,
  name                  TEXT NOT NULL,
  phone                 TEXT,
  designation           TEXT,
  password_hash         TEXT NOT NULL,
  role_id               INT  NOT NULL REFERENCES roles(id),
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  is_signatory          BOOLEAN NOT NULL DEFAULT FALSE, -- authorised by company to appear as signatory
  signatory_title       TEXT,
  must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));
CREATE INDEX users_role_idx ON users (role_id);

-- Per-user permission overrides on top of the role defaults (granted=false removes a permission)
CREATE TABLE user_permissions (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perm_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted  BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, perm_key)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_exp_idx ON sessions (expires_at);

CREATE TABLE login_attempts (
  id      BIGSERIAL PRIMARY KEY,
  key     TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_key_at_idx ON login_attempts (key, at DESC);

-- Location hierarchy: Area -> Housing -> Project
CREATE TABLE areas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX areas_name_idx ON areas (lower(name));

CREATE TABLE housings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id    UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX housings_area_name_idx ON housings (area_id, lower(name));

CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id         UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  housing_id      UUID REFERENCES housings(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  house_no        TEXT,
  road_no         TEXT,
  block           TEXT,
  client_name     TEXT,
  engineer_name   TEXT,
  engineer_phone  TEXT,
  address         TEXT,
  total_load_kw   NUMERIC(12,2) CHECK (total_load_kw IS NULL OR total_load_kw >= 0),
  max_demand_kw   NUMERIC(12,2) CHECK (max_demand_kw IS NULL OR max_demand_kw >= 0),
  category        TEXT NOT NULL DEFAULT 'residential',
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_area_idx ON projects (area_id);
CREATE INDEX projects_housing_idx ON projects (housing_id);
CREATE INDEX projects_name_idx ON projects (lower(name));
CREATE INDEX projects_updated_idx ON projects (updated_at DESC);

CREATE TABLE project_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  url         TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_attachments_project_idx ON project_attachments (project_id);

-- Catalogue
CREATE TABLE product_categories (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 TEXT NOT NULL,
  name                TEXT NOT NULL,
  category_id         INT NOT NULL REFERENCES product_categories(id),
  brand               TEXT,
  model               TEXT,
  specs               JSONB NOT NULL DEFAULT '{}'::jsonb,
  unit                TEXT NOT NULL DEFAULT 'nos',
  price               NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost                NUMERIC(14,2) CHECK (cost IS NULL OR cost >= 0),
  price_effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  qty_rule            JSONB NOT NULL DEFAULT '{"type":"fixed","qty":1}'::jsonb,
  capacity_kva        NUMERIC(10,2),
  capacity_kvar       NUMERIC(10,2),
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  public_visible      BOOLEAN NOT NULL DEFAULT FALSE,
  public_summary      TEXT,
  notes               TEXT,
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX products_sku_idx ON products (upper(sku));
CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_active_idx ON products (active, category_id);
CREATE INDEX products_capacity_idx ON products (capacity_kva) WHERE capacity_kva IS NOT NULL;

CREATE TABLE price_history (
  id             BIGSERIAL PRIMARY KEY,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price          NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  cost           NUMERIC(14,2) CHECK (cost IS NULL OR cost >= 0),
  effective_from TIMESTAMPTZ NOT NULL,
  reason         TEXT,
  changed_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX price_history_product_idx ON price_history (product_id, effective_from DESC);

-- Quotation numbering: one atomic counter row per year
CREATE TABLE quote_counters (
  year INT PRIMARY KEY,
  n    INT NOT NULL
);

CREATE TABLE quotations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number           TEXT NOT NULL UNIQUE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  created_by       UUID NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'draft',
  current_version  INT NOT NULL DEFAULT 1,
  approved_version INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quotations_project_idx ON quotations (project_id);
CREATE INDEX quotations_status_idx ON quotations (status);
CREATE INDEX quotations_creator_idx ON quotations (created_by);
CREATE INDEX quotations_created_idx ON quotations (created_at DESC);

CREATE TABLE quotation_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
  version         INT  NOT NULL CHECK (version >= 1),
  locked          BOOLEAN NOT NULL DEFAULT FALSE,
  quotation_date  DATE NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  prepared_by     JSONB NOT NULL,          -- snapshot: name, designation, phone, email
  reason          TEXT,                    -- reason for revision
  tech_input      JSONB NOT NULL DEFAULT '{}'::jsonb,
  tech_result     JSONB,
  tech_override   JSONB,                   -- {by, reason, recommendedKva, at}
  commercial      JSONB NOT NULL DEFAULT '{}'::jsonb,
  terms           JSONB NOT NULL DEFAULT '{}'::jsonb, -- template snapshot (terms, payment terms, validity...)
  signatory       JSONB,                   -- {name,title,authorised}
  client          JSONB NOT NULL DEFAULT '{}'::jsonb, -- project/client snapshot used on the PDF
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
  charges_total   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost_total      NUMERIC(14,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quotation_id, version)
);
CREATE INDEX quotation_versions_q_idx ON quotation_versions (quotation_id, version DESC);

CREATE TABLE quotation_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id     UUID NOT NULL REFERENCES quotation_versions(id) ON DELETE CASCADE,
  position       INT NOT NULL,
  product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  sku            TEXT,
  name           TEXT NOT NULL,
  description    TEXT,
  unit           TEXT NOT NULL,
  qty            NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  unit_price     NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  cost_price     NUMERIC(14,2),
  discount_type  TEXT NOT NULL DEFAULT 'none',
  discount_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total     NUMERIC(14,2) NOT NULL,
  is_manual      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX quotation_items_version_idx ON quotation_items (version_id, position);

CREATE TABLE approvals (
  id           BIGSERIAL PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
  version      INT NOT NULL,
  kind         TEXT NOT NULL,   -- technical | commercial
  decision     TEXT NOT NULL,   -- approved | rejected | returned
  note         TEXT,
  decided_by   UUID NOT NULL REFERENCES users(id),
  decided_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX approvals_q_idx ON approvals (quotation_id, version);

CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
  version      INT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'quotation_pdf',
  file_name    TEXT NOT NULL,
  sha256       TEXT NOT NULL,
  size_bytes   INT NOT NULL,
  generated_by UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX documents_q_idx ON documents (quotation_id, version);

CREATE TABLE work_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id   UUID NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
  version        INT NOT NULL,
  wo_number      TEXT NOT NULL,
  received_date  DATE NOT NULL,
  final_value    NUMERIC(14,2) NOT NULL CHECK (final_value >= 0),
  material_list  JSONB NOT NULL DEFAULT '[]'::jsonb,
  milestones     JSONB NOT NULL DEFAULT '[]'::jsonb,
  warranty       JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes          TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX work_orders_number_idx ON work_orders (lower(wo_number));
CREATE INDEX work_orders_q_idx ON work_orders (quotation_id);
CREATE INDEX work_orders_date_idx ON work_orders (received_date);

CREATE TABLE audit_logs (
  id        BIGSERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id   UUID,
  user_name TEXT,
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT,
  detail    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip        TEXT
);
CREATE INDEX audit_logs_at_idx ON audit_logs (at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity, entity_id);
CREATE INDEX audit_logs_action_idx ON audit_logs (action);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inquiries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  company    TEXT,
  phone      TEXT NOT NULL,
  email      TEXT,
  service    TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inquiries_created_idx ON inquiries (created_at DESC);

-- ---------------------------------------------------------------------------
-- Immutability: once a version is locked neither it nor its items may change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_locked_version() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.locked THEN RAISE EXCEPTION 'Quotation version % is locked and cannot be deleted', OLD.version; END IF;
    RETURN OLD;
  END IF;
  IF OLD.locked THEN
    RAISE EXCEPTION 'Quotation version % is locked and cannot be modified', OLD.version;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER quotation_versions_guard
  BEFORE UPDATE OR DELETE ON quotation_versions
  FOR EACH ROW EXECUTE FUNCTION guard_locked_version();

CREATE OR REPLACE FUNCTION guard_locked_items() RETURNS trigger AS $$
DECLARE v_locked BOOLEAN; vid UUID;
BEGIN
  vid := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  SELECT locked INTO v_locked FROM quotation_versions WHERE id = vid;
  IF COALESCE(v_locked, FALSE) THEN
    RAISE EXCEPTION 'Items of a locked quotation version cannot be changed';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER quotation_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_items
  FOR EACH ROW EXECUTE FUNCTION guard_locked_items();

-- Audit logs are append-only.
CREATE OR REPLACE FUNCTION audit_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_append_only();

-- Supabase: the app connects with a server-side role. Block direct API access to every table.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
