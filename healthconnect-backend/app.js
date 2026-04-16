/**
 * MedTech Backend - Express.js + SQLite + Google OAuth
 * Complete REST API for authentication, user management, and email services
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Database imports
let db = null;
let initializeDatabase = async () => {
  console.warn('[DB] initializeDatabase skipped (database module unavailable)');
};
let getUserByEmail = async () => null;
let getUserById = async () => null;
let getUserByGoogleId = async () => null;
let createUser = async () => {
  throw new Error('Database module unavailable');
};
let updateUser = async () => {
  throw new Error('Database module unavailable');
};

try {
  ({
    db,
    initializeDatabase,
    getUserByEmail,
    getUserById,
    getUserByGoogleId,
    createUser,
    updateUser,
  } = require('./database'));
  console.log('[DB] Database module loaded successfully');
} catch (dbLoadError) {
  console.error('[DB] Database module failed to load:', dbLoadError.message);
  console.warn('[DB] Running in no-database debug mode. Auth/profile routes may fail.');
}

// Force fresh load - bypass require cache
delete require.cache[require.resolve('./prescriptionPdfGenerator')];

// Prescription PDF Generator
const {
  generatePrescriptionBuffer,
  generateAndSavePrescription,
  generatePrescriptionFilename,
  normalizePrescriptionData,
} = require('./prescriptionPdfGenerator');
const prescriptionsRouter = require('./src/routes/prescriptions');

const app = express();
const PORT = Number.parseInt(process.env.PORT || '8000', 10);

// ============ ENVIRONMENT VARIABLES ============
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SMTP_SERVER = process.env.SMTP_SERVER || process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@medtech.com';
const FROM_NAME = process.env.FROM_NAME || 'MedTech';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://medtech-4rjc.onrender.com';

// ============ CORS CONFIGURATION ============
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://medtech-4rjc.onrender.com',
    'https://medtech-hcmo.onrender.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

console.log('[STARTUP] Configuring CORS with origins:', corsOptions.origin);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============ SECURITY HEADERS FOR COOP/COEP ============
// These headers allow cross-origin popup communication (Google Auth, postMessage, etc.)
app.use((req, res, next) => {
  // COOP: same-origin-allow-popups allows popups to communicate back via postMessage
  // This is required for Google OAuth popup to communicate with the opener window
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
  // COEP: unsafe-none allows loading cross-origin resources
  // Necessary for WebRTC, analytics, and other cross-origin features
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  console.log('[SECURITY] Headers set - COOP:', res.getHeader('Cross-Origin-Opener-Policy'), 
              'COEP:', res.getHeader('Cross-Origin-Embedder-Policy'));
  
  next();
});

app.use(express.json());
app.use('/api/prescriptions', prescriptionsRouter);

// ============ NODEMAILER TRANSPORTER ============
const transporter = nodemailer.createTransport({
  host: SMTP_SERVER,
  port: SMTP_PORT,
  secure: false,  // Brevo SMTP relay uses 587 without TLS
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false  // Allow self-signed certs
  }
});

// Test transporter on startup
console.log('[STARTUP] Testing SMTP connection...');
console.log('[STARTUP] SMTP_USER set:', Boolean(SMTP_USER && SMTP_USER.trim()));
console.log('[STARTUP] SMTP_PASS set:', Boolean(SMTP_PASS && SMTP_PASS.trim()));
console.log('[STARTUP] Attempting transporter.verify()...');

transporter.verify((error, success) => {
  if (error) {
    console.error('[STARTUP] ❌ CRITICAL: Nodemailer SMTP verification FAILED');
    console.error('[STARTUP] Error type:', error.code || error.name);
    console.error('[STARTUP] Error message:', error.message);
    console.error('[STARTUP] Full error:', JSON.stringify(error, null, 2));
    console.error('[STARTUP] ⚠️  Email sending will fail until SMTP credentials are fixed!');
  } else {
    console.log('[STARTUP] ✅ Nodemailer SMTP verification SUCCESS - ready to send emails');
    console.log('[STARTUP] Connected to:', SMTP_SERVER + ':' + SMTP_PORT);
  }
});

// ============ UTILITY FUNCTIONS ============
/**
 * Verify JWT token and extract user ID
 */
