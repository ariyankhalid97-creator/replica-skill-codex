PRAGMA foreign_keys = ON;

CREATE TABLE documents (
  id TEXT PRIMARY KEY NOT NULL,
  content_uri TEXT NOT NULL,
  display_name TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  page_count INTEGER,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  password_required INTEGER NOT NULL DEFAULT 0 CHECK (password_required IN (0, 1)),
  last_opened_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX documents_uri_idx ON documents(content_uri);
CREATE INDEX documents_recent_idx ON documents(last_opened_at DESC);

CREATE TABLE extraction_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('table', 'fields', 'text')),
  page_range TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'complete', 'canceled', 'failed')),
  engine_version TEXT NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX extraction_jobs_document_idx ON extraction_jobs(document_id, created_at DESC);
CREATE INDEX extraction_jobs_state_idx ON extraction_jobs(state);

CREATE TABLE table_results (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL REFERENCES extraction_jobs(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL CHECK (page_index >= 0),
  region_json TEXT NOT NULL,
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  column_count INTEGER NOT NULL CHECK (column_count >= 0),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX table_results_job_idx ON table_results(job_id, page_index);

CREATE TABLE cells (
  id TEXT PRIMARY KEY NOT NULL,
  table_id TEXT NOT NULL REFERENCES table_results(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL CHECK (row_index >= 0),
  column_index INTEGER NOT NULL CHECK (column_index >= 0),
  row_span INTEGER NOT NULL DEFAULT 1 CHECK (row_span > 0),
  column_span INTEGER NOT NULL DEFAULT 1 CHECK (column_span > 0),
  raw_text TEXT NOT NULL DEFAULT '',
  corrected_text TEXT,
  bounds_json TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(table_id, row_index, column_index)
);
CREATE INDEX cells_table_idx ON cells(table_id, row_index, column_index);

CREATE TABLE field_results (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL REFERENCES extraction_jobs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  label_bounds_json TEXT,
  value_bounds_json TEXT,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX field_results_job_idx ON field_results(job_id);

CREATE TABLE edit_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  output_uri TEXT,
  operation_log_json TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK (state IN ('draft', 'saving', 'saved', 'failed', 'discarded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX edit_sessions_document_idx ON edit_sessions(document_id, created_at DESC);

CREATE TABLE edit_operations (
  id TEXT PRIMARY KEY NOT NULL,
  edit_session_id TEXT NOT NULL REFERENCES edit_sessions(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL CHECK (page_index >= 0),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('text_edit', 'text_overlay', 'image_overlay', 'redaction', 'annotation', 'signature', 'form_fill', 'page_change')),
  source_bounds_json TEXT,
  style_snapshot_json TEXT,
  font_match_state TEXT CHECK (font_match_state IN ('exact', 'compatible', 'overlay', 'not_applicable', 'unsupported')),
  font_match_score REAL CHECK (font_match_score IS NULL OR (font_match_score >= 0 AND font_match_score <= 1)),
  validation_state TEXT NOT NULL DEFAULT 'pending' CHECK (validation_state IN ('pending', 'passed', 'warning', 'failed')),
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX edit_operations_session_idx ON edit_operations(edit_session_id, page_index);

CREATE TABLE signature_assets (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('vector_strokes', 'transparent_bitmap')),
  local_uri TEXT NOT NULL,
  width REAL NOT NULL CHECK (width > 0),
  height REAL NOT NULL CHECK (height > 0),
  device_auth_required INTEGER NOT NULL DEFAULT 0 CHECK (device_auth_required IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX signature_assets_recent_idx ON signature_assets(updated_at DESC);

CREATE TABLE entitlements (
  product_id TEXT PRIMARY KEY NOT NULL,
  purchase_token_hash TEXT,
  state TEXT NOT NULL CHECK (state IN ('none', 'pending', 'active', 'grace', 'hold', 'canceled', 'expired')),
  expiry_at INTEGER,
  last_checked_at INTEGER,
  updated_at INTEGER NOT NULL
);

