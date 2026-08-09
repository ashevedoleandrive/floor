-- Segmented accuracy.
--
-- A single accuracy percentage is not actionable. "85% accurate" tells an
-- operator nothing they can spend money on. "94% on directly disclosed counts,
-- 71% on estimates derived from dollar volume, and never measured in LATAM"
-- tells them exactly where the next investment goes.
--
-- Two dimensions turn out to matter most:
--
--   derivation  whether the figure was read off a disclosure or derived from
--               dollar volume through an assumed order-value band. Those are
--               different reliability classes and averaging them hides it.
--   region      because coverage, not accuracy, is the real constraint, and it
--               varies enormously by market.
--
-- `derivation` was computed at estimate time and thrown away, so it is added to
-- assessments and backfilled from the method sentence, which states it plainly.

ALTER TABLE assessments ADD COLUMN derivation TEXT;

UPDATE assessments
   SET derivation = CASE
         WHEN abstained = 1 THEN NULL
         WHEN method LIKE 'derived from %annual volume%' THEN 'from_gmv_with_aov'
         ELSE 'direct_count'
       END
 WHERE derivation IS NULL;

-- Eval items carry the segment they belong to, plus the confidence the tool
-- claimed at the time. Confidence is stored here so calibration can be measured
-- later: when Floor says it is 90% sure, how often is the truth actually inside
-- its range? An uncalibrated confidence score is decoration.
ALTER TABLE eval_items ADD COLUMN region     TEXT;
ALTER TABLE eval_items ADD COLUMN derivation TEXT;
ALTER TABLE eval_items ADD COLUMN confidence REAL;

CREATE INDEX IF NOT EXISTS idx_eval_items_seg ON eval_items(eval_id, region, derivation);