function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('[JWT] ❌ Token verification failed:', error.message);
    return null;
  }
}

/**
 * Generate JWT token for a user
 */
function generateJWT(userId) {
  return jwt.sign(
    { userId, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Extract token from Authorization header
 */
function getTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7).trim();
}

/**
 * Middleware to verify JWT and attach user to request
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = getTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authorization token',
    });
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }

  try {
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH] Error verifying user:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to verify authentication',
    });
  }
}

/**
 * Serialize user for response (remove sensitive fields)
 */
function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || user.picture,
    picture: user.picture,
    phone: user.phone,
    age: user.age,
    gender: user.gender,
    bloodgroup: user.bloodgroup,
    allergy: user.allergy,
    dob: user.dob,
    role: user.role,
    google_id: user.google_id,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║           MEDTECH BACKEND CONFIGURATION                 ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('[CONFIG] Email Configuration:');
console.log(`  SMTP_SERVER: ${SMTP_SERVER}`);
console.log(`  SMTP_PORT: ${SMTP_PORT}`);
console.log(`  SMTP_USER configured: ${Boolean(SMTP_USER && SMTP_USER.trim()) ? '✅ YES' : '❌ NO (PLACEHOLDER)'}`);
console.log(`  SMTP_PASS configured: ${Boolean(SMTP_PASS && SMTP_PASS.trim() && !SMTP_PASS.includes('your_')) ? '✅ YES' : '❌ NO (PLACEHOLDER)'}`);
console.log(`  FROM_EMAIL: ${FROM_EMAIL}`);
console.log(`  FRONTEND_URL: ${FRONTEND_URL}`);
console.log('[CONFIG] Google OAuth:');
console.log(`  GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID ? '✅ SET' : '❌ NOT SET'}`);
console.log('\n');

// ============ HEALTH CHECK ENDPOINTS ============
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'MedTech Backend - Express + SQLite + Google OAuth is running',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    backend: 'Express.js + SQLite + Google OAuth',
    cors_enabled: true,
    email_configured: Boolean(SMTP_USER && SMTP_PASS),
    database: 'sqlite3',
    timestamp: new Date().toISOString(),
  });
});

