CREATE TABLE IF NOT EXISTS app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  rating_overall smallint NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_clarity smallint NOT NULL CHECK (rating_clarity BETWEEN 1 AND 5),
  rating_ui smallint NOT NULL CHECK (rating_ui BETWEEN 1 AND 5),
  rating_speed smallint NOT NULL CHECK (rating_speed BETWEEN 1 AND 5),
  quicker_than_before text NOT NULL CHECK (quicker_than_before IN ('yes', 'same', 'no')),
  previous_method text NOT NULL,
  more_accurate text NOT NULL CHECK (more_accurate IN ('yes', 'same', 'no')),
  rota_creators text[],
  improvements text,
  bugs text,
  comment text,
  responder_name text,
  responder_email text,
  responder_trust text,
  happy_to_contact boolean,
  contact_method text CHECK (contact_method IN ('whatsapp', 'phone', 'email', 'other'))
);

ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert on app_feedback"
  ON app_feedback FOR INSERT
  TO public
  WITH CHECK (true);