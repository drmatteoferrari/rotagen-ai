CREATE TABLE IF NOT EXISTS public.resolved_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_config_id  uuid NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  doctor_id       uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  date            date NOT NULL,
  status          text NOT NULL,
  source          text NOT NULL CHECK (source IN ('survey', 'coordinator_override')),
  override_id     uuid REFERENCES public.coordinator_calendar_overrides(id) ON DELETE SET NULL,
  rebuilt_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rota_config_id, doctor_id, date)
);

ALTER TABLE public.resolved_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinator owns their resolved_availability"
  ON public.resolved_availability
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM rota_configs
    WHERE rota_configs.id = resolved_availability.rota_config_id
      AND rota_configs.owned_by = (auth.uid())::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rota_configs
    WHERE rota_configs.id = resolved_availability.rota_config_id
      AND rota_configs.owned_by = (auth.uid())::text
  ));