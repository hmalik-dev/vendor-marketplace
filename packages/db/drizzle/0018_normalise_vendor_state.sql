-- #332 closes `state` to the two-letter USPS code. This is the **data** half
-- and it has to run first: the DDL that follows casts `vendor_profiles.state`
-- to the new `us_state` type, and that cast fails on exactly the row that
-- motivated the ticket — the one holding `Texas` where every other row holds
-- `TX`.
--
-- The split was invisible and widening. `Austin, TX` and `Austin, Texas` were
-- two rows in one database, so a customer who picked one never saw the other's
-- vendors, and the form offered full names while most rows already held codes.
--
-- Matched on the trimmed, case-folded name, so `texas`, `Texas ` and `TEXAS`
-- all land on `TX`. Rows already holding a code are untouched: the join finds
-- no name for them.
UPDATE "vendor_profiles" AS vp
   SET "state" = m.code
  FROM (VALUES
    ('alabama', 'AL'), ('alaska', 'AK'), ('arizona', 'AZ'), ('arkansas', 'AR'),
    ('california', 'CA'), ('colorado', 'CO'), ('connecticut', 'CT'),
    ('delaware', 'DE'), ('district of columbia', 'DC'), ('florida', 'FL'),
    ('georgia', 'GA'), ('hawaii', 'HI'), ('idaho', 'ID'), ('illinois', 'IL'),
    ('indiana', 'IN'), ('iowa', 'IA'), ('kansas', 'KS'), ('kentucky', 'KY'),
    ('louisiana', 'LA'), ('maine', 'ME'), ('maryland', 'MD'),
    ('massachusetts', 'MA'), ('michigan', 'MI'), ('minnesota', 'MN'),
    ('mississippi', 'MS'), ('missouri', 'MO'), ('montana', 'MT'),
    ('nebraska', 'NE'), ('nevada', 'NV'), ('new hampshire', 'NH'),
    ('new jersey', 'NJ'), ('new mexico', 'NM'), ('new york', 'NY'),
    ('north carolina', 'NC'), ('north dakota', 'ND'), ('ohio', 'OH'),
    ('oklahoma', 'OK'), ('oregon', 'OR'), ('pennsylvania', 'PA'),
    ('rhode island', 'RI'), ('south carolina', 'SC'), ('south dakota', 'SD'),
    ('tennessee', 'TN'), ('texas', 'TX'), ('utah', 'UT'), ('vermont', 'VT'),
    ('virginia', 'VA'), ('washington', 'WA'), ('west virginia', 'WV'),
    ('wisconsin', 'WI'), ('wyoming', 'WY')
  ) AS m(name, code)
 WHERE lower(btrim(vp."state")) = m.name;
--> statement-breakpoint
-- A code that arrived in the wrong case is still a code, and upper-casing it is
-- not a guess about what the vendor meant.
UPDATE "vendor_profiles"
   SET "state" = upper(btrim("state"))
 WHERE "state" IS NOT NULL
   AND length(btrim("state")) = 2
   AND upper(btrim("state")) <> "state";
--> statement-breakpoint
-- An empty string is not a state. It would fail the cast, and it already means
-- "unset" everywhere that reads it.
UPDATE "vendor_profiles" SET "state" = NULL WHERE btrim("state") = '';
--> statement-breakpoint
-- Deliberately no catch-all. Anything still not a valid code reaches the cast
-- in the next migration and fails it loudly, which is the correct outcome:
-- mapping an unrecognised value to NULL would silently drop that vendor out of
-- every search filtered on state, and guessing would put them in the wrong one.
-- A failure here is real data needing a decision, not a missing default.
SELECT 1;
