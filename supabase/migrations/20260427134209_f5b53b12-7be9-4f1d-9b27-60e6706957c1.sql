-- Phase 3: Logic bug fixes (DB side)

-- ────────────────────────────────────────────────────────────────────
-- 1. M6: special_sessions text[] → jsonb
-- Use a helper function because ALTER COLUMN ... USING disallows subqueries.
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._migrate_special_sessions_to_jsonb(arr text[])
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN arr IS NULL OR array_length(arr, 1) IS NULL THEN '[]'::jsonb
    ELSE COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN position(': ' IN s) > 0 THEN
              jsonb_build_object(
                'name',  trim(left(s, position(': ' IN s) - 1)),
                'notes', trim(substr(s, position(': ' IN s) + 2))
              )
            ELSE
              jsonb_build_object('name', s, 'notes', '')
          END
        )
        FROM unnest(arr) AS s
      ),
      '[]'::jsonb
    )
  END
$$;

ALTER TABLE public.doctor_survey_responses
  ALTER COLUMN special_sessions DROP DEFAULT;

ALTER TABLE public.doctor_survey_responses
  ALTER COLUMN special_sessions TYPE jsonb
  USING public._migrate_special_sessions_to_jsonb(special_sessions);

ALTER TABLE public.doctor_survey_responses
  ALTER COLUMN special_sessions SET DEFAULT '[]'::jsonb;

DROP FUNCTION public._migrate_special_sessions_to_jsonb(text[]);

-- ────────────────────────────────────────────────────────────────────
-- 2. L6: lowercase existing ltft_days_off values
-- ────────────────────────────────────────────────────────────────────

UPDATE public.doctor_survey_responses
SET ltft_days_off = ARRAY(SELECT LOWER(d) FROM unnest(ltft_days_off) AS d)
WHERE ltft_days_off IS NOT NULL
  AND EXISTS (SELECT 1 FROM unnest(ltft_days_off) AS d WHERE d <> LOWER(d));

