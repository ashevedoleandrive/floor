-- Floor: account prioritization for a finite enterprise TAM.
-- Every table that stores a model-derived number also stores where it came from.

CREATE TABLE IF NOT EXISTS accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  domain          TEXT NOT NULL UNIQUE,
  name            TEXT,
  region          TEXT,              -- NORTHAMERICA | EUROPE | APAC | LATAM | AMEA
  last_touched_at TEXT,              -- ISO date. Drives cool-down. NULL = never touched.
  owner           TEXT,
  source          TEXT,              -- seed | upload | api
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accounts_region ON accounts(region);

-- One row per pipeline run against an account.
CREATE TABLE IF NOT EXISTS assessments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  run_at         TEXT NOT NULL DEFAULT (datetime('now')),
  status         TEXT NOT NULL,      -- ok | abstained | error
  -- Fit: estimated monthly transaction volume. Always a range, never a point.
  txn_min        INTEGER,
  txn_mid        INTEGER,
  txn_max        INTEGER,
  confidence     REAL,               -- 0..1, emitted by the critic, not the extractor
  floor_verdict  TEXT,               -- clears | borderline | below | unknown
  abstained      INTEGER NOT NULL DEFAULT 0,
  abstain_reason TEXT,
  method         TEXT,               -- how the estimate was derived, in one line
  -- Three dimensions. Fit answers "which", timing answers "when",
  -- cooldown answers "why not this one right now".
  fit_score      REAL,
  timing_score   REAL,
  cooldown_state TEXT,               -- eligible | suppressed | never_touched
  cooldown_until TEXT,
  total_score    REAL,
  rank_reason    TEXT,
  -- Observability
  cost_usd       REAL NOT NULL DEFAULT 0,
  latency_ms     INTEGER NOT NULL DEFAULT 0,
  cached         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_assess_account ON assessments(account_id, run_at DESC);

-- Every emitted field carries value + source + method + confidence.
-- If a claim has no row here, it does not appear on screen.
CREATE TABLE IF NOT EXISTS evidence (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  field         TEXT NOT NULL,       -- txn_volume | gmv | orders | psp | apm | market | employees
  value         TEXT NOT NULL,
  source_url    TEXT,
  source_title  TEXT,
  method        TEXT,
  confidence    REAL,
  verdict       TEXT,                -- supported | unsupported | uncertain  (from the critic)
  critic_note   TEXT
);
CREATE INDEX IF NOT EXISTS idx_evidence_assess ON evidence(assessment_id);

-- Timing: a dated reason this account is worth touching now.
CREATE TABLE IF NOT EXISTS signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,       -- expansion | funding | psp_change | leadership | outage | product
  description   TEXT NOT NULL,
  url           TEXT,
  observed_at   TEXT,
  weight        REAL NOT NULL DEFAULT 1.0
);
CREATE INDEX IF NOT EXISTS idx_signals_account ON signals(account_id);

-- Per-step model trace. This is the AI-leverage evidence: what it saw,
-- what it cost, how long it took, which model ran it.
CREATE TABLE IF NOT EXISTS traces (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  step          TEXT NOT NULL,       -- research | extract | critic
  model         TEXT NOT NULL,
  effort        TEXT,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read    INTEGER NOT NULL DEFAULT 0,
  cache_write   INTEGER NOT NULL DEFAULT 0,
  searches      INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0,
  latency_ms    INTEGER NOT NULL DEFAULT 0,
  stop_reason   TEXT,
  note          TEXT
);
CREATE INDEX IF NOT EXISTS idx_traces_assess ON traces(assessment_id);

-- Gold set: merchants whose transaction/order volume is PUBLICLY DISCLOSED.
-- Chosen deliberately so the accuracy claim is checkable by anyone in the room
-- rather than asserted at them.
CREATE TABLE IF NOT EXISTS gold_set (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  domain           TEXT NOT NULL UNIQUE,
  name             TEXT,
  disclosed_metric TEXT,             -- e.g. "orders/year", "payment transactions/quarter"
  disclosed_value  INTEGER,          -- normalised to monthly transactions
  period           TEXT,
  source_url       TEXT,
  source_note      TEXT,
  -- A gold-set row does NOT count toward accuracy until a human has opened the
  -- source and entered the figure. Seeding it with a remembered number would
  -- reproduce the exact failure this tool exists to fix.
  verified         INTEGER NOT NULL DEFAULT 0,
  verified_at      TEXT
);

CREATE TABLE IF NOT EXISTS evals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at       TEXT NOT NULL DEFAULT (datetime('now')),
  n            INTEGER NOT NULL,
  n_scored     INTEGER NOT NULL,
  in_band      INTEGER NOT NULL,     -- truth fell inside [min,max]
  order_correct INTEGER NOT NULL,    -- predicted mid within 1 order of magnitude
  abstained    INTEGER NOT NULL,
  floor_correct INTEGER NOT NULL,    -- clears/below verdict matched truth vs floor
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS eval_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_id        INTEGER NOT NULL REFERENCES evals(id) ON DELETE CASCADE,
  domain         TEXT NOT NULL,
  truth          INTEGER NOT NULL,
  pred_min       INTEGER,
  pred_mid       INTEGER,
  pred_max       INTEGER,
  in_band        INTEGER NOT NULL DEFAULT 0,
  order_correct  INTEGER NOT NULL DEFAULT 0,
  floor_correct  INTEGER NOT NULL DEFAULT 0,
  abstained      INTEGER NOT NULL DEFAULT 0,
  source_url     TEXT
);

-- Deliverable A. Multi-area, one zone per area, exec-readable.
CREATE TABLE IF NOT EXISTS backlog (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  area       TEXT NOT NULL,          -- SDR | Marketing | Learning Ops | Key Account Mgmt | Other
  title      TEXT NOT NULL,
  owner      TEXT,
  status     TEXT NOT NULL DEFAULT 'idea',   -- idea | building | live
  gap        TEXT,                   -- the gap it closes
  metric     TEXT,                   -- the number it moves
  link       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Daily spend ledger. Enforced before every model call.
CREATE TABLE IF NOT EXISTS budget (
  day       TEXT PRIMARY KEY,        -- YYYY-MM-DD (UTC)
  spend_usd REAL NOT NULL DEFAULT 0,
  calls     INTEGER NOT NULL DEFAULT 0,
  searches  INTEGER NOT NULL DEFAULT 0
);
