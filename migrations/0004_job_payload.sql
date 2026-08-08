-- One Worker invocation cannot hold a three-minute model call: Cloudflare kills
-- it, and the job row is orphaned mid-stage with no error and no cost recorded.
-- Observed in production on jobs 1 and 2.
--
-- Fix: one stage per invocation, chained. The job carries its own state between
-- invocations, so each invocation makes exactly one model call and returns well
-- inside the limit.
ALTER TABLE jobs ADD COLUMN payload TEXT;
ALTER TABLE jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
UPDATE jobs SET status='error', detail='orphaned: worker terminated mid-stage before stage chaining existed' WHERE status='running';