-- ────────────────────────────────────────────────────────────────────
-- 3. handle_survey_normalization (re-defined)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_survey_normalization(
  p_doctor_id UUID,
  p_rota_config_id UUID,
  p_signature_name TEXT DEFAULT NULL,
  p_signature_date DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_survey RECORD;
  v_entry JSONB;
  v_day TEXT;
  v_flex JSONB;
  v_item JSONB;
  v_name TEXT;
  v_notes TEXT;
  v_deadline DATE;
BEGIN
  -- Survey deadline gate
  SELECT survey_deadline INTO v_deadline
  FROM rota_configs
  WHERE id = p_rota_config_id;

  IF v_deadline IS NOT NULL AND CURRENT_DATE > v_deadline THEN
    RAISE EXCEPTION 'Survey deadline (%) has passed; submission no longer accepted.', v_deadline;
  END IF;

  -- 1. Fetch the survey response row
  SELECT * INTO v_survey
  FROM doctor_survey_responses
  WHERE doctor_id = p_doctor_id AND rota_config_id = p_rota_config_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survey response not found for doctor_id=% rota_config_id=%', p_doctor_id, p_rota_config_id;
  END IF;

  -- 2. Clean slate: delete existing relational data
  DELETE FROM unavailability_blocks WHERE doctor_id = p_doctor_id AND rota_config_id = p_rota_config_id;
  DELETE FROM ltft_patterns WHERE doctor_id = p_doctor_id AND rota_config_id = p_rota_config_id;
  DELETE FROM training_requests WHERE doctor_id = p_doctor_id AND rota_config_id = p_rota_config_id;
  DELETE FROM dual_specialties WHERE doctor_id = p_doctor_id AND rota_config_id = p_rota_config_id;

  -- 3a. Annual Leave
  IF v_survey.annual_leave IS NOT NULL AND jsonb_typeof(v_survey.annual_leave) = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_survey.annual_leave) LOOP
      IF v_entry->>'startDate' IS NOT NULL AND v_entry->>'endDate' IS NOT NULL
         AND v_entry->>'startDate' <> '' AND v_entry->>'endDate' <> '' THEN
        INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'annual',
                (v_entry->>'startDate')::date, (v_entry->>'endDate')::date,
                NULLIF(v_entry->>'reason', ''));
      END IF;
    END LOOP;
  END IF;

  -- 3b. Study Leave
  IF v_survey.study_leave IS NOT NULL AND jsonb_typeof(v_survey.study_leave) = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_survey.study_leave) LOOP
      IF v_entry->>'startDate' IS NOT NULL AND v_entry->>'endDate' IS NOT NULL
         AND v_entry->>'startDate' <> '' AND v_entry->>'endDate' <> '' THEN
        INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'study',
                (v_entry->>'startDate')::date, (v_entry->>'endDate')::date,
                NULLIF(v_entry->>'reason', ''));
      END IF;
    END LOOP;
  END IF;

  -- 3c. NOC Dates
  IF v_survey.noc_dates IS NOT NULL AND jsonb_typeof(v_survey.noc_dates) = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_survey.noc_dates) LOOP
      IF v_entry->>'startDate' IS NOT NULL AND v_entry->>'endDate' IS NOT NULL
         AND v_entry->>'startDate' <> '' AND v_entry->>'endDate' <> '' THEN
        INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'noc',
                (v_entry->>'startDate')::date, (v_entry->>'endDate')::date,
                NULLIF(v_entry->>'reason', ''));
      END IF;
    END LOOP;
  END IF;

  -- 3d. Rotations
  IF v_survey.other_unavailability IS NOT NULL AND jsonb_typeof(v_survey.other_unavailability) = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_survey.other_unavailability) LOOP
      IF v_entry->>'startDate' IS NOT NULL AND v_entry->>'endDate' IS NOT NULL
         AND v_entry->>'startDate' <> '' AND v_entry->>'endDate' <> '' THEN
        INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, location)
        VALUES (p_doctor_id, p_rota_config_id, 'rotation',
                (v_entry->>'startDate')::date, (v_entry->>'endDate')::date,
                NULLIF(v_entry->>'location', ''));
      END IF;
    END LOOP;
  END IF;

  -- 3e. Parental Leave
  IF v_survey.parental_leave_expected = TRUE
     AND v_survey.parental_leave_start IS NOT NULL
     AND v_survey.parental_leave_end IS NOT NULL THEN
    INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, notes)
    VALUES (p_doctor_id, p_rota_config_id, 'parental',
            v_survey.parental_leave_start, v_survey.parental_leave_end,
            NULLIF(v_survey.parental_leave_notes, ''));
  END IF;

  -- 4. LTFT Patterns
  IF v_survey.ltft_days_off IS NOT NULL AND array_length(v_survey.ltft_days_off, 1) > 0 THEN
    IF NOT ('flexible' = ANY(v_survey.ltft_days_off)) THEN
      FOREACH v_day IN ARRAY v_survey.ltft_days_off LOOP
        v_flex := NULL;
        IF v_survey.ltft_night_flexibility IS NOT NULL AND jsonb_typeof(v_survey.ltft_night_flexibility) = 'array' THEN
          SELECT elem INTO v_flex
          FROM jsonb_array_elements(v_survey.ltft_night_flexibility) AS elem
          WHERE elem->>'day' = v_day
          LIMIT 1;
        END IF;
        INSERT INTO ltft_patterns (doctor_id, rota_config_id, day, is_day_off, can_start_nights, can_end_nights)
        VALUES (p_doctor_id, p_rota_config_id, v_day::day_of_week, TRUE,
                CASE WHEN v_flex IS NOT NULL THEN (v_flex->>'canStart')::boolean ELSE NULL END,
                CASE WHEN v_flex IS NOT NULL THEN (v_flex->>'canEnd')::boolean ELSE NULL END);
      END LOOP;
    END IF;
  END IF;

  -- 5a. Specialties
  IF v_survey.specialties_requested IS NOT NULL AND jsonb_typeof(v_survey.specialties_requested) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_survey.specialties_requested) LOOP
      IF jsonb_typeof(v_item) = 'string' THEN
        v_name := v_item #>> '{}';
        v_notes := NULL;
      ELSE
        v_name := v_item->>'name';
        v_notes := NULLIF(v_item->>'notes', '');
      END IF;
      IF v_name IS NOT NULL AND v_name <> '' THEN
        INSERT INTO training_requests (doctor_id, rota_config_id, category, name, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'specialty', v_name, v_notes);
      END IF;
    END LOOP;
  END IF;

  -- 5b. Special Sessions (now jsonb [{name, notes}])
  IF v_survey.special_sessions IS NOT NULL AND jsonb_typeof(v_survey.special_sessions) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_survey.special_sessions) LOOP
      v_name := v_item->>'name';
      v_notes := NULLIF(v_item->>'notes', '');
      IF v_name IS NOT NULL AND v_name <> '' THEN
        INSERT INTO training_requests (doctor_id, rota_config_id, category, name, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'session', v_name, v_notes);
      END IF;
    END LOOP;
  END IF;

  -- 5c. Other Interests
  IF v_survey.other_interests IS NOT NULL AND jsonb_typeof(v_survey.other_interests) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_survey.other_interests) LOOP
      IF jsonb_typeof(v_item) = 'string' THEN
        v_name := v_item #>> '{}';
        v_notes := NULL;
      ELSE
        v_name := v_item->>'name';
        v_notes := NULLIF(v_item->>'notes', '');
      END IF;
      IF v_name IS NOT NULL AND v_name <> '' THEN
        INSERT INTO training_requests (doctor_id, rota_config_id, category, name, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'interest', v_name, v_notes);
      END IF;
    END LOOP;
  END IF;

  -- 6. Dual Specialties
  IF v_survey.dual_specialty_types IS NOT NULL AND array_length(v_survey.dual_specialty_types, 1) > 0 THEN
    INSERT INTO dual_specialties (doctor_id, rota_config_id, specialty_name)
    SELECT p_doctor_id, p_rota_config_id, unnest(v_survey.dual_specialty_types);
  END IF;

  -- 7. Flatten competencies & update scalars + signature
  UPDATE doctor_survey_responses SET
    status = 'submitted',
    submitted_at = now(),
    grade = v_survey.grade,
    wte_percent = v_survey.wte_percent,
    dual_specialty = v_survey.dual_specialty,
    parental_leave_expected = v_survey.parental_leave_expected,
    other_restrictions = v_survey.other_restrictions,
    signature_name = COALESCE(p_signature_name, v_survey.signature_name),
    signature_date = COALESCE(p_signature_date, v_survey.signature_date),
    iac_achieved = (v_survey.competencies_json->'iac'->>'achieved')::boolean,
    iac_working = (v_survey.competencies_json->'iac'->>'workingTowards')::boolean,
    iac_remote = (v_survey.competencies_json->'iac'->>'remoteSupervision')::boolean,
    iaoc_achieved = (v_survey.competencies_json->'iaoc'->>'achieved')::boolean,
    iaoc_working = (v_survey.competencies_json->'iaoc'->>'workingTowards')::boolean,
    iaoc_remote = (v_survey.competencies_json->'iaoc'->>'remoteSupervision')::boolean,
    icu_achieved = (v_survey.competencies_json->'icu'->>'achieved')::boolean,
    icu_working = (v_survey.competencies_json->'icu'->>'workingTowards')::boolean,
    icu_remote = (v_survey.competencies_json->'icu'->>'remoteSupervision')::boolean,
    transfer_achieved = (v_survey.competencies_json->'transfer'->>'achieved')::boolean,
    transfer_working = (v_survey.competencies_json->'transfer'->>'workingTowards')::boolean,
    transfer_remote = (v_survey.competencies_json->'transfer'->>'remoteSupervision')::boolean
  WHERE doctor_id = p_doctor_id AND rota_config_id = p_rota_config_id;

  -- 8. Update doctors table
  UPDATE doctors SET
    survey_status = 'submitted',
    survey_submitted_at = now()
  WHERE id = p_doctor_id;
END;
$function$;