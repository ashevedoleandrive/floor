-- Assessments run long: web research plus an adversarial critic pass is a
-- two-to-four minute job, which no HTTP request should be holding open. The
-- first production run proved it — the request died at the edge while the
-- pipeline was still working.
--
-- Jobs make the run observable instead of opaque: the UI shows which stage is
-- running, and a batch of accounts is just many rows in this table.

CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  domain        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | error
  stage         TEXT,                            -- research | extract | critic | scoring
  detail        TEXT,
  assessment_id INTEGER,
  cost_usd      REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_domain ON jobs(domain, id DESC);