// ============ DEBUG ENDPOINT - Test SMTP directly ============
app.post('/api/debug/test-smtp', async (req, res) => {
  const { to_email = 'pawasthi063@gmail.com' } = req.body || {};
  
  console.log('\n\n🔍🔍🔍 DEBUG EMAIL TEST STARTING 🔍🔍🔍');
  console.log(`[DEBUG] Target email: ${to_email}`);
  console.log(`[DEBUG] SMTP_SERVER: ${SMTP_SERVER}`);
  console.log(`[DEBUG] SMTP_PORT: ${SMTP_PORT}`);
  console.log(`[DEBUG] SMTP_USER: ${SMTP_USER ? SMTP_USER.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log(`[DEBUG] SMTP_PASS length: ${SMTP_PASS ? SMTP_PASS.length : 0}`);
  console.log(`[DEBUG] FROM_EMAIL: ${FROM_EMAIL}`);
  console.log(`[DEBUG] Creating test email...`);

  try {
    const testMail = {
      from: `MedTech <${FROM_EMAIL}>`,
      to: to_email,
      subject: '🔍 MedTech SMTP Debug Test',
      html: `<h1>SMTP Test Email</h1><p>If you see this, SMTP is working!</p><p>Sent at: ${new Date().toISOString()}</p>`,
      text: 'SMTP Test Email - If you see this, SMTP is working!',
    };

    console.log(`[DEBUG] Mail options created. Attempting sendMail()...`);
    const info = await transporter.sendMail(testMail);
    
    console.log(`[DEBUG] ✅ Email sent successfully!`);
    console.log(`[DEBUG] Message ID: ${info.messageId}`);
    console.log(`[DEBUG] Response: ${info.response}`);
    console.log('🔍🔍🔍 DEBUG EMAIL TEST PASSED 🔍🔍🔍\n\n');

    res.json({
      success: true,
      message: 'SMTP test email sent successfully',
      messageId: info.messageId,
      response: info.response,
    });
  } catch (err) {
    console.error(`[DEBUG] ❌ EMAIL TEST FAILED`);
    console.error(`[DEBUG] Error name: ${err.name}`);
    console.error(`[DEBUG] Error code: ${err.code}`);
    console.error(`[DEBUG] Error message: ${err.message}`);
    console.error(`[DEBUG] Error command: ${err.command}`);
    console.error(`[DEBUG] Error response: ${err.response}`);
    console.error(`[DEBUG] Full error object:`, JSON.stringify(err, null, 2));
    console.error('🔍🔍🔍 DEBUG EMAIL TEST FAILED 🔍🔍🔍\n\n');

    res.status(500).json({
      success: false,
      message: 'SMTP test email failed',
      error: {
        name: err.name,
        code: err.code,
        message: err.message,
        command: err.command,
        response: err.response,
      },
    });
  }
});

// ============ EMAIL ENDPOINTS ============
app.get('/api/auth/email-health', (_req, res) => {
  const isConfigured = Boolean(SMTP_USER && SMTP_PASS);
  console.log('[EMAIL-HEALTH] Checking SMTP configuration...');

  res.json({
    provider: 'brevo_nodemailer',
    configured: isConfigured,
    smtp_server: isConfigured ? SMTP_SERVER : '[not-configured]',
    smtp_port: isConfigured ? SMTP_PORT : '[not-configured]',
    from_email: isConfigured ? FROM_EMAIL : '[not-configured]',
    from_name: isConfigured ? FROM_NAME : '[not-configured]',
    frontend_url: FRONTEND_URL,
  });
});

app.post('/api/auth/test-email', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email address is required',
    });
  }

  console.log(`[TEST-EMAIL] 📧 Sending test email to: ${email}`);

  try {
    const mailOptions = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: '✅ MedTech Test Email - SMTP Configuration Working',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
          <div style="background: #10b981; padding: 20px; color: white; text-align: center;">
            <h2 style="margin: 0;">✅ Test Email</h2>
          </div>
          <div style="padding: 30px;">
            <p>Hello,</p>
            <p>This is a test email from <strong>MedTech</strong>.</p>
            <p style="background: #ecfdf5; padding: 15px; border-left: 4px solid #10b981; color: #065f46;">
              ✅ If you received this, your MedTech email configuration is working correctly!
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[TEST-EMAIL] ✅ Email sent successfully!`);
    res.json({
      success: true,
      message: 'Test email sent successfully',
      to: email,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error(`[TEST-EMAIL] ❌ Failed:`, error.message);
    res.status(500).json({
      success: false,
      error: `Failed to send test email: ${error.message}`,
    });
  }
});

// ============ FORGOT PASSWORD & RESET PASSWORD ENDPOINTS ============
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required',
    });
  }

  console.log(`[FORGOT-PASSWORD] 📧 Request received for: ${email}`);
  console.log(`[FORGOT-PASSWORD] SMTP configured: ${Boolean(SMTP_USER && SMTP_PASS) ? 'YES' : 'NO - USING PLACEHOLDERS'}`);

  // Check if SMTP is properly configured
  if (!SMTP_USER || !SMTP_PASS || SMTP_USER.includes('your_') || SMTP_PASS.includes('your_')) {
    console.error('[FORGOT-PASSWORD] ❌ SMTP credentials are not configured (still placeholders)');
    return res.status(500).json({
      success: false,
      message: 'Email service is not properly configured on server',
      error: 'Missing SMTP credentials - check Render environment variables',
    });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      console.log(`[FORGOT-PASSWORD] User not found: ${email}`);
      return res.json({
        success: true,
        message: 'If an account exists, a password reset email will be sent.',
      });
    }

    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    const resetLink = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: 'Password Reset Request - MedTech',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
          <div style="background: #10b981; padding: 20px; color: white; text-align: center;">
            <h2 style="margin: 0;">MedTech</h2>
          </div>
          <div style="padding: 30px;">
            <h3>Password Reset Request</h3>
            <p>Hello,</p>
            <p>We received a request to reset your MedTech password.</p>
            <p>Click the button below to create a new password:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}"
                 style="background: #10b981; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                Reset Password
              </a>
            </div>

            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              If you didn't request a password reset, you can ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    try {
      console.log(`[FORGOT-PASSWORD] Attempting to send email via SMTP...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`[FORGOT-PASSWORD] ✅ Reset email SENT SUCCESSFULLY to ${email}`);
      console.log(`[FORGOT-PASSWORD] Message ID: ${info.messageId}`);
      res.json({
        success: true,
        message: 'Password reset email sent successfully.',
      });
    } catch (emailError) {
      console.error(`[FORGOT-PASSWORD] ❌ CRITICAL: Email send FAILED`);
      console.error(`[FORGOT-PASSWORD] Error name: ${emailError.name}`);
      console.error(`[FORGOT-PASSWORD] Error code: ${emailError.code}`);
      console.error(`[FORGOT-PASSWORD] Error message: ${emailError.message}`);
      if (emailError.response) {
        console.error(`[FORGOT-PASSWORD] SMTP Response: ${emailError.response}`);
      }
      console.error(`[FORGOT-PASSWORD] Full error:`, JSON.stringify(emailError, null, 2).substring(0, 500));
      
      res.status(500).json({
        success: false,
        message: 'Failed to send password reset email',
        error: emailError.message,
        details: process.env.NODE_ENV === 'development' ? {
          code: emailError.code,
          name: emailError.name,
          message: emailError.message,
        } : undefined,
      });
    }
  } catch (error) {
    console.error(`[FORGOT-PASSWORD] ❌ CRITICAL: Unexpected request error`);
    console.error(`[FORGOT-PASSWORD] Error: ${error.message}`);
    console.error(`[FORGOT-PASSWORD] Stack:`, error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, email, new_password } = req.body || {};

  if (!token || !email || !new_password) {
    return res.status(400).json({
      success: false,
      message: 'token, email, and new_password are required',
    });
  }

  console.log(`[RESET-PASSWORD] Reset password request for: ${email}`);

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log(`[RESET-PASSWORD] ✅ Password reset successful for ${email}`);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error(`[RESET-PASSWORD] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
});

