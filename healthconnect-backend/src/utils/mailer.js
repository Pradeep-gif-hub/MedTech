const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const nodemailer = require('nodemailer');

const DEFAULT_SMTP_SERVER = 'smtp-relay.brevo.com';
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_FROM_NAME = 'MedTech';
const OTP_EXPIRY_MINUTES = 5;

let lastEmailError = '';

function setLastEmailError(message) {
  lastEmailError = String(message || '').slice(0, 1000);
}

function getLastEmailError() {
  return lastEmailError;
}

function getSmtpConfig() {
  const smtpServer = String(process.env.SMTP_SERVER || process.env.SMTP_HOST || DEFAULT_SMTP_SERVER).trim();
  const smtpPortRaw = String(process.env.SMTP_PORT || DEFAULT_SMTP_PORT).trim();
  const smtpPort = Number.parseInt(smtpPortRaw, 10);
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  const fromName = String(process.env.FROM_NAME || DEFAULT_FROM_NAME).trim() || DEFAULT_FROM_NAME;
  const fromEmail = String(process.env.FROM_EMAIL || smtpUser || '').trim();

  return {
    smtpServer,
    smtpPort: Number.isFinite(smtpPort) ? smtpPort : DEFAULT_SMTP_PORT,
    smtpUser,
    smtpPass,
    fromName,
    fromEmail,
  };
}

function validateSmtpConfig(config) {
  const missing = [];

  if (!config.smtpServer) {
    missing.push('SMTP_SERVER');
  }
  if (!config.smtpPort || Number.isNaN(config.smtpPort)) {
    missing.push('SMTP_PORT');
  }
  if (!config.smtpUser) {
    missing.push('SMTP_USER');
  }
  if (!config.smtpPass) {
    missing.push('SMTP_PASS');
  }
  if (!config.fromEmail) {
    missing.push('FROM_EMAIL or SMTP_USER');
  }

  return missing;
}

function createMissingConfigError(config, missing) {
  const error = new Error(`Missing SMTP env vars: ${missing.join(', ')}`);
  error.code = 'SMTP_CONFIG_MISSING';
  error.meta = {
    smtpServer: config.smtpServer,
    smtpPort: config.smtpPort,
    smtpUser: config.smtpUser || '[missing]',
    fromEmail: config.fromEmail || '[missing]',
    missing,
  };
  return error;
}

function getFromHeader(config) {
  return `${config.fromName} <${config.fromEmail}>`;
}

function isAuthError(error) {
  return error && (error.code === 'EAUTH' || error.responseCode === 535);
}

function isRetryableError(error) {
  if (!error) {
    return false;
  }

  const retryableCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'ECONNECTION']);
  return retryableCodes.has(error.code) || typeof error.responseCode === 'number' && error.responseCode >= 400;
}

function buildFailureMessage(error) {
  if (!error) {
    return 'Email delivery failed';
  }

  if (isAuthError(error)) {
    return 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS.';
  }

  if (error.code === 'EENVELOPE') {
    return 'SMTP rejected envelope/recipient details.';
  }

  return String(error.message || error.toString() || 'Email delivery failed');
}

function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.smtpServer,
    port: config.smtpPort,
    secure: false,
    requireTLS: true,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });
}

