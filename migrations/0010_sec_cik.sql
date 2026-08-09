-- Whether a merchant is reachable in EDGAR, stored rather than rediscovered.
--
-- The Accuracy page was offering "Establish from filings" on every row,
-- including merchants that file nowhere near the SEC. ASOS is LSE-listed,
-- Zalando is Frankfurt, Farfetch went private. Clicking spent a request to be
-- told what was knowable before the button was drawn.
--
-- Resolution already happens during research, so the answer is free; it was
-- simply thrown away. Storing it lets the interface offer the action only where
-- it can succeed, and say plainly why it cannot elsewhere. A merchant that
-- files somewhere other than the SEC is a coverage fact, not a failure, and it
-- is what Companies House and the EU registries are for.
ALTER TABLE accounts ADD COLUMN sec_cik TEXT;
ALTER TABLE accounts ADD COLUMN sec_checked_at TEXT;
