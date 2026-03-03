
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users full access on rota_configs" ON rota_configs;
DROP POLICY IF EXISTS "Authenticated users full access on shift_types" ON shift_types;
DROP POLICY IF EXISTS "Authenticated users full access on bank_holidays" ON bank_holidays;
DROP POLICY IF EXISTS "Authenticated users full access on wtr_settings" ON wtr_settings;

-- Re-create with TO public (covers both anon and authenticated)
CREATE POLICY "Allow public access" ON rota_configs FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON shift_types FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON bank_holidays FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON wtr_settings FOR ALL TO public USING (true) WITH CHECK (true);
