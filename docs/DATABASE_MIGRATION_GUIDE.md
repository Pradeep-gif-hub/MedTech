# MedTech Backend - Database Configuration Guide

## 📁 Database Modes

The system now supports **dual-mode** database configuration:

### 1️⃣ LOCAL DEVELOPMENT (SQLite)
- **Database**: `./healthconnect.db`
- **When**: No `DATABASE_URL` environment variable set
- **Use Case**: Local development, testing
- **Pros**: No setup, no dependencies, file-based
- **Cons**: Not suitable for production, resets on Render

### 2️⃣ PRODUCTION (PostgreSQL)
- **Database**: Remote PostgreSQL server
- **When**: `DATABASE_URL` environment variable is set
- **Use Case**: Production, staging, Render deployment
- **Pros**: Persistent, scalable, multi-user
- **Cons**: Requires setup, additional dependency

---

## 🚀 HOW TO MIGRATE: SQLite → PostgreSQL

### Prerequisites
```bash
pip install psycopg2-binary
```

### Step 1: Set Up PostgreSQL

**Local PostgreSQL:**
```bash
# macOS/Homebrew
brew install postgresql
brew services start postgresql

# Linux
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start

# Windows
# Download: https://www.postgresql.org/download/windows/
```

**Create Database:**
```bash
psql -U postgres
CREATE DATABASE medtech;
\q
```

### Step 2: Set DATABASE_URL Environment Variable

**Local Development (Linux/macOS):**
```bash
export DATABASE_URL="postgresql://postgres:password@localhost/medtech"
```

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL = "postgresql://postgres:password@localhost/medtech"
```

**Windows (CMD):**
```cmd
set DATABASE_URL=postgresql://postgres:password@localhost/medtech
```

**Production (Render/Heroku):**
```
Set in platform's environment variables dashboard
```

### Step 3: Run Migration Script

```bash
python migrate_sqlite_to_postgres.py
```

**Expected Output:**
```
======================================================================
  SQLite → PostgreSQL Migration
======================================================================

✅ SQLite database found: ./healthconnect.db
🔗 Connecting to PostgreSQL: postgresql://***@...
✅ Connected to PostgreSQL: 15.2

======================================================================
  STEP 1: Creating PostgreSQL Tables
======================================================================

📝 Creating tables from models...
✅ All tables created in PostgreSQL

======================================================================
  STEP 2: Migrating Users Table
======================================================================

📊 Found 44 users in SQLite
✅ MIGRATE: admin@medtech.com (ID: 1, Role: admin)
✅ MIGRATE: doctor@medtech.com (ID: 2, Role: doctor)
...

📊 MIGRATION SUMMARY - USERS TABLE:
  Total found:     44
  Migrated:        44 ✅
  Skipped (dups):  0 ⏭️
  Errors:          0 ❌

======================================================================
  STEP 4: Verification
======================================================================

📊 Row Counts Comparison:
  users                        44           44           ✅ MATCH
  prescriptions                12           12           ✅ MATCH
  consultations                 5            5           ✅ MATCH
```

### Step 4: Verify Data in PostgreSQL

```bash
psql -U postgres -d medtech

# Check users
SELECT COUNT(*) FROM users;
SELECT email, role, status FROM users ORDER BY created_at DESC;

# Check admin exists
SELECT * FROM users WHERE role = 'admin';

\q
```

### Step 5: Test Backend with PostgreSQL

```bash
# Ensure DATABASE_URL is set
echo $DATABASE_URL

# Start backend
python -m uvicorn main:app --reload
```

**Check logs:**
```
[DATABASE] 🐘 Using PostgreSQL: postgresql://***@...
[startup] Ensuring database tables exist (create_all)...
[startup] DB dialect: postgresql
INFO:     Application startup complete.
```

### Step 6: Verify Admin Dashboard

1. Open admin panel: `http://localhost:5173/admin/dashboard`
2. Check:
   - ✅ All users visible
   - ✅ Recent users (last 7 days) correct
   - ✅ User counts match

