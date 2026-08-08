-- Operability: make every destructive action reversible, and make the inputs
-- that feed scoring correctable.
--
-- The rule this migration exists to serve: an action is only reversible if it is
-- reversible in the interface. Hard deletes cannot offer undo, so nothing here
-- deletes. Archiving sets a timestamp, un-archiving clears it, and the row is
-- intact the whole time.
--
-- The sharpest gap it closes: last_touched_at feeds the cool-down dimension of
-- the score and could only ever be set at assess time. An account suppressed on
-- a wrong date stayed wrongly suppressed with no way back.

ALTER TABLE accounts    ADD COLUMN archived_at TEXT;
ALTER TABLE assessments ADD COLUMN deleted_at  TEXT;
ALTER TABLE backlog     ADD COLUMN archived_at TEXT;
ALTER TABLE gold_set    ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_accounts_live    ON accounts(archived_at);
CREATE INDEX IF NOT EXISTS idx_assessments_live ON assessments(account_id, deleted_at);

-- Who changed the qualification floor, and when. Settings silently re-grade every
-- stored assessment on the next render, so a change with no record is a change
-- nobody can explain later.
CREATE TABLE IF NOT EXISTS settings_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_settings_log ON settings_log(key, changed_at);
