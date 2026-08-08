-- Seed data.
--
-- Two deliberate choices here:
--
-- 1. The account list is REAL enterprise merchants that plausibly sit in Yuno's
--    ICP, excluding every logo Yuno already names as a customer. It doubles as
--    the "name ten target accounts" answer.
--
-- 2. The gold set ships UNVERIFIED. Each row names a merchant that publicly
--    discloses a volume figure and points at where to find it, but the number
--    is entered by hand after opening the source. Pre-filling it from memory
--    would be the exact failure this tool exists to prevent, and the accuracy
--    claim has to be checkable by anyone in the room, not asserted at them.

INSERT OR IGNORE INTO settings(key, value) VALUES
  ('floor_txn', '100000'),
  ('cooldown_days', '45'),
  ('search_usd', '0'),
  ('acv_usd', '');

-- ---------------------------------------------------------------------------
-- Target universe. last_touched_at drives the cool-down dimension; a spread of
-- recent / stale / never-touched is what makes the "and when" half visible.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO accounts(domain, name, region, last_touched_at, owner, source) VALUES
  -- North America (stated priority 1)
  ('doordash.com',      'DoorDash',            'NORTHAMERICA', NULL,         'SDR 1', 'seed'),
  ('instacart.com',     'Instacart',           'NORTHAMERICA', '2026-07-28', 'SDR 1', 'seed'),
  ('chewy.com',         'Chewy',               'NORTHAMERICA', NULL,         'SDR 2', 'seed'),
  ('wayfair.com',       'Wayfair',             'NORTHAMERICA', '2026-05-02', 'SDR 2', 'seed'),
  ('ae.com',            'American Eagle',      'NORTHAMERICA', NULL,         'SDR 1', 'seed'),
  ('express.com',       'Express',             'NORTHAMERICA', NULL,         'SDR 2', 'seed'),
  ('aeropostale.com',   'Aeropostale',         'NORTHAMERICA', NULL,         'SDR 2', 'seed'),
  ('sephora.com',       'Sephora',             'NORTHAMERICA', '2026-07-15', 'SDR 1', 'seed'),
  ('lululemon.com',     'Lululemon',           'NORTHAMERICA', NULL,         'SDR 1', 'seed'),
  ('gopuff.com',        'Gopuff',              'NORTHAMERICA', '2026-03-11', 'SDR 2', 'seed'),
  ('turo.com',          'Turo',                'NORTHAMERICA', NULL,         'SDR 2', 'seed'),
  ('etsy.com',          'Etsy',                'NORTHAMERICA', '2026-06-20', 'SDR 1', 'seed'),
  ('peloton.com',       'Peloton',             'NORTHAMERICA', NULL,         'SDR 2', 'seed'),
  ('roblox.com',        'Roblox',              'NORTHAMERICA', NULL,         'SDR 1', 'seed'),

  -- Europe (stated priority 2)
  ('zalando.com',       'Zalando',             'EUROPE',       NULL,         'SDR AMEA', 'seed'),
  ('asos.com',          'ASOS',                'EUROPE',       '2026-07-30', 'SDR AMEA', 'seed'),
  ('vinted.com',        'Vinted',              'EUROPE',       NULL,         'SDR AMEA', 'seed'),
  ('deliveroo.co.uk',   'Deliveroo',           'EUROPE',       NULL,         'SDR AMEA', 'seed'),
  ('justeattakeaway.com','Just Eat Takeaway',  'EUROPE',       '2026-04-18', 'SDR AMEA', 'seed'),
  ('deliveryhero.com',  'Delivery Hero',       'EUROPE',       NULL,         'SDR AMEA', 'seed'),
  ('glovoapp.com',      'Glovo',               'EUROPE',       NULL,         'SDR AMEA', 'seed'),
  ('wolt.com',          'Wolt',                'EUROPE',       NULL,         'SDR AMEA', 'seed'),
  ('allegro.pl',        'Allegro',             'EUROPE',       NULL,         'SDR AMEA', 'seed'),
  ('farfetch.com',      'Farfetch',            'EUROPE',       '2026-02-09', 'SDR AMEA', 'seed'),
  ('booking.com',       'Booking.com',         'EUROPE',       NULL,         'SDR AMEA', 'seed'),

  -- APAC (stated priority 3, fragmented, orchestration fits)
  ('shein.com',         'SHEIN',               'APAC',         NULL,         'SDR APAC', 'seed'),
  ('temu.com',          'Temu',                'APAC',         NULL,         'SDR APAC', 'seed'),
  ('coupang.com',       'Coupang',             'APAC',         NULL,         'SDR APAC', 'seed'),
  ('grab.com',          'Grab',                'APAC',         '2026-07-22', 'SDR APAC', 'seed'),
  ('lazada.com',        'Lazada',              'APAC',         NULL,         'SDR APAC', 'seed'),
  ('trip.com',          'Trip.com',            'APAC',         NULL,         'SDR APAC', 'seed'),
  ('klook.com',         'Klook',               'APAC',         NULL,         'SDR APAC', 'seed'),

  -- LATAM (stated as saturated / commercially limited — proves the weighting)
  ('mercadolibre.com',  'Mercado Libre',       'LATAM',        NULL,         'SDR LATAM', 'seed'),
  ('kavak.com',         'Kavak',               'LATAM',        NULL,         'SDR LATAM', 'seed'),

  -- AMEA
  ('jumia.com',         'Jumia',               'AMEA',         NULL,         'SDR AMEA', 'seed'),
  ('noon.com',          'Noon',                'AMEA',         NULL,         'SDR AMEA', 'seed'),

  -- Deliberately small: the queue has to be able to say "below floor" and mean it.
  ('darngoodyarn.com',  'Darn Good Yarn',      'NORTHAMERICA', NULL,         NULL, 'seed'),
  ('beardbrand.com',    'Beardbrand',          'NORTHAMERICA', NULL,         NULL, 'seed');

