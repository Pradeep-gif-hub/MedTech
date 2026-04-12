/**
 * MedTech Backend - SQLite Database Module
 * Handles database initialization and user operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
          avatar TEXT,
          picture TEXT,
          phone TEXT,
          age INTEGER,
          gender TEXT,
          bloodgroup TEXT,
          allergy TEXT,
          dob TEXT,
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

      // Create index on email for faster lookups
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
            resolve();
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
    const { name, email, avatar, picture, phone, age, gender, bloodgroup, allergy, dob, role, googleId } = userData;
    
    const query = `
      INSERT INTO users (
        name, email, avatar, picture, phone, age, gender, 
        bloodgroup, allergy, dob, role, google_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const params = [
      name || null,
      email,
      avatar || picture || null,
      picture || null,
      phone || null,
      age || null,
      gender || null,
      bloodgroup || null,
      allergy || null,
      dob || null,
      role || 'patient',
      googleId || null,
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
    const { name, email, avatar, picture, phone, age, gender, bloodgroup, allergy, dob, role, googleId } = userData;
    
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
    if (role !== undefined) {
      fields.push('role = ?');
      params.push(role);
    }
    if (googleId !== undefined) {
      fields.push('google_id = ?');
      params.push(googleId);
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
  initializeDatabase,
  getUserByEmail,
  getUserById,
  getUserByGoogleId,
  createUser,
  updateUser,
};
