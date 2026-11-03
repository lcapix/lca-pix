-- Rate-limit counts shared by every server (lib/rate-limit.ts PostgresRateLimitStore).
-- On Vercel each warm instance kept its own counts, so a limit was "N per
-- instance"; here one row per caller and window holds the count for all of
-- them. Rows past their window are cleared as the store runs. Holds no
-- personal data beyond the key (a policy id with a user id, IP or email).
-- Runs twice without change.

CREATE UNLOGGED TABLE IF NOT EXISTS rate_limit_hits (
  bucket character varying(300) COLLATE ci NOT NULL,
  window_no bigint NOT NULL,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (bucket, window_no)
);

CREATE INDEX IF NOT EXISTS rate_limit_hits__expires ON rate_limit_hits (expires_at);
