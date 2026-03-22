
CREATE OR REPLACE FUNCTION public.handle_survey_normalization(
  p_doctor_id UUID,
  p_rota_config_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey RECORD;
  v_entry JSONB;
  v_day TEXT;
  v_flex JSONB;
  v_item JSONB;
  v_name TEXT;
  v_notes TEXT;
  v_colon_idx INT;
  v_session TEXT;
BEGIN
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

  -- 3a. Unavailability: Annual Leave
  IF v_survey.annual_leave IS NOT NULL AND jsonb_typeof(v_survey.annual_leave) = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_survey.annual_leave)
    LOOP
      IF v_entry->>'startDate' IS NOT NULL AND v_entry->>'endDate' IS NOT NULL
         AND v_entry->>'startDate' <> '' AND v_entry->>'endDate' <> '' THEN
        INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'annual',
                (v_entry->>'startDate')::date, (v_entry->>'endDate')::date,
                NULLIF(v_entry->>'reason', ''));
      END IF;
    END LOOP;
  END IF;

  -- 3b. Unavailability: Study Leave
  IF v_survey.study_leave IS NOT NULL AND jsonb_typeof(v_survey.study_leave) = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_survey.study_leave)
    LOOP
      IF v_entry->>'startDate' IS NOT NULL AND v_entry->>'endDate' IS NOT NULL
         AND v_entry->>'startDate' <> '' AND v_entry->>'endDate' <> '' THEN
        INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'study',
                (v_entry->>'startDate')::date, (v_entry->>'endDate')::date,
                NULLIF(v_entry->>'reason', ''));
      END IF;
    END LOOP;
  END IF;

  -- 3c. Unavailability: NOC Dates
  IF v_survey.noc_dates IS NOT NULL AND jsonb_typeof(v_survey.noc_dates) = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_survey.noc_dates)
    LOOP
      IF v_entry->>'startDate' IS NOT NULL AND v_entry->>'endDate' IS NOT NULL
         AND v_entry->>'startDate' <> '' AND v_entry->>'endDate' <> '' THEN
        INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'noc',
                (v_entry->>'startDate')::date, (v_entry->>'endDate')::date,
                NULLIF(v_entry->>'reason', ''));
      END IF;
    END LOOP;
  END IF;

  -- 3d. Unavailability: Rotations (other_unavailability)
  IF v_survey.other_unavailability IS NOT NULL AND jsonb_typeof(v_survey.other_unavailability) = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(v_survey.other_unavailability)
    LOOP
      IF v_entry->>'startDate' IS NOT NULL AND v_entry->>'endDate' IS NOT NULL
         AND v_entry->>'startDate' <> '' AND v_entry->>'endDate' <> '' THEN
        INSERT INTO unavailability_blocks (doctor_id, rota_config_id, reason, start_date, end_date, location)
        VALUES (p_doctor_id, p_rota_config_id, 'rotation',
                (v_entry->>'startDate')::date, (v_entry->>'endDate')::date,
                NULLIF(v_entry->>'location', ''));
      END IF;
    END LOOP;
  END IF;

  -- 3e. Unavailability: Parental Leave
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
      FOREACH v_day IN ARRAY v_survey.ltft_days_off
      LOOP
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

  -- 5a. Training Requests: Specialties
  IF v_survey.specialties_requested IS NOT NULL AND jsonb_typeof(v_survey.specialties_requested) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_survey.specialties_requested)
    LOOP
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

  -- 5b. Training Requests: Special Sessions (stored as text[] in "Name: Notes" format)
  IF v_survey.special_sessions IS NOT NULL AND array_length(v_survey.special_sessions, 1) > 0 THEN
    FOREACH v_session IN ARRAY v_survey.special_sessions
    LOOP
      v_colon_idx := position(': ' IN v_session);
      IF v_colon_idx > 0 THEN
        v_name := left(v_session, v_colon_idx - 1);
        v_notes := substr(v_session, v_colon_idx + 2);
      ELSE
        v_name := v_session;
        v_notes := NULL;
      END IF;
      IF v_name IS NOT NULL AND v_name <> '' THEN
        INSERT INTO training_requests (doctor_id, rota_config_id, category, name, notes)
        VALUES (p_doctor_id, p_rota_config_id, 'session', v_name, NULLIF(v_notes, ''));
      END IF;
    END LOOP;
  END IF;

  -- 5c. Training Requests: Other Interests
  IF v_survey.other_interests IS NOT NULL AND jsonb_typeof(v_survey.other_interests) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_survey.other_interests)
    LOOP
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

  -- 7. Flatten competencies & update scalar fields
  UPDATE doctor_survey_responses SET
    status = 'submitted',
    submitted_at = now(),
    grade = v_survey.grade,
    wte_percent = v_survey.wte_percent,
    dual_specialty = v_survey.dual_specialty,
    parental_leave_expected = v_survey.parental_leave_expected,
    other_restrictions = v_survey.other_restrictions,
    signature_name = v_survey.signature_name,
    signature_date = v_survey.signature_date,
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
$$;
