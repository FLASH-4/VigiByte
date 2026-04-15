-- Create RPC function to delete officer (call from frontend)
-- This function runs with elevated permissions to delete from both public.users and auth.users
CREATE OR REPLACE FUNCTION delete_officer_account(officer_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  officer_email TEXT;
BEGIN
  -- Get the officer's email before deletion
  SELECT email INTO officer_email FROM auth.users WHERE id = officer_id;

  -- Delete from approved_officers
  DELETE FROM approved_officers WHERE user_id = officer_id;

  -- Delete from public.users
  DELETE FROM public.users WHERE id = officer_id;

  -- Delete from auth.users (only if email exists)
  IF officer_email IS NOT NULL THEN
    DELETE FROM auth.users WHERE email = officer_email;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
