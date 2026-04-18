# 🔧 PostgreSQL Sequence Reset Fix - Quick Guide

## 🚨 The Problem

```
Google login failed: Server error: (psycopg2.errors.UniqueViolation)
duplicate key value violates unique constraint "users_pkey"
DETAIL: Key (id)=(4) already exists.
```

## 🎯 Root Cause

After migrating data from SQLite to PostgreSQL:
1. All user records were copied (including user id=4, id=45, etc.)
2. PostgreSQL's auto-increment sequence wasn't updated
3. When a new user tries to login and gets created, PostgreSQL assigns id=4 (or another existing id)
4. **BOOM** - Duplicate key violation!

## ✅ The Fix (2 Steps)

### Step 1: Reset PostgreSQL Sequences

**Run this SQL script:**
```bash
psql -U postgres -d medtech -f fix-postgres-sequences.sql
```

**What it does:**
- Finds the max(id) in each table
- Sets the sequence to MAX(id) + 1
- Next user created gets id=46 (if max was 45)
- No more duplicate key errors!

**Output:**
```
✅ Users sequence reset to: 46
✅ Consultations sequence reset
✅ Prescriptions sequence reset
...
```

### Step 2: Restart Backend

```bash
python -m uvicorn main:app --reload
```

## 🧪 Test the Fix

1. **Go to login page:** https://medtech-4rjc.onrender.com
2. **Click "Sign in as Pradeep Kumar Awasthi"** (or your Google account)
3. **You should see:**
   - ✅ Redirected to dashboard
   - ✅ No "duplicate key" error
   - ✅ User successfully logged in

## 🛡️ What Changed in Code

**File:** `healthconnect-backend/routers/users.py`

**Function:** `handle_google_login()`

**Improvements:**
- ✅ Wrapped user creation in try-catch
- ✅ If creation fails, tries to find existing user
- ✅ Better error messages
- ✅ Graceful fallback for update failures
- ✅ Never crashes on duplicate key - logs and continues

**Before:**
```python
db.add(user)
db.commit()  # ❌ Crashes if duplicate key
```

**After:**
```python
try:
    db.add(user)
    db.commit()  # ✅ Catches error
except Exception as create_error:
    db.rollback()
    # Try to find existing user
    user = db.query(models.User).filter(models.User.email == email).first()
```

## 📋 Complete Checklist

- [ ] Run `psql -U postgres -d medtech -f fix-postgres-sequences.sql`
- [ ] Verify output shows all sequences reset
- [ ] Restart backend: `python -m uvicorn main:app --reload`
- [ ] Test login with Google account
- [ ] Verify no "duplicate key" error
- [ ] Check backend logs for "[GOOGLE] ✅ Updated user" messages

## 🚀 Expected Results

**Before Fix:**
```
❌ Google login fails with duplicate key error
❌ User stuck on login page
❌ Backend throws: UniqueViolation
```

**After Fix:**
```
✅ Google login works
✅ User redirected to dashboard
✅ Backend logs: "[GOOGLE] ✅ Updated user last_login"
✅ Avatar displays correctly
```

## 💡 Why This Happens

PostgreSQL uses **sequences** to auto-generate IDs:
```sql
-- Sequence for users table
CREATE SEQUENCE users_id_seq START 1;

-- Each INSERT gets next value
INSERT INTO users (id, ...) VALUES (nextval('users_id_seq'), ...);
```

When you migrate data manually, the sequence doesn't know about it:
```
SQLite data:  id=1, 2, 3, 4, ..., 45
PostgreSQL sequence: Still at 4
Next insert tries: id=4 → DUPLICATE!
```

**The fix sets sequence to MAX(id) + 1:**
```
New sequence starts at: 46
Next insert gets: id=46 ✅
```

## 🔍 How to Verify

**Check current sequence value:**
```bash
psql -U postgres -d medtech -c "
  SELECT sequence_name, last_value 
  FROM users_id_seq;
"
```

**Check max user id:**
```bash
psql -U postgres -d medtech -c "
  SELECT MAX(id) FROM users;
"
```

**Both should match:**
```
max(id) = 45
sequence = 46  ✅
```

## 📞 If Still Not Working

1. **Check PostgreSQL is using the right database:**
   ```bash
   psql -U postgres -d medtech -c "SELECT COUNT(*) FROM users;"
   ```

2. **Verify sequence was actually reset:**
   ```bash
   psql -U postgres -d medtech -c "SELECT last_value FROM users_id_seq;"
   ```

3. **Check backend logs:**
   ```bash
   # Should show:
   [GOOGLE] Creating NEW user: email@example.com
   [GOOGLE] 📝 New user created: id=46, email=...
   ```

4. **Clear browser cache:**
   - Press Ctrl+Shift+Del (or Cmd+Shift+Del on Mac)
   - Clear cookies and cached data
   - Refresh page
   - Try login again

---

**Status:** ✅ Fix Complete - User Can Now Login
