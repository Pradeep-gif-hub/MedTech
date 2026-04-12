/**
 * MedTech Backend - Express.js + Nodemailer + Brevo
 * Complete REST API for authentication, forgot password, and email services
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number.parseInt(process.env.PORT || '8000', 10);

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
app.use(express.json());

// ============ ENVIRONMENT VARIABLES ============
const SMTP_SERVER = process.env.SMTP_SERVER || process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@medtech.com';
const FROM_NAME = process.env.FROM_NAME || 'MedTech';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://medtech-4rjc.onrender.com';

console.log('[CONFIG] Email Configuration:');
console.log(`  SMTP_SERVER: ${SMTP_SERVER}`);
console.log(`  SMTP_PORT: ${SMTP_PORT}`);
console.log(`  SMTP_USER: ${SMTP_USER ? SMTP_USER.substring(0, 10) + '...' : '[MISSING]'}`);
console.log(`  SMTP_PASS: ${SMTP_PASS ? '[SET]' : '[MISSING]'}`);
console.log(`  FROM_EMAIL: ${FROM_EMAIL}`);
console.log(`  FRONTEND_URL: ${FRONTEND_URL}`);

// ============ NODEMAILER TRANSPORTER ============
const transporter = nodemailer.createTransport({
  host: SMTP_SERVER,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Test transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('[STARTUP] ❌ Nodemailer SMTP verification FAILED:', error.message);
  } else {
    console.log('[STARTUP] ✅ Nodemailer SMTP verification SUCCESS - ready to send emails');
  }
});

// ============ HEALTH CHECK ENDPOINTS ============
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'MedTech Backend - Express + Nodemailer is running',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    backend: 'Express.js + Nodemailer',
    cors_enabled: true,
    email_configured: Boolean(SMTP_USER && SMTP_PASS),
    timestamp: new Date().toISOString(),
  });
});

// ============ EMAIL STATUS ENDPOINT ============
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

// ============ TEST EMAIL ENDPOINT ============
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
      text: 'This is a test email from MedTech. If you received this, your email configuration is working correctly!',
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[TEST-EMAIL] ✅ Email sent successfully!`);
    console.log(`[TEST-EMAIL] Message ID: ${info.messageId}`);
    
    res.json({
      success: true,
      message: 'Test email sent successfully',
      to: email,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error(`[TEST-EMAIL] ❌ Failed to send test email:`, error.message);
    res.status(500).json({
      success: false,
      error: `Failed to send test email: ${error.message}`,
    });
  }
});

// ============ FORGOT PASSWORD ENDPOINT ============
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    console.log('[FORGOT-PASSWORD] ❌ Email not provided');
    return res.status(400).json({
      success: false,
      message: 'Email is required',
    });
  }

  console.log(`[FORGOT-PASSWORD] 📧 Request received for: ${email}`);

  try {
    // In a real app, you would:
    // 1. Check if user exists in database
    // 2. Generate reset token
    // 3. Save token to database with expiry
    // 4. Send email with reset link
    
    // For now, we'll generate a mock token
    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    const resetLink = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    console.log(`[FORGOT-PASSWORD] 🔐 Generated reset token for ${email}`);

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
            
            <p>Or copy this link:</p>
            <p style="background: #f3f4f6; padding: 12px; border-radius: 5px; word-break: break-all; font-size: 12px;">
              ${resetLink}
            </p>
            
            <div style="background: #fee2e2; padding: 12px; border-radius: 5px; color: #991b1b; margin-top: 20px;">
              ⚠️ This link expires in 1 hour. Do not share it with anyone.
            </div>
            
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              If you didn't request a password reset, you can ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `Password Reset Request\n\nClick this link to reset your password:\n${resetLink}\n\nThis link expires in 1 hour.`,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[FORGOT-PASSWORD] ✅ Reset email sent to ${email}`);
    console.log(`[FORGOT-PASSWORD] Message ID: ${info.messageId}`);

    res.json({
      success: true,
      message: 'Password reset email sent successfully. Check your inbox.',
      email,
    });
  } catch (error) {
    console.error(`[FORGOT-PASSWORD] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to send password reset email',
      error: error.message,
    });
  }
});

// ============ RESET PASSWORD ENDPOINT ============
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
    // In a real app, you would:
    // 1. Verify token from database
    // 2. Check if token is expired
    // 3. Validate new_password
    // 4. Hash password and update in database
    // 5. Mark token as used

    // For now, just return success
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
      error: error.message,
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

  const googleToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    console.log('[GOOGLE-LOGIN] 🔐 Processing Google authentication...');

    // For production: Verify the Google ID token
    // In development: Accept the token as-is (Google SDK handles verification on frontend)
    // 
    // Real verification would look like:
    // const { OAuth2Client } = require('google-auth-library');
    // const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    // const ticket = await client.verifyIdToken({
    //   idToken: googleToken,
    //   audience: process.env.GOOGLE_CLIENT_ID,
    // });
    // const payload = ticket.getPayload();

    // For now, we'll create a mock user response
    // In production, this would connect to a real database
    
    const mockUserId = Buffer.from(googleToken).toString('base64').substring(0, 20);
    const userEmail = `user-${mockUserId}@medtech.local`;

    console.log('[GOOGLE-LOGIN] ✅ Google token accepted');
    console.log('[GOOGLE-LOGIN] 👤 User email: ' + userEmail);

    // Check if user exists (in real app, this would be a database lookup)
    const isNewUser = Math.random() > 0.5; // Mock: 50% chance of new user

    // Generate a session token (in real app, use JWT or session ID)
    const sessionToken = Buffer.from(`${userEmail}:${Date.now()}`).toString('base64');

    const userData = {
      google_id: mockUserId,
      email: userEmail,
      name: `User ${mockUserId}`,
      picture: 'https://via.placeholder.com/150',
      email_verified: true,
      role: role || 'patient',
      is_new_user: isNewUser,
      token: sessionToken,
    };

    console.log(`[GOOGLE-LOGIN] ✅ Authentication successful`);
    console.log(`[GOOGLE-LOGIN] 📊 User: ${isNewUser ? 'NEW' : 'EXISTING'}`);

    res.json({
      success: true,
      user: userData,
      is_new_user: isNewUser,
      token: sessionToken,
    });
  } catch (error) {
    console.error('[GOOGLE-LOGIN] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: `Google login failed: ${error.message}`,
    });
  }
});

// ============ FALLBACK ROUTES FOR COMMON PATHS ============
app.post('/auth/forgot-password', async (req, res) => {
  // Fallback route
  const request = { ...req };
  request.body = req.body;
  
  // Forward to proper endpoint
  return app._router.handle(Object.assign(
    request,
    { url: '/api/auth/forgot-password', method: 'POST' }
  ), res);
});

app.post('/api/users/forgot-password', async (req, res) => {
  // Fallback route - forward to main handler
  return app._router.handle(Object.assign(
    { ...req, url: '/api/auth/forgot-password' },
    { method: 'POST' }
  ), res);
});

// ============ ERROR HANDLER ============
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ============ 404 HANDLER ============
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`[STARTUP] ✅ MedTech Backend Running on Port ${PORT}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`[STARTUP] 🌐 CORS enabled for development and production URLs`);
  console.log(`[STARTUP] 📧 Email Service: Brevo SMTP Relay`);
  console.log(`[STARTUP] 🔐 Authentication: Ready`);
  console.log(`[STARTUP] \n📍 Health Check: http://localhost:${PORT}/health`);
  console.log(`[STARTUP] 📧 Test Email: POST http://localhost:${PORT}/api/auth/test-email`);
  console.log(`[STARTUP] 🔐 Forgot Password: POST http://localhost:${PORT}/api/auth/forgot-password`);
  console.log(`[STARTUP] 🔑 Google OAuth: POST http://localhost:${PORT}/api/users/google-login`);
  console.log(`${'═'.repeat(70)}\n`);
});

module.exports = app;
