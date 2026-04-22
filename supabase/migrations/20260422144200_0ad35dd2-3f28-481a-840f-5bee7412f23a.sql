CREATE TABLE IF NOT EXISTS public.final_rota_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_config_id        uuid NOT NULL REFERENCES public.rota_configs(id) ON DELETE CASCADE,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  status                text NOT NULL CHECK (status IN ('complete', 'complete_with_gaps', 'failed', 'cancelled')),
  iterations_completed  integer NOT NULL DEFAULT 0,
  iterations_target     integer NOT NULL DEFAULT 0,
  runtime_ms            integer NOT NULL DEFAULT 0,
  assignments           jsonb NOT NULL DEFAULT '{}'::jsonb,
  score                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  per_doctor            jsonb NOT NULL DEFAULT '[]'::jsonb,
  swap_log              jsonb NOT NULL DEFAULT '[]'::jsonb,
  violations            jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_final_rota_results_config_generated
  ON public.final_rota_results (rota_config_id, generated_at DESC);

ALTER TABLE public.final_rota_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinator owns their final_rota_results"
  ON public.final_rota_results
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rota_configs
    WHERE rota_configs.id = final_rota_results.rota_config_id
      AND rota_configs.owned_by = (auth.uid())::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rota_configs
    WHERE rota_configs.id = final_rota_results.rota_config_id
      AND rota_configs.owned_by = (auth.uid())::text
  ));