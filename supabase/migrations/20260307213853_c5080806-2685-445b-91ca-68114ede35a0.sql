CREATE TABLE IF NOT EXISTS pre_rota_results (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_config_id    uuid NOT NULL REFERENCES rota_configs(id),
  generated_at      timestamptz NOT NULL DEFAULT now(),
  generated_by      text NOT NULL,
  status            text NOT NULL CHECK (status IN ('blocked', 'complete_with_warnings', 'complete')),
  validation_issues jsonb NOT NULL DEFAULT '[]',
  calendar_data     jsonb NOT NULL DEFAULT '{}',
  targets_data      jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  UNIQUE (rota_config_id)
);

ALTER TABLE pre_rota_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON pre_rota_results FOR ALL USING (true) WITH CHECK (true);