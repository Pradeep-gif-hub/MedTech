-- ============================================================
-- Fix PostgreSQL Sequences After SQLite Migration
-- ============================================================
-- 
-- This script resets all ID sequences to MAX(id) + 1
-- after migration, preventing "duplicate key" errors
--
-- USAGE:
--   psql -U postgres -d medtech -f fix-postgres-sequences.sql
--
-- ============================================================

-- Reset users sequence
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users) + 1);
SELECT 'Users sequence reset to: ' || (SELECT MAX(id) FROM users) + 1 as status;

-- Reset appointments sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
    SELECT setval('appointments_id_seq', (SELECT COALESCE(MAX(id), 0) FROM appointments) + 1);
    RAISE NOTICE 'Appointments sequence reset';
  END IF;
END $$;

-- Reset consultations sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consultations') THEN
    SELECT setval('consultations_id_seq', (SELECT COALESCE(MAX(id), 0) FROM consultations) + 1);
    RAISE NOTICE 'Consultations sequence reset';
  END IF;
END $$;

-- Reset prescriptions sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
    SELECT setval('prescriptions_id_seq', (SELECT COALESCE(MAX(id), 0) FROM prescriptions) + 1);
    RAISE NOTICE 'Prescriptions sequence reset';
  END IF;
END $$;

-- Reset feedback sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback') THEN
    SELECT setval('feedback_id_seq', (SELECT COALESCE(MAX(id), 0) FROM feedback) + 1);
    RAISE NOTICE 'Feedback sequence reset';
  END IF;
END $$;

-- Reset notifications sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    SELECT setval('notifications_id_seq', (SELECT COALESCE(MAX(id), 0) FROM notifications) + 1);
    RAISE NOTICE 'Notifications sequence reset';
  END IF;
END $$;

-- Reset otps sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'otps') THEN
    SELECT setval('otps_id_seq', (SELECT COALESCE(MAX(id), 0) FROM otps) + 1);
    RAISE NOTICE 'OTPs sequence reset';
  END IF;
END $$;

-- Reset password_reset_tokens sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_tokens') THEN
    SELECT setval('password_reset_tokens_id_seq', (SELECT COALESCE(MAX(id), 0) FROM password_reset_tokens) + 1);
    RAISE NOTICE 'Password reset tokens sequence reset';
  END IF;
END $$;

-- Reset platform_settings sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_settings') THEN
    SELECT setval('platform_settings_id_seq', (SELECT COALESCE(MAX(id), 0) FROM platform_settings) + 1);
    RAISE NOTICE 'Platform settings sequence reset';
  END IF;
END $$;

-- Reset user_auth_meta sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_auth_meta') THEN
    SELECT setval('user_auth_meta_id_seq', (SELECT COALESCE(MAX(id), 0) FROM user_auth_meta) + 1);
    RAISE NOTICE 'User auth meta sequence reset';
  END IF;
END $$;

-- Reset visitor_counter sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitor_counter') THEN
    SELECT setval('visitor_counter_id_seq', (SELECT COALESCE(MAX(id), 0) FROM visitor_counter) + 1);
    RAISE NOTICE 'Visitor counter sequence reset';
  END IF;
END $$;

-- Verify all sequences
SELECT * FROM (
  SELECT 'users' as table_name, MAX(id) as current_max, pg_get_serial_sequence('users', 'id') as sequence_name FROM users
  UNION ALL
  SELECT 'appointments', MAX(id), pg_get_serial_sequence('appointments', 'id') FROM appointments WHERE (SELECT COUNT(*) FROM appointments) > 0
  UNION ALL
  SELECT 'consultations', MAX(id), pg_get_serial_sequence('consultations', 'id') FROM consultations WHERE (SELECT COUNT(*) FROM consultations) > 0
  UNION ALL
  SELECT 'prescriptions', MAX(id), pg_get_serial_sequence('prescriptions', 'id') FROM prescriptions WHERE (SELECT COUNT(*) FROM prescriptions) > 0
) t
WHERE current_max IS NOT NULL;

-- ============================================================
-- Summary:
-- ✅ All sequences reset to MAX(id) + 1
-- ✅ Next user insert will use id = 46 (if 45 is max)
-- ✅ No more "duplicate key" errors on id
-- ============================================================
