/**
 * MedTech Backend - SQLite Database Module
 * Handles database initialization and user operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Database file path
const DB_PATH = path.join(__dirname, 'healthconnect.db');

// Create and open database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DATABASE] ❌ Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('[DATABASE] ✅ Connected to SQLite database');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

function runAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function getAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

function allAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

async function ensureUserColumn(columnName, columnType, defaultValueSql = '') {
  const columns = await allAsync('PRAGMA table_info(users)');
  const hasColumn = columns.some((column) => column.name === columnName);
  if (!hasColumn) {
    const defaultSql = defaultValueSql ? ` ${defaultValueSql}` : '';
    await runAsync(`ALTER TABLE users ADD COLUMN ${columnName} ${columnType}${defaultSql}`);
    console.log(`[DATABASE] ✅ Added users.${columnName} column`);
  }
}

async function seedAdminUser() {
  await runAsync(
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  const adminEmail = 'pradeep240818@gmail.com';
  const existingAdmin = await getAsync('SELECT id FROM admins WHERE email = ?', [adminEmail]);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Password', 10);
    await runAsync(
      'INSERT INTO admins (name, email, password, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      ['Pradeep Admin', adminEmail, passwordHash]
    );
    console.log('[DATABASE] ✅ Default admin account seeded');
  }

  await runAsync('CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)');
}

/**
 * Initialize database tables
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT UNIQUE NOT NULL,
          profile_pic TEXT,
          avatar TEXT,
          picture TEXT,
          phone TEXT,
          age INTEGER,
          gender TEXT,
          bloodgroup TEXT,
          allergy TEXT,
          dob TEXT,
          location TEXT,
          status TEXT DEFAULT 'active',
          role TEXT DEFAULT 'patient',
          google_id TEXT UNIQUE,
          password TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating users table:', err.message);
            reject(err);
          } else {
            console.log('[DATABASE] ✅ Users table initialized');
          }
        }
      );

      // Create sessions table for express-session
      db.run(
        `CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          sess TEXT NOT NULL,
          expire INTEGER NOT NULL
        )`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating sessions table:', err.message);
            reject(err);
          } else {
            console.log('[DATABASE] ✅ Sessions table initialized');
          }
        }
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS prescriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_name TEXT NOT NULL,
          patient_email TEXT NOT NULL,
          patient_id TEXT,
          doctor_name TEXT NOT NULL,
          doctor_specialization TEXT,
          diagnosis TEXT NOT NULL,
          medicines TEXT NOT NULL,
          date TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating prescriptions table:', err.message);
            reject(err);
          } else {
            console.log('[DATABASE] ✅ Prescriptions table initialized');
          }
        }
      );

      // Create index on email for faster lookups
      db.run(
        `CREATE TABLE IF NOT EXISTS consultations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctor_id INTEGER,
          patient_id INTEGER,
          type TEXT CHECK(type IN ('video', 'kiosk')) NOT NULL,
          fee REAL DEFAULT 0,
          specialization TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (doctor_id) REFERENCES users(id),
          FOREIGN KEY (patient_id) REFERENCES users(id)
        )`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating consultations table:', err.message);
            reject(err);
          } else {
            console.log('[DATABASE] ✅ Consultations table initialized');
          }
        }
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctor_id INTEGER NOT NULL,
          patient_id INTEGER NOT NULL,
          rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
          comment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (doctor_id) REFERENCES users(id),
          FOREIGN KEY (patient_id) REFERENCES users(id)
        )`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating reviews table:', err.message);
            reject(err);
          } else {
            console.log('[DATABASE] ✅ Reviews table initialized');
          }
        }
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message TEXT NOT NULL,
          type TEXT CHECK(type IN ('info', 'warning', 'critical')) DEFAULT 'info',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating alerts table:', err.message);
            reject(err);
          } else {
            console.log('[DATABASE] ✅ Alerts table initialized');
          }
        }
      );

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating email index:', err.message);
          } else {
            console.log('[DATABASE] ✅ Email index created');
          }
        }
      );

      // Create index on google_id
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating google_id index:', err.message);
          } else {
            console.log('[DATABASE] ✅ Google ID index created');
          }
        }
      );

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status)`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating role_status index:', err.message);
          } else {
            console.log('[DATABASE] ✅ Role/status index created');
          }
        }
      );

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating users created_at index:', err.message);
          } else {
            console.log('[DATABASE] ✅ Users created_at index created');
          }
        }
      );

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at)`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating consultations created_at index:', err.message);
          } else {
            console.log('[DATABASE] ✅ Consultations created_at index created');
          }
        }
      );

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_consultations_type ON consultations(type)`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating consultations type index:', err.message);
          } else {
            console.log('[DATABASE] ✅ Consultations type index created');
          }
        }
      );

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_reviews_doctor_id ON reviews(doctor_id)`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating reviews doctor_id index:', err.message);
          } else {
            console.log('[DATABASE] ✅ Reviews doctor_id index created');
          }
        }
      );

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at)`,
        (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating alerts created_at index:', err.message);
          } else {
            console.log('[DATABASE] ✅ Alerts created_at index created');
          }
        }
      );

      db.run(
        `CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_email ON prescriptions(patient_email)`,
        async (err) => {
          if (err) {
            console.error('[DATABASE] ❌ Error creating prescriptions patient email index:', err.message);
            reject(err);
          } else {
            console.log('[DATABASE] ✅ Prescriptions patient email index created');
            try {
              await ensureUserColumn('profile_pic', 'TEXT');
              await ensureUserColumn('location', 'TEXT');
              await ensureUserColumn("status", "TEXT", "DEFAULT 'active'");
              await seedAdminUser();
              resolve();
            } catch (migrationError) {
              console.error('[DATABASE] ❌ Error while running migration steps:', migrationError.message);
              reject(migrationError);
            }
          }
        }
      );
    });
  });
}

/**
 * Get user by email
 */