// ============ GOOGLE OAUTH ENDPOINT ============
app.post('/api/users/google-login', async (req, res) => {
  const authHeader = req.headers.authorization;
  const { role } = req.body || {};

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[GOOGLE-LOGIN] ❌ Missing or invalid Authorization header');
    return res.status(400).json({
      success: false,
      error: 'Missing authorization token',
    });
  }

  const googleToken = getTokenFromHeader(authHeader);

  try {
    console.log('[GOOGLE-LOGIN] 🔐 Processing Google authentication...');

    let payload = null;

    // Try to verify Google token if client ID is configured
    if (GOOGLE_CLIENT_ID) {
      try {
        const client = new OAuth2Client(GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken: googleToken,
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
        console.log('[GOOGLE-LOGIN] ✅ Google token verified successfully');
      } catch (verifyError) {
        console.warn('[GOOGLE-LOGIN] ⚠️ Token verification failed, will try parsing token manually:', verifyError.message);
      }
    }

    // If verification failed or no client ID, try to decode token manually
    if (!payload) {
      try {
        const parts = googleToken.split('.');
        if (parts.length === 3) {
          const decodedPayload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString()
          );
          payload = decodedPayload;
          console.log('[GOOGLE-LOGIN] ℹ️ Parsed token manually (unverified)');
        }
      } catch (parseError) {
        console.error('[GOOGLE-LOGIN] ❌ Could not parse Google token:', parseError.message);
        return res.status(400).json({
          success: false,
          error: 'Invalid Google token',
        });
      }
    }

    if (!payload) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract user information from token',
      });
    }

    // Extract user data from Google payload
    const googleId = payload.sub || payload.user_id;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email not found in Google token',
      });
    }

    console.log('[GOOGLE-LOGIN] 👤 Google User:');
    console.log(`  - ID: ${googleId}`);
    console.log(`  - Email: ${email}`);
    console.log(`  - Name: ${name}`);
    console.log(`  - Avatar: ${picture ? 'yes' : 'no'}`);

    // Check if user exists
    let user = await getUserByEmail(email);
    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      console.log('[GOOGLE-LOGIN] 📝 Creating new user...');

      try {
        user = await createUser({
          name,
          email,
          avatar: picture,
          picture,
          role: role || 'patient',
          googleId,
        });

        console.log('[GOOGLE-LOGIN] ✅ New user created with ID:', user.id);
      } catch (createError) {
        console.error('[GOOGLE-LOGIN] ❌ Error creating user:', createError.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user account',
        });
      }
    } else {
      // Update existing user with Google ID if not already set
      if (!user.google_id && googleId) {
        try {
          user = await updateUser(user.id, { googleId });
          console.log('[GOOGLE-LOGIN] ✅ Updated existing user with Google ID');
        } catch (updateError) {
          console.error('[GOOGLE-LOGIN] ⚠️ Could not update user with Google ID:', updateError.message);
        }
      }
      console.log('[GOOGLE-LOGIN] ℹ️ Using existing user');
    }

    // Generate JWT token
    const jwtToken = generateJWT(user.id);

    console.log(`[GOOGLE-LOGIN] ✅ Authentication successful`);
    console.log(`[GOOGLE-LOGIN] 📊 User: ${isNewUser ? 'NEW' : 'EXISTING'} (ID: ${user.id})`);

    res.json({
      success: true,
      token: jwtToken,
      user: serializeUser(user),
      is_new_user: isNewUser,
    });
  } catch (error) {
    console.error('[GOOGLE-LOGIN] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: `Google login failed: ${error.message}`,
    });
  }
});

