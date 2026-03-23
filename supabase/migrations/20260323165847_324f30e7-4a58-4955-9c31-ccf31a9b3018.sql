CREATE TABLE IF NOT EXISTS coordinator_calendar_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_config_id uuid NOT NULL REFERENCES rota_configs(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  action text NOT NULL,
  original_start_date date,
  original_end_date date,
  original_event_type text,
  recurrence text NOT NULL DEFAULT 'none',
  recurrence_dates date[],
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coordinator_calendar_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinator owns overrides"
  ON coordinator_calendar_overrides
  FOR ALL
  USING (
    rota_config_id IN (
      SELECT id FROM rota_configs WHERE owned_by = (auth.uid())::text
    )
  );