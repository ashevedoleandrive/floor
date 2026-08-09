-- Ground truth gets a provenance, and shows its working.
--
-- Until now a gold row was either verified by a human or not verified at all.
-- That made verification a manual bottleneck: adding sources made predictions
-- better while the answer key still moved one filing at a time.
--
-- Truth can now also be established by extracting the figure from a primary
-- filing, which is a different job from the prediction pipeline. Predictions
-- research the open web and derive; extraction transcribes one stated figure
-- from one named regulator document. Different source, different method,
-- different failure modes.
--
-- What makes it trustworthy is not that a model did it, but that it shows its
-- working. The verbatim sentence is stored, so anyone doubting the figure reads
-- the sentence it came from and clicks through to the filing. That is checkable
-- by the sceptic in the room, which a human typing a number quietly never was.

ALTER TABLE gold_set ADD COLUMN verbatim       TEXT;   -- the exact sentence
ALTER TABLE gold_set ADD COLUMN raw_value      REAL;   -- the figure as printed
ALTER TABLE gold_set ADD COLUMN raw_period     TEXT;   -- the period it covers
ALTER TABLE gold_set ADD COLUMN established_by TEXT;   -- human | extraction
ALTER TABLE gold_set ADD COLUMN established_at TEXT;
ALTER TABLE gold_set ADD COLUMN truth_flags    TEXT;   -- reconciliation warnings

-- Existing verified rows were established by a person, by definition.
UPDATE gold_set SET established_by = 'human', established_at = verified_at
 WHERE verified = 1 AND established_by IS NULL;