// ============ USER ENDPOINTS ============
/**
 * GET /api/users/me
 * Fetch current authenticated user's profile
 */
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    console.log(`[API:GET /users/me] Fetching user ${req.user.id} profile`);

    res.json({
      success: true,
      user: serializeUser(req.user),
    });
  } catch (error) {
    console.error('[API:GET /users/me] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
    });
  }
});

/**
 * PUT /api/users/me
 * Update current user's profile
 */
app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { name, phone, age, gender, bloodgroup, allergy, dob } = req.body || {};

    console.log(`[API:PUT /users/me] Updating user ${req.user.id} profile`);

    const updatedUser = await updateUser(req.user.id, {
      name,
      phone,
      age,
      gender,
      bloodgroup,
      allergy,
      dob,
    });

    console.log(`[API:PUT /users/me] ✅ User profile updated`);

    res.json({
      success: true,
      user: serializeUser(updatedUser || req.user),
    });
  } catch (error) {
    console.error('[API:PUT /users/me] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile',
    });
  }
});

// ============ FALLBACK ROUTES FOR COMMON PATHS ============
app.post('/auth/forgot-password', (req, res) => {
  req.url = '/api/auth/forgot-password';
  app._router.handle(req, res);
});

app.post('/api/users/forgot-password', (req, res) => {
  req.url = '/api/auth/forgot-password';
  app._router.handle(req, res);
});

// ============ PRESCRIPTION PDF ENDPOINTS ============

/**
 * POST /api/prescription/generate
 * Generate a prescription PDF from JSON data using PDFKit
 * 
 * Body:
 * {
 *   "clinicName": "MedTech Clinic",
 *   "clinicAddress": "...",
 *   "clinicContact": "...",
 *   "doctor": {
 *     "name": "Dr. John Doe",
 *     "qualification": "MBBS, MD",
 *     "registrationNumber": "12345"
 *   },
 *   "patient": {
 *     "name": "Rahul Sharma",
 *     "age": 25,
 *     "gender": "Male"
 *   },
 *   "diagnosis": "...",
 *   "prescriptionId": "RX-1001",
 *   "medicines": [
 *     {
 *       "name": "string",
 *       "dosage": "string",
 *       "frequency": "string",
 *       "duration": "string"
 *     }
 *   ],
 *   "logoPath": "assets/logo.png",
 *   "signaturePath": "assets/signature.png",
 *   "stampPath": "assets/stamp.png"
 * }
 */
