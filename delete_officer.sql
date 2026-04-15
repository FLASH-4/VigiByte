-- Create RPC function to delete officer (call from frontend)
CREATE OR REPLACE FUNCTION delete_officer_account(officer_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Delete from approved_officers
  DELETE FROM approved_officers WHERE user_id = officer_id;
  
  -- Delete from users
  DELETE FROM users WHERE id = officer_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
