-- Journal des notifications push envoyées à l'admin
CREATE TABLE IF NOT EXISTS notification_log (
  id        BIGSERIAL PRIMARY KEY,
  title     TEXT        NOT NULL,
  body      TEXT        NOT NULL,
  url       TEXT,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at   TIMESTAMPTZ
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only" ON notification_log
  FOR ALL USING (is_admin());
