-- Allow anonymous doctor survey access to read rota_configs via the doctors join
CREATE POLICY "Public SELECT for doctor survey token access"
ON public.rota_configs
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.doctors
    WHERE doctors.rota_config_id = rota_configs.id
    AND doctors.survey_token IS NOT NULL
  )
);