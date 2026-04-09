const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

const PORT = Number.parseInt(process.env.PORT || '8000', 10);
const EMAIL_USER = String(process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = String(process.env.EMAIL_PASS || '').replace(/\s+/g, '').trim();
const EMAIL_FROM_NAME = String(process.env.EMAIL_FROM_NAME || 'MedTech').trim() || 'MedTech';

let transporter;

function createMailTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

function getTransporter() {
  if (!transporter) {
    transporter = createMailTransporter();
  }
  return transporter;
}

async function verifyTransporter() {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('[MAILER] Missing required environment variables: EMAIL_USER and EMAIL_PASS');
    return false;
  }

  try {
    await getTransporter().verify();
    console.log('[MAILER] Transporter verification successful. Gmail SMTP is ready.');
    return true;
  } catch (error) {
    console.error('[MAILER] Transporter verification failed.');
    console.error('[MAILER] Full verification error:', error);
    return false;
  }
}

async function sendEmail(to, subject, html) {
  const recipient = String(to || '').trim();
  const safeSubject = String(subject || '').trim();
  const htmlContent = String(html || '').trim();

  if (!EMAIL_USER || !EMAIL_PASS) {
    const message = 'EMAIL_USER and EMAIL_PASS are required in environment variables.';
    console.error('[MAILER] sendEmail config error:', message);
    return { success: false, error: message };
  }

  if (!recipient || !safeSubject || !htmlContent) {
    const message = 'sendEmail(to, subject, html) requires non-empty to, subject, and html values.';
    console.error('[MAILER] sendEmail validation error:', {
      to: recipient || '[missing]',
      subject: safeSubject || '[missing]',
      hasHtml: Boolean(htmlContent),
    });
    return { success: false, error: message };
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
      to: recipient,
      subject: safeSubject,
      html: htmlContent,
    });

    console.log('[MAILER] Email sent successfully:', {
      to: recipient,
      messageId: info.messageId,
      response: info.response,
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('[MAILER] Email sending failed.');
    console.error('[MAILER] Full send error:', error);
    return {
      success: false,
      error: error && error.message ? error.message : 'Unknown email error',
    };
  }
}

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Email backend is running',
  });
});

app.get('/test-email', async (_req, res) => {
  if (!EMAIL_USER) {
    console.error('[MAILER_ROUTE] /test-email failed: EMAIL_USER is not configured');
    return res.status(500).json({
      success: false,
      message: 'EMAIL_USER is not configured on the server.',
    });
  }

  const subject = 'MedTech Gmail SMTP Test Email';
  const html = `
    <h2>MedTech Email Test</h2>
    <p>This is a test email sent using Nodemailer with Gmail SMTP.</p>
    <p>If you received this, your email backend is working correctly.</p>
    <hr />
    <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
  `;

  const result = await sendEmail(EMAIL_USER, subject, html);

  if (!result.success) {
    console.error('[MAILER_ROUTE] /test-email send failure:', result.error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test email.',
      error: result.error,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Test email sent successfully.',
    to: EMAIL_USER,
    messageId: result.messageId,
  });
});

async function startServer() {
  await verifyTransporter();

  return app.listen(PORT, () => {
    console.log(`[SERVER] Node mail service listening on port ${PORT}`);
    console.log('[SERVER] SMTP host: smtp.gmail.com');
    console.log('[SERVER] SMTP port: 465');
    console.log('[SERVER] Secure SMTP: true');
    console.log('[SERVER] EMAIL_USER configured:', Boolean(EMAIL_USER));
    console.log('[SERVER] EMAIL_PASS configured:', Boolean(EMAIL_PASS));
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('[SERVER] Failed to start server.');
    console.error('[SERVER] Startup error:', error);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  createMailTransporter,
  verifyTransporter,
  sendEmail,
};