async function sendEmail({ toEmail, subject, htmlContent, textContent = '', retries = 1 }) {
  const recipient = String(toEmail || '').trim();
  const safeRetries = Number.isFinite(Number(retries)) ? Math.max(0, Number(retries)) : 1;
  const attempts = safeRetries + 1;

  console.log(`[MAILER] Triggered sendEmail to=${recipient || '[missing]'} subject=${subject || '[missing]'}`);

  if (!recipient) {
    const error = 'Recipient email is required.';
    setLastEmailError(error);
    console.error('[MAILER] Error:', error);
    return { success: false, error };
  }

  if (!subject) {
    const error = 'Email subject is required.';
    setLastEmailError(error);
    console.error('[MAILER] Error:', error);
    return { success: false, error };
  }

  if (!htmlContent && !textContent) {
    const error = 'Email content is required (htmlContent or textContent).';
    setLastEmailError(error);
    console.error('[MAILER] Error:', error);
    return { success: false, error };
  }

  const config = getSmtpConfig();
  const missing = validateSmtpConfig(config);
  if (missing.length > 0) {
    const configError = createMissingConfigError(config, missing);
    setLastEmailError(configError.message);
    console.error('[MAILER] SMTP config error:', configError.meta);
    throw configError;
  }

  console.log('[MAILER] SMTP config:', {
    smtpServer: config.smtpServer,
    smtpPort: config.smtpPort,
    smtpUser: config.smtpUser,
    from: getFromHeader(config),
  });

  const mailOptions = {
    from: getFromHeader(config),
    to: recipient,
    subject,
    text: textContent || 'Please open this message in an HTML-capable email client.',
    html: htmlContent || `<pre>${textContent}</pre>`,
  };

  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let transporter;

    try {
      console.log(`[MAILER] SMTP connection attempt ${attempt}/${attempts} to ${config.smtpServer}:${config.smtpPort}`);
      transporter = createTransporter(config);

      const info = await transporter.sendMail(mailOptions);
      const accepted = Array.isArray(info.accepted) ? info.accepted : [];

      console.log('[MAILER] SMTP send success:', {
        attempt,
        messageId: info.messageId,
        accepted,
        rejected: info.rejected,
        response: info.response,
      });

      if (accepted.length === 0) {
        throw new Error('SMTP did not accept any recipient.');
      }

      setLastEmailError('');
      return { success: true, messageId: info.messageId, accepted, response: info.response };
    } catch (error) {
      lastError = error;
      const failureMessage = buildFailureMessage(error);

      console.error('[MAILER] Send error:', {
        attempt,
        error: failureMessage,
        code: error && error.code,
        responseCode: error && error.responseCode,
      });
      if (error && error.stack) {
        console.error('[MAILER] Send error stack:', error.stack);
      }

      if (isAuthError(error)) {
        break;
      }

      if (attempt < attempts && isRetryableError(error)) {
        console.warn(`[MAILER] Retrying email send (attempt ${attempt + 1}/${attempts})...`);
      } else if (attempt < attempts) {
        break;
      }
    } finally {
      if (transporter && typeof transporter.close === 'function') {
        try {
          transporter.close();
        } catch (closeError) {
          console.warn('[MAILER] Failed to close transporter:', closeError && closeError.message);
        }
      }
    }
  }

  const finalError = buildFailureMessage(lastError);
  setLastEmailError(finalError);
  if (lastError && lastError.stack) {
    console.error('[MAILER] Final error stack:', lastError.stack);
  }
  return { success: false, error: finalError };
}

async function sendOtpEmail(toEmail, otp) {
  const safeOtp = String(otp || '').trim();

  const subject = 'Your MedTech verification code';
  const textContent = `Your MedTech verification code is: ${safeOtp}\nThis code is valid for ${OTP_EXPIRY_MINUTES} minutes.`;
  const htmlContent = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#2563eb;padding:18px 22px;color:white;font-size:22px;font-weight:700">MedTech</div>
    <div style="padding:24px;background:#ffffff;color:#111827">
      <p style="margin:0 0 14px 0;font-size:16px">Hello,</p>
      <p style="margin:0 0 18px 0;font-size:15px">Your MedTech verification code is:</p>
      <div style="margin:0 0 18px 0;padding:14px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center">
        <span style="font-size:34px;font-weight:800;letter-spacing:6px;color:#1d4ed8">${safeOtp}</span>
      </div>
      <p style="margin:0 0 8px 0;font-size:14px">This code is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
      <p style="margin:0;font-size:14px;color:#374151">If you did not request this code, you can safely ignore this email.</p>
    </div>
  </div>`;

  return sendEmail({ toEmail, subject, htmlContent, textContent, retries: 1 });
}

async function sendTestEmail(toEmail) {
  const subject = 'MedTech SMTP Test Email';
  const textContent = 'This is a MedTech test email sent via Brevo SMTP from your Render backend.';
  const htmlContent = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#0f766e;padding:18px 22px;color:white;font-size:22px;font-weight:700">MedTech</div>
    <div style="padding:24px;background:#ffffff;color:#111827">
      <h2 style="margin:0 0 12px 0">SMTP Integration Test</h2>
      <p style="margin:0 0 10px 0;font-size:15px">If you received this email, Brevo SMTP integration is working.</p>
      <p style="margin:0;font-size:14px;color:#4b5563">Check Brevo Transactional Logs for this delivery event.</p>
    </div>
  </div>`;

  return sendEmail({ toEmail, subject, htmlContent, textContent, retries: 1 });
}

function getEmailHealth() {
  const config = getSmtpConfig();
  const missing = validateSmtpConfig(config);

  return {
    provider: 'brevo_smtp',
    configured: missing.length === 0,
    from_email: getFromHeader(config),
    smtp_server: config.smtpServer,
    smtp_port: config.smtpPort,
    error: missing.length ? `Missing SMTP env vars: ${missing.join(', ')}` : null,
  };
}

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendTestEmail,
  getEmailHealth,
  getLastEmailError,
};
