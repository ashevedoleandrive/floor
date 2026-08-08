-- Source classification, deterministic and operator-owned.
--
-- The extractor used to rate "source quality" by judgement, and it drifted:
-- Etsy's single 10-K produced six different scores across ten claims, a 0.37
-- spread from a document that never changed. A rating that moves when nothing
-- moved is worse than no rating.
--
-- So classification moves into rules matched against the source URL. Same link,
-- same tier, every time, and anyone can audit it by looking at where it points.
--
-- These live in the database rather than in code because the people who run
-- this will not have access to the person who wrote it. Adding a registry,
-- demoting an aggregator or re-weighting a tier has to be something an operator
-- does in the UI, or the tool only works for its author.
--
-- Rules are evaluated by position, first match wins, so specific patterns sit
-- above general ones.

CREATE TABLE IF NOT EXISTS source_rules (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  position INTEGER NOT NULL,
  pattern  TEXT NOT NULL,          -- matched against the full source URL, case-insensitive substring
  tier     TEXT NOT NULL,          -- primary_filing | self_published | third_party | documentation | unclassified
  weight   REAL NOT NULL,          -- 0..1, what this tier is worth when scoring
  label    TEXT NOT NULL,          -- what an operator sees on screen
  note     TEXT,                   -- why this rule exists
  enabled  INTEGER NOT NULL DEFAULT 1,
  builtin  INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rules_pos ON source_rules(enabled, position);

INSERT OR IGNORE INTO source_rules (position, pattern, tier, weight, label, note, builtin) VALUES
  (10,  'sec.gov',              'primary_filing', 1.00, 'Regulatory filing',  'US regulator. The strongest evidence available at any price.', 1),
  (20,  '/sec-filings',         'primary_filing', 1.00, 'Regulatory filing',  'Company-hosted copy of a filing it was legally obliged to make.', 1),
  (30,  'investors.',           'primary_filing', 0.95, 'Investor relations', 'Investor-relations disclosure. Obliged to be accurate to shareholders.', 1),
  (40,  'investor.',            'primary_filing', 0.95, 'Investor relations', 'Investor-relations disclosure.', 1),
  (50,  '/annual-report',       'primary_filing', 0.95, 'Annual report',      'Audited annual accounts.', 1),
  (60,  'companieshouse.gov.uk','primary_filing', 1.00, 'Statutory filing',   'UK statutory accounts. Every UK limited company must file.', 1),
  (70,  'bundesanzeiger.de',    'primary_filing', 1.00, 'Statutory filing',   'German federal gazette. Mandatory annual accounts.', 1),
  (80,  'about.',               'self_published', 0.75, 'Company statement',  'Company speaking about itself. Credible on its own facts, weaker on market claims.', 1),
  (90,  '/newsroom',            'self_published', 0.75, 'Company statement',  'Company press release.', 1),
  (100, '/press',               'self_published', 0.75, 'Company statement',  'Company press release.', 1),
  (110, 'marketplacepulse.com', 'third_party',    0.45, 'Third-party estimate','Aggregator model, not a disclosure. Useful for direction, not for a number.', 1),
  (120, 'statista.com',         'third_party',    0.45, 'Third-party estimate','Aggregator model, not a disclosure.', 1),
  (130, 'similarweb.com',       'third_party',    0.45, 'Third-party estimate','Modelled traffic estimate.', 1),
  (140, 'help.',                'documentation',  0.55, 'Product documentation','Accurate about how the product works, silent on scale.', 1),
  (150, '/help/',               'documentation',  0.55, 'Product documentation','Accurate about how the product works, silent on scale.', 1),
  (160, '/legal/',              'documentation',  0.55, 'Product documentation','Terms and policy pages. Reliable on what is offered.', 1),
  (170, 'blog.',                'documentation',  0.40, 'Blog or commentary', 'Editorial. Treat any figure in it as second-hand.', 1);

-- Tier weights are themselves operator-editable, so a team that trusts
-- aggregators more or less than we do can say so without a deploy.
INSERT OR IGNORE INTO settings(key, value) VALUES
  ('tier_unclassified_weight', '0.35');
