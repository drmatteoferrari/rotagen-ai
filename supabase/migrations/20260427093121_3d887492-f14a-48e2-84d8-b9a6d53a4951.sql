-- ============================================================
-- RLS TIGHTENING — COORDINATOR-ONLY TABLES (idempotent)
-- ============================================================

-- ── 1. shift_types ──────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public access" ON public.shift_types;
DROP POLICY IF EXISTS "Authenticated users full access on shift_types" ON public.shift_types;
DROP POLICY IF EXISTS "Coordinator owns their shift_types" ON public.shift_types;
DROP POLICY IF EXISTS "Public read for survey context" ON public.shift_types;

CREATE POLICY "Coordinator owns their shift_types"
  ON public.shift_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = shift_types.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = shift_types.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  );

-- ── 2. wtr_settings ─────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public access" ON public.wtr_settings;
DROP POLICY IF EXISTS "Authenticated users full access on wtr_settings" ON public.wtr_settings;
DROP POLICY IF EXISTS "Coordinator owns their wtr_settings" ON public.wtr_settings;

CREATE POLICY "Coordinator owns their wtr_settings"
  ON public.wtr_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = wtr_settings.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = wtr_settings.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  );

-- ── 3. pre_rota_results ──────────────────────────────────────
DROP POLICY IF EXISTS "Allow public access" ON public.pre_rota_results;
DROP POLICY IF EXISTS "Coordinator owns their pre_rota_results" ON public.pre_rota_results;

CREATE POLICY "Coordinator owns their pre_rota_results"
  ON public.pre_rota_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = pre_rota_results.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = pre_rota_results.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  );

-- ── 4. shift_day_slots ───────────────────────────────────────
DROP POLICY IF EXISTS "Allow public access" ON public.shift_day_slots;
DROP POLICY IF EXISTS "Authenticated users full access on shift_day_slots" ON public.shift_day_slots;
DROP POLICY IF EXISTS "Public access" ON public.shift_day_slots;
DROP POLICY IF EXISTS "Coordinator owns their shift_day_slots" ON public.shift_day_slots;

ALTER TABLE public.shift_day_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinator owns their shift_day_slots"
  ON public.shift_day_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = shift_day_slots.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = shift_day_slots.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  );

-- ── 5. shift_slot_requirements ───────────────────────────────
DROP POLICY IF EXISTS "Allow public access" ON public.shift_slot_requirements;
DROP POLICY IF EXISTS "Authenticated users full access on shift_slot_requirements" ON public.shift_slot_requirements;
DROP POLICY IF EXISTS "Public access" ON public.shift_slot_requirements;
DROP POLICY IF EXISTS "Coordinator owns their shift_slot_requirements" ON public.shift_slot_requirements;

ALTER TABLE public.shift_slot_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinator owns their shift_slot_requirements"
  ON public.shift_slot_requirements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = shift_slot_requirements.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rota_configs
      WHERE rota_configs.id = shift_slot_requirements.rota_config_id
        AND rota_configs.owned_by = (auth.uid())::text
    )
  );

-- ── 6. unavailability_blocks — drop redundant public policies ─
DROP POLICY IF EXISTS "Public INSERT for survey submission" ON public.unavailability_blocks;
DROP POLICY IF EXISTS "Public UPDATE for survey submission" ON public.unavailability_blocks;
DROP POLICY IF EXISTS "Public SELECT for survey token access" ON public.unavailability_blocks;
DROP POLICY IF EXISTS "Public DELETE for survey normalization" ON public.unavailability_blocks;
DROP POLICY IF EXISTS "Public access for survey and RPC" ON public.unavailability_blocks;

-- ── 7. ltft_patterns ─────────────────────────────────────────
DROP POLICY IF EXISTS "Public INSERT for survey submission" ON public.ltft_patterns;
DROP POLICY IF EXISTS "Public UPDATE for survey submission" ON public.ltft_patterns;
DROP POLICY IF EXISTS "Public SELECT for survey token access" ON public.ltft_patterns;
DROP POLICY IF EXISTS "Public DELETE for survey normalization" ON public.ltft_patterns;
DROP POLICY IF EXISTS "Public access for survey and RPC" ON public.ltft_patterns;

-- ── 8. training_requests ─────────────────────────────────────
DROP POLICY IF EXISTS "Public INSERT for survey submission" ON public.training_requests;
DROP POLICY IF EXISTS "Public UPDATE for survey submission" ON public.training_requests;
DROP POLICY IF EXISTS "Public SELECT for survey token access" ON public.training_requests;
DROP POLICY IF EXISTS "Public DELETE for survey normalization" ON public.training_requests;
DROP POLICY IF EXISTS "Public access for survey and RPC" ON public.training_requests;

-- ── 9. dual_specialties ──────────────────────────────────────
DROP POLICY IF EXISTS "Public INSERT for survey submission" ON public.dual_specialties;
DROP POLICY IF EXISTS "Public UPDATE for survey submission" ON public.dual_specialties;
DROP POLICY IF EXISTS "Public SELECT for survey token access" ON public.dual_specialties;
DROP POLICY IF EXISTS "Public DELETE for survey normalization" ON public.dual_specialties;
DROP POLICY IF EXISTS "Public access for survey and RPC" ON public.dual_specialties;