-- ---------------------------------------------------------------------------
-- Gold set candidates. verified = 0 until a human opens the source and enters
-- the figure. The eval refuses to score unverified rows.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO gold_set(domain, name, disclosed_metric, source_note, verified) VALUES
  ('doordash.com',       'DoorDash',           'total orders / quarter',              'Quarterly shareholder letter reports Total Orders.', 0),
  ('etsy.com',           'Etsy',               'GMS + transactions / quarter',        '10-Q reports GMS; transaction count derivable from disclosed AOV.', 0),
  ('deliveryhero.com',   'Delivery Hero',      'orders / quarter',                    'Quarterly trading update reports group orders.', 0),
  ('justeattakeaway.com','Just Eat Takeaway',  'orders / quarter',                    'Trading update reports group orders.', 0),
  ('coupang.com',        'Coupang',            'active customers + revenue / quarter','10-Q; per-customer spend disclosed.', 0),
  ('grab.com',           'Grab',               'GMV + transactions / quarter',        'Quarterly report discloses on-demand GMV.', 0),
  ('mercadolibre.com',   'Mercado Libre',      'payment transactions / quarter',      '10-Q discloses total payment transactions.', 0),
  ('zalando.com',        'Zalando',            'orders / year',                       'Annual report discloses number of orders.', 0),
  ('asos.com',           'ASOS',               'orders / year',                       'Annual results disclose total orders.', 0),
  ('booking.com',        'Booking Holdings',   'room nights booked / quarter',        '10-Q discloses room nights.', 0),
  ('trip.com',           'Trip.com Group',     'bookings / quarter',                  '20-F / quarterly results.', 0),
  ('jumia.com',          'Jumia',              'orders / quarter',                    'Quarterly results disclose orders.', 0),
  ('allegro.pl',         'Allegro',            'GMV + transactions / quarter',        'Quarterly report discloses GMV and items sold.', 0),
  ('roblox.com',         'Roblox',             'bookings + DAU / quarter',            'Supplemental materials disclose bookings.', 0),
  ('chewy.com',          'Chewy',              'net sales + active customers / qtr',  '10-Q discloses active customers and NSPAC.', 0),
  ('wayfair.com',        'Wayfair',            'orders delivered / quarter',          '10-Q discloses orders delivered.', 0),
  ('peloton.com',        'Peloton',            'subscriptions / quarter',             '10-Q discloses connected fitness subscriptions.', 0),
  ('farfetch.com',       'Farfetch',           'orders / quarter',                    'Historic filings disclose order counts.', 0),
  ('vinted.com',         'Vinted',             'transactions / year',                 'Annual report / press releases.', 0),
  ('turo.com',           'Turo',               'trip days / year',                    'S-1 discloses trip days.', 0),
  ('instacart.com',      'Maplebear (Instacart)','orders / quarter',                  '10-Q discloses total orders.', 0),
  ('lululemon.com',      'Lululemon',          'net revenue / quarter',               '10-Q; transaction count derivable from disclosed AOV.', 0);

-- ---------------------------------------------------------------------------
-- Backlog seed. Floor appears as its own first card so the two deliverables
-- read as one system rather than two homework assignments.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO backlog(area, title, owner, status, gap, metric, link) VALUES
  ('SDR', 'Floor — account prioritisation with a trust layer', 'GTM Eng', 'live',
   'Gap 01 + 02: which accounts to prioritise and when, with numbers you can check',
   'Outbound win rate 4.6% to 11.5%', '/'),
  ('SDR', 'Salesforce write-back for Floor scores', 'GTM Eng', 'idea',
   'Scores live outside the system the team is measured in',
   'Accounts worked per SDR 60-70 to 100', ''),
  ('Marketing', 'Checkout-intelligence feed for campaign targeting', 'GTM Eng', 'idea',
   'Campaigns cannot segment on payments footprint',
   'Worked-account to opportunity 7% to 10.5%', ''),
  ('Key Account Mgmt', 'Expansion-signal watch on live merchants', 'GTM Eng', 'idea',
   'New-market launches by existing customers are found by hand',
   'Net revenue retention', '');
