# 🗄️ PostgreSQL Migration Implementation Guide

## 📋 What's Changed

This document covers the complete migration from **SQLite** (file-based) to **PostgreSQL** (scalable database) for production deployment.

### Files Modified/Created

1. **database.py** - Updated to support dual-mode (SQLite/PostgreSQL)
2. **migrate_sqlite_to_postgres.py** - Safe migration script with duplicate detection
3. **DATABASE_MIGRATION_GUIDE.md** - Comprehensive setup instructions
4. **setup-postgres.sh** - Automated PostgreSQL setup script
5. **requirements.txt** - Added `psycopg2-binary` for PostgreSQL support

---

## 🎯 Implementation Summary

### 1. Dual-Mode Database Configuration (database.py)

**How It Works:**
- If `DATABASE_URL` environment variable is set → Use PostgreSQL
- Otherwise → Use SQLite (default for local development)

**Code:**
```python
import os

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # PostgreSQL mode
    engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20)
else:
    # SQLite mode (default)
    engine = create_engine("sqlite:///./healthconnect.db")
```

**Benefits:**
- ✅ Zero API changes needed
- ✅ Works locally (SQLite) and production (PostgreSQL)
- ✅ No hardcoding of credentials
- ✅ Supports Render, Heroku, AWS RDS, custom VPS

---

### 2. Safe Migration Script (migrate_sqlite_to_postgres.py)

**Features:**
- ✅ Reads ALL users from SQLite
- ✅ Detects duplicates by email (prevents data loss)
- ✅ Preserves user IDs and all fields
- ✅ Comprehensive logging and reports
- ✅ Migrates other tables (prescriptions, consultations, etc.)
- ✅ Verifies data integrity after migration

**Safety Checks:**
1. ✅ Verifies SQLite database exists
2. ✅ Tests SQLite connection
3. ✅ Tests PostgreSQL connection
4. ✅ Creates PostgreSQL tables from models
5. ✅ Checks for duplicate users by email
6. ✅ Skips existing users (prevents overwrites)
7. ✅ Logs all operations to file
8. ✅ Verifies row counts after migration

**Usage:**
```bash
# Set database URL
export DATABASE_URL="postgresql://user:password@host/dbname"

# Run migration
python migrate_sqlite_to_postgres.py

# Check output
cat migration_*.log
```

**Expected Output:**
```
✅ Migrated: 44 users
⏭️  Skipped: 0 (already exist)
❌ Errors: 0
📊 All tables match!
```

---

### 3. Database Configuration Guide

See [DATABASE_MIGRATION_GUIDE.md](./DATABASE_MIGRATION_GUIDE.md) for:
- Step-by-step PostgreSQL setup
- How to set DATABASE_URL
- Migration walkthrough
- Verification checklist
- Troubleshooting tips
- PostgreSQL commands reference

---

## 🚀 Quick Start: Local Development

### Option A: Continue with SQLite (No Setup)
```bash
# Just use it - no DATABASE_URL needed
python -m uvicorn main:app --reload
```

### Option B: Switch to PostgreSQL (Optional for Testing)

**1. Install PostgreSQL:**
```bash
# macOS
brew install postgresql && brew services start postgresql

# Linux
sudo apt-get install postgresql-12
sudo systemctl start postgresql

# Windows
# Download: https://www.postgresql.org/download/windows/
```

**2. Create database:**
```bash
psql -U postgres -c "CREATE DATABASE medtech;"
```

**3. Set DATABASE_URL:**
```bash
export DATABASE_URL="postgresql://postgres:@localhost/medtech"
```

**4. Install driver:**
```bash
pip install psycopg2-binary
```

**5. Run migration:**
```bash
python migrate_sqlite_to_postgres.py
```

**6. Start backend:**
```bash
python -m uvicorn main:app --reload
```

**Expected logs:**
```
[DATABASE] 🐘 Using PostgreSQL: postgresql://***@...
[startup] DB dialect: postgresql
```

---

## 🌍 Production Deployment (Render)

### Step 1: Add PostgreSQL Database

1. Go to Render dashboard
2. Create new **PostgreSQL Database**
3. Copy `DATABASE_URL` from credentials

### Step 2: Set Environment Variable

1. Go to your Service (Backend)
2. Settings → Environment
3. Add: `DATABASE_URL = postgresql://user:pass@host/dbname`
4. **DO NOT** add DATABASE_URL to your git repository

### Step 3: Run Migration

**Option A: Before Deploying**
```bash
# Locally
export DATABASE_URL="your-render-database-url"
python migrate_sqlite_to_postgres.py

# Then deploy
```

**Option B: After Deploying**
```bash
# After setting DATABASE_URL in Render
# Connect via Render shell and run:
python migrate_sqlite_to_postgres.py
```

### Step 4: Verify

1. Check logs: `[DATABASE] 🐘 Using PostgreSQL`
2. Test admin dashboard: All users visible
3. Test login: Email + Google OAuth work
4. Monitor: Check error logs for 24 hours

---

## 🔄 Switching Between SQLite and PostgreSQL

### Use SQLite (Development)
```bash
# Unset DATABASE_URL
unset DATABASE_URL

# Restart backend
python -m uvicorn main:app --reload

# Logs should show:
# [DATABASE] 📁 Using SQLite: ./healthconnect.db
```

