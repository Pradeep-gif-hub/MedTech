const express = require('express');
const {
  sendTestEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  getEmailHealth,
  getLastEmailError,
  verifySmtpConnection,
} = require('../utils/mailer');

const router = express.Router();

function getRequestDebugMeta(req) {
  return {
    origin: req.get('origin') || '[missing-origin-header]',
    referer: req.get('referer') || '[missing-referer-header]',
    host: req.get('host') || '[missing-host-header]',
    xForwardedHost: req.get('x-forwarded-host') || '[missing-x-forwarded-host]',
    xForwardedProto: req.get('x-forwarded-proto') || '[missing-x-forwarded-proto]',
    ip: req.ip || req.socket && req.socket.remoteAddress || '[unknown-ip]',
    path: req.originalUrl || req.path || '[unknown-path]',
    method: req.method || '[unknown-method]',
  };
}

router.get('/email-health', (req, res) => {
  console.log('[MAILER_ROUTE] GET /email-health hit');
  return res.json(getEmailHealth());
});

router.get('/test-email', async (req, res) => {
  console.log('[MAILER_ROUTE] GET /test-email hit with query:', req.query);
  const email = String(req.query.email || '').trim();
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Query parameter email is required.',
    });
  }

  try {
    const result = await sendTestEmail(email);

    if (!result.success) {
      console.error('[MAILER_ROUTE] /test-email Email failed:', result.error || getLastEmailError());
      return res.status(500).json({
        success: false,
        message: 'Email failed',
        error: result.error || getLastEmailError() || 'Unknown email error',
      });
    }

    console.log('[MAILER_ROUTE] /test-email Email sent:', result.messageId || '[no-message-id]');
    return res.json({
      success: true,
      message: 'Email sent',
      to: email,
      provider: result.provider || 'brevo_smtp',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[MAILER_ROUTE] /test-email error:', error && error.stack ? error.stack : error);
    return res.status(500).json({
      success: false,
      message: 'Email failed',
      error: error && error.message ? error.message : 'Unknown error',
    });
  }
});

router.post('/test-email', async (req, res) => {
  console.log('[MAILER_ROUTE] POST /test-email hit with body:', Object.keys(req.body || {}));
  const email = String((req.body && req.body.email) || '').trim();
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Body parameter email is required.',
    });
  }

  try {
    const result = await sendTestEmail(email);

    if (!result.success) {
      console.error('[MAILER_ROUTE] POST /test-email Email failed:', result.error || getLastEmailError());
      return res.status(500).json({
        success: false,
        message: 'Email failed',
        error: result.error || getLastEmailError() || 'Unknown email error',
      });
    }

    console.log('[MAILER_ROUTE] POST /test-email Email sent:', result.messageId || '[no-message-id]');
    return res.json({
      success: true,
      message: 'Test email sent successfully',
      to: email,
      provider: result.provider || 'brevo_smtp',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[MAILER_ROUTE] POST /test-email error:', error && error.stack ? error.stack : error);
    return res.status(500).json({
      success: false,
      message: 'Email failed',
      error: error && error.message ? error.message : 'Unknown error',
    });
  }
});

router.post('/send-otp-email', async (req, res) => {
  console.log('[MAILER_ROUTE] POST /send-otp-email hit with body keys:', Object.keys(req.body || {}));
  const email = String((req.body && req.body.email) || '').trim();
  const otp = String((req.body && req.body.otp) || '').trim();

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: 'email and otp are required.',
    });
  }

  try {
    const result = await sendOtpEmail(email, otp);

    if (!result.success) {
      console.error('[MAILER_ROUTE] /send-otp-email Email failed:', result.error || getLastEmailError());
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email.',
        error: result.error || getLastEmailError() || 'Unknown email error',
      });
    }

    return res.json({
      success: true,
      message: 'OTP email sent successfully.',
      to: email,
      provider: result.provider || 'brevo_smtp',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[MAILER_ROUTE] /send-otp-email error:', error && error.stack ? error.stack : error);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error while sending OTP email.',
      error: error && error.message ? error.message : 'Unknown error',
    });
  }
});

async function handleSendResetEmail(req, res) {
  const requestMeta = getRequestDebugMeta(req);
  console.log('[MAILER_ROUTE] POST /send-reset-email route hit');
  console.log('[MAILER_ROUTE] Request meta:', requestMeta);
  console.log('[MAILER_ROUTE] Body keys:', Object.keys(req.body || {}));

  const email = String((req.body && req.body.email) || '').trim();
  const resetLink = String((req.body && req.body.resetLink) || '').trim();

  console.log('[MAILER_ROUTE] Processing reset email request for:', email || '[missing-email]');

  if (!email || !resetLink) {
    console.error('[MAILER_ROUTE] /send-reset-email validation failed:', {
      hasEmail: Boolean(email),
      hasResetLink: Boolean(resetLink),
      requestMeta,
    });
    return res.status(400).json({
      success: false,
      message: 'email and resetLink are required.',
    });
  }

  try {
    console.log('[MAILER_ROUTE] /send-reset-email calling sendPasswordResetEmail');
    const result = await sendPasswordResetEmail(email, resetLink);
    console.log('[MAILER_ROUTE] /send-reset-email sendPasswordResetEmail returned:', {
      success: Boolean(result && result.success),
      provider: result && result.provider ? result.provider : '[unknown-provider]',
      messageId: result && result.messageId ? result.messageId : '[missing-message-id]',
      error: result && result.error ? result.error : null,
    });

    if (!result.success) {
      console.error('[MAILER_ROUTE] /send-reset-email Email failed:', result.error || getLastEmailError());
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email.',
        error: result.error || getLastEmailError() || 'Unknown email error',
      });
    }

    console.log('[MAILER_ROUTE] /send-reset-email success response emitted');
    return res.json({
      success: true,
      message: 'Password reset email sent successfully.',
      to: email,
      provider: result.provider || 'brevo_smtp',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[MAILER_ROUTE] /send-reset-email error:', error && error.message ? error.message : error);
    console.error('[MAILER_ROUTE] /send-reset-email full error stack:', error && error.stack ? error.stack : '[no-stack-available]');
    return res.status(500).json({
      success: false,
      message: 'Unexpected error while sending password reset email.',
      error: error && error.message ? error.message : 'Unknown error',
    });
  }
}

