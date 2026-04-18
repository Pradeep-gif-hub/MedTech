-- ============================================================
-- SQL Script to Fix Avatar Data After PostgreSQL Migration
-- ============================================================
-- 
-- This script checks and fixes avatar issues in PostgreSQL
-- after migration from SQLite.
--
-- USAGE:
--   psql -U postgres -d medtech -f fix-avatar-data-postgresql.sql
--
-- ============================================================

-- 1. Check avatar data status before changes
SELECT 
    id,
    email,
    name,
    role,
    profile_picture_url,
    profile_pic,
    CASE 
        WHEN profile_picture_url IS NOT NULL THEN 'profile_picture_url'
        WHEN profile_pic IS NOT NULL THEN 'profile_pic'
        ELSE 'BOTH_NULL'
    END as avatar_source,
    created_at
FROM users
WHERE role = 'doctor'
ORDER BY created_at DESC
LIMIT 20;

-- 2. Show summary of avatar coverage
SELECT 
    COUNT(*) as total_doctors,
    COUNT(CASE WHEN profile_picture_url IS NOT NULL THEN 1 END) as with_profile_picture_url,
    COUNT(CASE WHEN profile_pic IS NOT NULL THEN 1 END) as with_profile_pic,
    COUNT(CASE WHEN profile_picture_url IS NOT NULL OR profile_pic IS NOT NULL THEN 1 END) as with_any_avatar,
    COUNT(CASE WHEN profile_picture_url IS NULL AND profile_pic IS NULL THEN 1 END) as missing_both
FROM users
WHERE role = 'doctor';

-- 3. Copy avatar data from profile_pic to profile_picture_url (if missing)
-- This ensures all doctors have profile_picture_url populated
UPDATE users
SET profile_picture_url = profile_pic
WHERE role = 'doctor'
  AND profile_picture_url IS NULL
  AND profile_pic IS NOT NULL;

-- 4. Copy avatar data from profile_picture_url to profile_pic (if missing)
-- This ensures backward compatibility
UPDATE users
SET profile_pic = profile_picture_url
WHERE role = 'doctor'
  AND profile_pic IS NULL
  AND profile_picture_url IS NOT NULL;

-- 5. Verify changes
SELECT 
    COUNT(*) as total_doctors,
    COUNT(CASE WHEN profile_picture_url IS NOT NULL THEN 1 END) as with_profile_picture_url,
    COUNT(CASE WHEN profile_pic IS NOT NULL THEN 1 END) as with_profile_pic,
    COUNT(CASE WHEN profile_picture_url IS NOT NULL OR profile_pic IS NOT NULL THEN 1 END) as with_any_avatar,
    COUNT(CASE WHEN profile_picture_url IS NULL AND profile_pic IS NULL THEN 1 END) as missing_both
FROM users
WHERE role = 'doctor';

-- 6. Show updated avatar data for Google OAuth users
SELECT 
    id,
    email,
    name,
    profile_picture_url,
    profile_pic,
    created_at
FROM users
WHERE (profile_picture_url LIKE '%googleusercontent%' OR profile_pic LIKE '%googleusercontent%')
  AND role IN ('doctor', 'patient')
ORDER BY created_at DESC
LIMIT 10;

-- 7. Check for any remaining issues
SELECT 
    COUNT(*) as users_needing_avatar
FROM users
WHERE profile_picture_url IS NULL 
  AND profile_pic IS NULL
  AND role IN ('doctor', 'patient');

-- ============================================================
-- Summary:
-- - This script will automatically copy avatar data between
--   profile_picture_url and profile_pic fields
-- - It ensures all doctors with any avatar data have both
--   fields populated for full compatibility
-- - Run this after migration to fix any missing avatars
-- ============================================================
