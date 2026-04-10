const express = require('express');
const {
  sendTestEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  getEmailHealth,
  getLastEmailError,
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

module.exports = router;