### Use PostgreSQL (Production)
```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host/dbname"

# Restart backend
python -m uvicorn main:app --reload

# Logs should show:
# [DATABASE] 🐘 Using PostgreSQL: postgresql://***@...
```

---

## ✅ Verification Checklist

### After Migration

- [ ] SQLite backup created: `healthconnect.db.backup`
- [ ] PostgreSQL database created
- [ ] Migration script ran successfully
- [ ] Log shows: "✅ All tables match! Migration successful."
- [ ] User count matches: `psql -c "SELECT COUNT(*) FROM users;"`

### After Restarting Backend

- [ ] Logs show database in use (SQLite or PostgreSQL)
- [ ] No startup errors
- [ ] Admin dashboard loads
- [ ] All users visible in dashboard
- [ ] Recent users (7-day filter) correct

### After Testing

- [ ] Email/password login works
- [ ] Google OAuth login works
- [ ] New users save to database
- [ ] Admin can manage users
- [ ] Prescriptions visible (if migrated)

---

## 🐛 Troubleshooting

### "DATABASE_URL not configured"
Your PostgreSQL database isn't set up. Follow [DATABASE_MIGRATION_GUIDE.md](./DATABASE_MIGRATION_GUIDE.md).

### "psycopg2 not found"
```bash
pip install -r requirements.txt
```

### "Could not connect to PostgreSQL"
- Verify PostgreSQL is running: `psql -U postgres`
- Check DATABASE_URL format: `postgresql://user:pass@host:5432/dbname`
- Test connection: `psql $DATABASE_URL`

### "No such column: users.last_login"
- If using old SQLite: Restart backend (auto-migration adds column)
- If using PostgreSQL: Check migration ran correctly

### "Users disappeared after migration"
```bash
# Check source (SQLite)
sqlite3 healthconnect.db "SELECT COUNT(*) FROM users;"

# Check target (PostgreSQL)
psql -d medtech -c "SELECT COUNT(*) FROM users;"

# Rerun migration (will skip duplicates)
python migrate_sqlite_to_postgres.py
```

### "Admin dashboard shows no users"
```bash
# Check users in database
psql -d medtech -c "SELECT COUNT(*) FROM users;"

# Check frontend filter (might be sorting by recent only)
# Check backend logs for errors
```

---

## 📊 Data Integrity Verification

### Count comparison
```bash
# SQLite
sqlite3 ./healthconnect.db "SELECT COUNT(*) FROM users;"

# PostgreSQL
psql -d medtech -c "SELECT COUNT(*) FROM users;"
# Should be equal after migration
```

### User verification
```bash
psql -d medtech -c "
SELECT email, role, status, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 5;
"
```

### Recent users (7-day filter)
```bash
psql -d medtech -c "
SELECT COUNT(*) 
FROM users 
WHERE created_at >= NOW() - INTERVAL '7 days';
"
```

---

## 🔐 Security Notes

1. **DATABASE_URL**: Never commit to git
   - Add to `.gitignore` if creating `.env`
   - Use environment variables on production
   - Rotate passwords regularly

2. **Backups**: Keep SQLite backup safe
   - Rename: `healthconnect.db.backup`
   - Store: Safe location for 1-2 weeks
   - Don't delete until fully verified

3. **Credentials**: Use strong PostgreSQL password
   - At least 16 characters
   - Mix of letters, numbers, symbols
   - Different from other services

---

## 📚 Files Reference

| File | Purpose | Modified |
|------|---------|----------|
| `database.py` | DB connection logic | ✅ Added dual-mode support |
| `migrate_sqlite_to_postgres.py` | Migration script | ✅ Created |
| `requirements.txt` | Python dependencies | ✅ Added psycopg2-binary |
| `main.py` | FastAPI app | ✅ Already has auto-migrations |
| `models.py` | Database models | ✅ Already has all fields |
| `routers/users.py` | Auth endpoints | ✅ Already updates last_login |
| `routers/admin_routes.py` | Admin endpoints | ✅ Already has 7-day filter |

---

## 🎓 Learning Resources

- SQLAlchemy: https://docs.sqlalchemy.org/
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Psycopg2: https://www.psycopg.org/
- Render PostgreSQL: https://render.com/docs/databases
- Environment Variables: https://12factor.net/config

---

## 📞 Support

If you encounter issues:
1. Check [DATABASE_MIGRATION_GUIDE.md](./DATABASE_MIGRATION_GUIDE.md)
2. Review migration logs: `cat migration_*.log`
3. Check backend logs for errors
4. Verify PostgreSQL connection: `psql $DATABASE_URL`
5. Re-run migration if needed (safe - detects duplicates)

---

## ✨ Summary

**What You Get:**
- ✅ SQLite for local development (zero setup)
- ✅ PostgreSQL for production (persistent, scalable)
- ✅ Safe migration (duplicate detection, data preservation)
- ✅ Zero code changes (same API, different backend)
- ✅ Auto-migrations (new columns added automatically)
- ✅ Full admin dashboard functionality

**What Changes:**
- ✅ Optional DATABASE_URL environment variable
- ✅ One-time migration script run
- ✅ Postgres connection in production

**What Stays the Same:**
- ✅ All API endpoints work identically
- ✅ Authentication flows unchanged
- ✅ Admin dashboard features preserved
- ✅ User data fully preserved

---

**Status**: ✅ Implementation Complete - Ready for Testing & Deployment