router.post('/send-reset-email', handleSendResetEmail);
router.post('/auth/forgot-password', handleSendResetEmail);
router.post('/users/forgot-password', handleSendResetEmail);

// ============ VERIFICATION & DEBUG ROUTES ============
router.get('/verify', async (req, res) => {
  console.log('[MAILER_ROUTE] GET /verify - Testing SMTP connection');
  try {
    const result = await verifySmtpConnection();
    const statusCode = result.success ? 200 : 500;
    return res.status(statusCode).json(result);
  } catch (error) {
    console.error('[MAILER_ROUTE] /verify error:', error && error.stack ? error.stack : error);
    return res.status(500).json({
      success: false,
      verified: false,
      error: error && error.message ? error.message : 'Unknown verification error',
    });
  }
});

router.post('/debug-forgot-password', async (req, res) => {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║ [DEBUG] FORGOT PASSWORD EMAIL VERIFICATION FLOW                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const email = String((req.body && req.body.email) || '').trim();
  const testResetLink = String((req.body && req.body.resetLink) || 'https://medtech-4rjc.onrender.com/reset?token=test-token-12345&email=').trim();

  console.log('[DEBUG] Input parameters:');
  console.log(`  - Email: ${email || '[MISSING]'}`);
  console.log(`  - Reset Link prefix: ${testResetLink || '[MISSING]'}`);

  if (!email) {
    console.error('[DEBUG] ❌ Email parameter is required');
    return res.status(400).json({
      success: false,
      step: 'input_validation',
      error: 'email parameter is required',
    });
  }

  try {
    // STEP 1: Verify SMTP connection
    console.log('\n[DEBUG] STEP 1: Verifying SMTP connection...');
    const verifyResult = await verifySmtpConnection();
    if (!verifyResult.success) {
      console.error('[DEBUG] ❌ STEP 1 FAILED: SMTP verification failed');
      console.error('[DEBUG] Error:', verifyResult.error);
      return res.status(500).json({
        success: false,
        step: 'smtp_verification',
        error: verifyResult.error,
        details: verifyResult,
      });
    }
    console.log('[DEBUG] ✅ STEP 1 PASSED: SMTP connection is working');

    // STEP 2: Send test email
    console.log('\n[DEBUG] STEP 2: Sending password reset email to ' + email + '...');
    const resetLink = testResetLink + email;
    const emailResult = await sendPasswordResetEmail(email, resetLink);
    
    console.log('[DEBUG] Email send result:', {
      success: Boolean(emailResult && emailResult.success),
      provider: emailResult && emailResult.provider ? emailResult.provider : '[unknown]',
      messageId: emailResult && emailResult.messageId ? emailResult.messageId : '[missing]',
      error: emailResult && emailResult.error ? emailResult.error : null,
    });

    if (!emailResult.success) {
      console.error('[DEBUG] ❌ STEP 2 FAILED: Email delivery failed');
      console.error('[DEBUG] Error:', emailResult.error || getLastEmailError());
      return res.status(500).json({
        success: false,
        step: 'email_send',
        error: emailResult.error || getLastEmailError() || 'Unknown email error',
        details: emailResult,
      });
    }

    console.log('[DEBUG] ✅ STEP 2 PASSED: Email sent successfully');
    console.log('[DEBUG] Message ID:', emailResult.messageId || '[no-message-id]');
    console.log('[DEBUG] Provider:', emailResult.provider || 'brevo_smtp');

    console.log('\n[DEBUG] ✅✅✅ ALL STEPS COMPLETED SUCCESSFULLY ✅✅✅');
    console.log('[DEBUG] The email should arrive within 1-2 minutes');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    return res.json({
      success: true,
      message: 'Forgot password email debug completed successfully',
      email,
      messageId: emailResult.messageId || null,
      provider: emailResult.provider || 'brevo_smtp',
      instructions: 'Check your inbox for the reset email (may take 1-2 minutes). If not received, check spam folder.',
    });
  } catch (error) {
    console.error('\n[DEBUG] ❌ UNHANDLED ERROR');
    console.error('[DEBUG] Error message:', error && error.message ? error.message : String(error));
    if (error && error.stack) {
      console.error('[DEBUG] Stack trace:', error.stack);
    }
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    return res.status(500).json({
      success: false,
      step: 'unhandled_error',
      error: error && error.message ? error.message : 'Unknown error',
      stack: error && error.stack ? error.stack : null,
    });
  }
});

module.exports = router;
