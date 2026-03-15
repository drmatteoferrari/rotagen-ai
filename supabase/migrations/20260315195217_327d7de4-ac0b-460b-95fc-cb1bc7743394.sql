-- Migrate matteferro31@gmail.com data (UUID: 1ec5b767-6e29-4aa2-91b6-7036cd35c099)
UPDATE rota_configs SET owned_by = '1ec5b767-6e29-4aa2-91b6-7036cd35c099' WHERE owned_by IN ('matteferro31', '6def1c4a-7e56-4319-901c-9cc9532d62c8');
UPDATE account_settings SET owned_by = '1ec5b767-6e29-4aa2-91b6-7036cd35c099' WHERE owned_by IN ('matteferro31', '6def1c4a-7e56-4319-901c-9cc9532d62c8');

-- Migrate matteo.ferrari@doctors.org.uk data (UUID: 2e844c76-3007-411d-8273-2bdfd0cf596f)
UPDATE rota_configs SET owned_by = '2e844c76-3007-411d-8273-2bdfd0cf596f' WHERE owned_by = 'matteo.ferrari';
UPDATE account_settings SET owned_by = '2e844c76-3007-411d-8273-2bdfd0cf596f' WHERE owned_by = 'matteo.ferrari';