### Step 7: Test Authentication

**Email/Password Login:**
```bash
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

**Google OAuth:**
- Click "Sign in with Google" in frontend
- Verify user saved in PostgreSQL

### Step 8: Deploy to Render

1. Add to Render environment:
   ```
   DATABASE_URL = postgresql://user:password@host/dbname
   ```

2. Ensure `migrate_sqlite_to_postgres.py` is run before first deployment

3. Or run during app initialization

---

## ⚠️ SAFETY CHECKLIST

- [ ] SQLite database backed up
- [ ] PostgreSQL database created and accessible
- [ ] DATABASE_URL environment variable set
- [ ] Migration script ran successfully
- [ ] All users migrated (check counts)
- [ ] Admin dashboard shows all users
- [ ] Email/password login works
- [ ] Google OAuth users migrated
- [ ] New users save to PostgreSQL
- [ ] Logs show "🐘 Using PostgreSQL"

---

## 🔄 SWITCHING BACK TO SQLite (If Needed)

```bash
# Unset DATABASE_URL
unset DATABASE_URL  # macOS/Linux
$env:DATABASE_URL = ""  # PowerShell

# Restart backend - will use SQLite
python -m uvicorn main:app --reload

# Check logs
[DATABASE] 📁 Using SQLite: ./healthconnect.db
```

---

## 🐛 Troubleshooting

### "DATABASE_URL not configured"
```bash
# Set it:
export DATABASE_URL="postgresql://postgres:password@localhost/medtech"

# Verify:
echo $DATABASE_URL
```

### "psycopg2 module not found"
```bash
pip install psycopg2-binary
```

### "Could not connect to PostgreSQL"
```bash
# Check PostgreSQL is running
psql -U postgres  # Should show psql prompt

# Check database exists
psql -U postgres -l  # Should list databases
```

### "No such column: users.last_login"
- Run migration script
- Or restart backend (auto-creates missing columns)

### "Users not appearing in PostgreSQL"
```bash
# Check migration logs
cat migration_*.log

# Verify users in PostgreSQL
psql -d medtech -c "SELECT COUNT(*) FROM users;"

# Rerun migration if needed
python migrate_sqlite_to_postgres.py
```

---

## 📊 Example .env File

```env
# FastAPI/Backend
DATABASE_URL=postgresql://postgres:password@localhost/medtech

# Or for Render:
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Email (Brevo)
SMTP_SERVER=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-email@brevo.com
SMTP_PASS=your-api-key
FROM_EMAIL=noreply@medtech.com

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# JWT
JWT_SECRET=your-super-secret-key

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## ✅ Migration Checklist

### Before Migration
- [ ] Backup SQLite: `cp healthconnect.db healthconnect.db.backup`
- [ ] Note current user count
- [ ] Test admin dashboard

### During Migration
- [ ] Set DATABASE_URL
- [ ] Run migration script
- [ ] Check migration logs for errors
- [ ] Verify data integrity

### After Migration
- [ ] Test admin dashboard
- [ ] Test login (email + Google)
- [ ] Verify new users save to PostgreSQL
- [ ] Monitor logs for errors
- [ ] Keep SQLite backup for 1-2 weeks

---

## 🔗 Useful PostgreSQL Commands

```bash
# Connect to database
psql -U postgres -d medtech

# List databases
\l

# List tables
\dt

# Describe table
\d users

# Count users
SELECT COUNT(*) FROM users;

# Show recent users (last 7 days)
SELECT name, email, role, created_at 
FROM users 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

# Check admin exists
SELECT * FROM users WHERE role = 'admin';

# Export data
pg_dump -U postgres -d medtech > medtech_backup.sql

# Exit
\q
```

---

## 📚 Reference

- SQLAlchemy: https://docs.sqlalchemy.org/
- PostgreSQL: https://www.postgresql.org/docs/
- Psycopg2: https://www.psycopg.org/
- Render Docs: https://render.com/docs