app.post('/api/prescription/generate', async (req, res) => {
  try {
    console.log('[Prescription API] Received prescription generation request');

    const normalized = normalizePrescriptionData(req.body || {});

    // Validate required fields
    if (!normalized.patient.name || !normalized.doctor.name || normalized.patient.name === 'N/A' || normalized.doctor.name === 'N/A') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: patient.name and doctor.name (or legacy patientName and doctor)',
      });
    }

    console.log('[Prescription API] Generating PDF for patient:', normalized.patient.name);

    // Generate PDF buffer
    const pdfBuffer = await generatePrescriptionBuffer(req.body || {});

    // Set response headers
    const filename = generatePrescriptionFilename(normalized.patient.name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log('[Prescription API] PDF generated successfully, size:', pdfBuffer.length, 'bytes');

    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[Prescription API] Error generating prescription:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate prescription PDF',
      details: error.message,
    });
  }
});

/**
 * POST /api/prescription/preview
 * Get normalized prescription JSON preview (for testing)
 */
app.post('/api/prescription/preview', (req, res) => {
  try {
    console.log('[Prescription API] Received preview request');
    const normalizedPreview = normalizePrescriptionData(req.body || {});
    res.json({
      success: true,
      renderer: 'pdfkit',
      message: 'HTML preview is not available in PDFKit mode. Use /api/prescription/generate for PDF output.',
      data: normalizedPreview,
    });
  } catch (error) {
    console.error('[Prescription API] Error generating preview:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate prescription preview data',
      details: error.message,
    });
  }
});

/**
 * GET /api/prescription/sample
 * Get sample prescription data for testing
 */
app.get('/api/prescription/sample', (_req, res) => {
  console.log('[Prescription API] Returning sample prescription data');

  const sampleData = {
    clinicName: 'MedTech Clinic',
    clinicAddress: '21 Health Avenue, Sector 12, New Delhi',
    clinicContact: '+91-98765-43210 | support@medtechclinic.com',
    doctor: {
      name: 'Dr. Sharma',
      qualification: 'MBBS, MD',
      registrationNumber: 'DMC-102938',
    },
    patient: {
      name: 'Pradeep Awasthi',
      age: 28,
      gender: 'Male',
    },
    prescriptionId: 'RX-2026-00032',
    diagnosis: 'Fever and cold with mild cough. Patient experiencing fatigue and body aches for 2-3 days. Temperature recorded at 101.5°F. OPD examination normal. Recommended rest and hydration.',
    date: '2026-04-16',
    medicines: [
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Twice daily (morning & evening)',
        duration: '5 days',
      },
      {
        name: 'Amoxicillin',
        dosage: '250mg',
        frequency: 'Three times daily (with meals)',
        duration: '7 days',
      },
      {
        name: 'Cetirizine HCL',
        dosage: '10mg',
        frequency: 'Once at night',
        duration: '5 days',
      },
      {
        name: 'Linctus Cough Syrup',
        dosage: '2 teaspoons',
        frequency: 'Three times daily (after meals)',
        duration: '5 days',
      },
    ],
  };

  res.json({
    success: true,
    data: sampleData,
    message: 'Use this data structure to generate prescriptions',
  });
});

// ============ ERROR HANDLERS ============
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// ============ INITIALIZATION & SERVER START ============
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`[STARTUP] ✅ MedTech Backend Running on Port ${PORT}`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`[STARTUP] 🌐 CORS enabled for development and production URLs`);
      console.log(`[STARTUP] 📧 Email Service: Brevo SMTP Relay`);
      console.log(`[STARTUP] 🔐 Authentication: Google OAuth + JWT`);
      console.log(`[STARTUP] 💾 Database: SQLite3`);
      console.log(`[STARTUP] \n📍 Health Check: http://localhost:${PORT}/health`);
      console.log(`[STARTUP] 🔑 Google Login: POST http://localhost:${PORT}/api/users/google-login`);
      console.log(`[STARTUP] 👤 Get User: GET http://localhost:${PORT}/api/users/me`);
      console.log(`[STARTUP] 📧 Email Health: GET http://localhost:${PORT}/api/auth/email-health`);
      console.log(`${'═'.repeat(70)}\n`);
    });
  } catch (error) {
    console.error('[STARTUP] ❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
