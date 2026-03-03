
CREATE TABLE IF NOT EXISTS account_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_by      text NOT NULL UNIQUE,
  department_name text,
  trust_name    text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_settings_owned_by ON account_settings(owned_by);

ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access" ON account_settings FOR ALL USING (true) WITH CHECK (true);
