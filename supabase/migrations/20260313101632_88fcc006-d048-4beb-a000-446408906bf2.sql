DELETE FROM public.coordinator_accounts WHERE username = 'developer1';

INSERT INTO public.coordinator_accounts
  (username, password, display_name, email, status, must_change_password)
VALUES
  ('matteferro31', 'matteferro31', 'Matteo Ferrari', 'matteferro31@gmail.com', 'active', false)
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  status = EXCLUDED.status,
  must_change_password = EXCLUDED.must_change_password;