function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

/**
 * Get user by ID
 */
function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

/**
 * Get user by Google ID
 */
function getUserByGoogleId(googleId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE google_id = ?', [googleId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

/**
 * Create new user
 */
function createUser(userData) {
  return new Promise((resolve, reject) => {
    const { name, email, profile_pic, avatar, picture, phone, age, gender, bloodgroup, allergy, dob, role, location, status, googleId, password } = userData;
    
    const query = `
      INSERT INTO users (
        name, email, profile_pic, avatar, picture, phone, age, gender,
        bloodgroup, allergy, dob, location, status, role, google_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const params = [
      name || null,
      email,
      profile_pic || picture || avatar || null,
      avatar || picture || null,
      picture || null,
      phone || null,
      age || null,
      gender || null,
      bloodgroup || null,
      allergy || null,
      dob || null,
      location || null,
      status || 'active',
      role || 'patient',
      googleId || null,
      password || null,
    ];

    db.run(query, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          id: this.lastID,
          ...userData,
        });
      }
    });
  });
}

/**
 * Update user
 */
function updateUser(id, userData) {
  return new Promise((resolve, reject) => {
    const { name, email, profile_pic, avatar, picture, phone, age, gender, bloodgroup, allergy, dob, location, status, role, googleId, password } = userData;
    
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (email !== undefined) {
      fields.push('email = ?');
      params.push(email);
    }
    if (profile_pic !== undefined) {
      fields.push('profile_pic = ?');
      params.push(profile_pic);
    }
    if (avatar !== undefined || picture !== undefined) {
      fields.push('avatar = ?');
      params.push(avatar || picture || null);
      fields.push('picture = ?');
      params.push(picture || null);
    }
    if (phone !== undefined) {
      fields.push('phone = ?');
      params.push(phone);
    }
    if (age !== undefined) {
      fields.push('age = ?');
      params.push(age);
    }
    if (gender !== undefined) {
      fields.push('gender = ?');
      params.push(gender);
    }
    if (bloodgroup !== undefined) {
      fields.push('bloodgroup = ?');
      params.push(bloodgroup);
    }
    if (allergy !== undefined) {
      fields.push('allergy = ?');
      params.push(allergy);
    }
    if (dob !== undefined) {
      fields.push('dob = ?');
      params.push(dob);
    }
    if (location !== undefined) {
      fields.push('location = ?');
      params.push(location);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }
    if (role !== undefined) {
      fields.push('role = ?');
      params.push(role);
    }
    if (googleId !== undefined) {
      fields.push('google_id = ?');
      params.push(googleId);
    }
    if (password !== undefined) {
      fields.push('password = ?');
      params.push(password);
    }

    if (fields.length === 0) {
      resolve(null);
      return;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

    db.run(query, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, ...userData });
      }
    });
  });
}

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync,
  initializeDatabase,
  getUserByEmail,
  getUserById,
  getUserByGoogleId,
  createUser,
  updateUser,
};
