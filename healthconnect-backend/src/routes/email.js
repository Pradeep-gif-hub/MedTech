const express = require('express');
const {
  sendTestEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  getEmailHealth,
  getLastEmailError,
} = require('../utils/mailer');

const router = express.Router();

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

router.post('/send-reset-email', async (req, res) => {
  console.log('[MAILER_ROUTE] POST /send-reset-email hit with body keys:', Object.keys(req.body || {}));
  const email = String((req.body && req.body.email) || '').trim();
  const resetLink = String((req.body && req.body.resetLink) || '').trim();

  if (!email || !resetLink) {
    return res.status(400).json({
      success: false,
      message: 'email and resetLink are required.',
    });
  }

  try {
    const result = await sendPasswordResetEmail(email, resetLink);

    if (!result.success) {
      console.error('[MAILER_ROUTE] /send-reset-email Email failed:', result.error || getLastEmailError());
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email.',
        error: result.error || getLastEmailError() || 'Unknown email error',
      });
    }

    return res.json({
      success: true,
      message: 'Password reset email sent successfully.',
      to: email,
      provider: result.provider || 'brevo_smtp',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[MAILER_ROUTE] /send-reset-email error:', error && error.stack ? error.stack : error);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error while sending password reset email.',
      error: error && error.message ? error.message : 'Unknown error',
    });
  }
});

module.exports = router;
