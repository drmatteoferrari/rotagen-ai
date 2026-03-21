ALTER TABLE doctor_survey_responses
ADD COLUMN IF NOT EXISTS other_interests jsonb DEFAULT '[]'::jsonb;