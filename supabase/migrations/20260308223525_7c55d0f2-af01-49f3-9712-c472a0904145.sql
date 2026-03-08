-- SECTION 5 COMPLETE: trigger re-attached

-- Drop trigger if it somehow already exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Re-attach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();