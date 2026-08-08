-- The language a run was executed in.
--
-- Stored per job rather than read from the current UI setting, so a Spanish run
-- stays Spanish across all three stages even if someone flips the toggle while
-- it is mid-flight. Evidence is written in the language it was reasoned in.
ALTER TABLE jobs ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
ALTER TABLE assessments ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
