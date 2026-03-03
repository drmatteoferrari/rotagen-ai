ALTER TABLE rota_configs ADD COLUMN IF NOT EXISTS owned_by text NOT NULL DEFAULT 'developer1';
CREATE INDEX IF NOT EXISTS idx_rota_configs_owned_by ON rota_configs(owned_by);