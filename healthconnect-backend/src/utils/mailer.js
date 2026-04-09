const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const https = require('https');
const nodemailer = require('nodemailer');
const {
  generateOtpEmail,
  generateResetEmail,
} = require('./emailTemplates');

const DEFAULT_SMTP_SERVER = 'smtp-relay.brevo.com';
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_FROM_NAME = 'MedTech';
const DEFAULT_FROM_EMAIL = 'pawasthi063@gmail.com';

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
  const smtpPassRaw = String(process.env.SMTP_PASS || '').trim();
  const smtpPass = smtpPassRaw.replace(/\s+/g, '');
  const fromName = String(process.env.FROM_NAME || DEFAULT_FROM_NAME).trim() || DEFAULT_FROM_NAME;
  const fromEmail = String(process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL || smtpUser || '').trim();
  const brevoApiKey = String(process.env.BREVO_API_KEY || process.env.BREVO_KEY || '').trim();

  return {
    smtpServer,
    smtpPort: Number.isFinite(smtpPort) ? smtpPort : DEFAULT_SMTP_PORT,
    smtpUser,
    smtpPass,
    smtpPassRaw,
    fromName,
    fromEmail,
    brevoApiKey,
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

function hasBrevoApiKey(config) {
  return Boolean(config && config.brevoApiKey);
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
    authMethod: 'LOGIN',
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

function sendViaBrevoApi({ toEmail, subject, htmlContent, textContent, config }) {
  return new Promise((resolve) => {
    if (!hasBrevoApiKey(config)) {
      return resolve({
        success: false,
        provider: 'brevo_api',
        error: 'BREVO_API_KEY not configured',
      });
    }

    const payload = JSON.stringify({
      sender: {
        name: config.fromName,
        email: config.fromEmail,
      },
      to: [{ email: toEmail }],
      subject,
      htmlContent,
      textContent,
    });

    const requestOptions = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'api-key': config.brevoApiKey,
      },
      timeout: 30000,
    };

    console.log('[MAILER] Brevo API fallback attempt');

    const req = https.request(requestOptions, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        let parsed = null;
        try {
          parsed = responseBody ? JSON.parse(responseBody) : null;
        } catch (_e) {
          parsed = null;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          const messageId = parsed && (parsed.messageId || parsed.message_id);
          console.log('[MAILER] Brevo API send success:', {
            statusCode: res.statusCode,
            messageId: messageId || '[not provided]',
          });
          return resolve({
            success: true,
            provider: 'brevo_api',
            messageId: messageId || null,
            response: parsed || responseBody,
          });
        }

        const errorMessage = `Brevo API failed (${res.statusCode}): ${parsed && parsed.message ? parsed.message : responseBody}`;
        console.error('[MAILER] Brevo API error:', errorMessage);
        return resolve({
          success: false,
          provider: 'brevo_api',
          error: errorMessage,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Brevo API request timed out'));
    });

    req.on('error', (error) => {
      const errorMessage = `Brevo API request error: ${error.message || String(error)}`;
      console.error('[MAILER] Brevo API request error:', errorMessage);
      resolve({
        success: false,
        provider: 'brevo_api',
        error: errorMessage,
      });
    });

    req.write(payload);
    req.end();
    return undefined;
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

    if (hasBrevoApiKey(config)) {
      const apiFallback = await sendViaBrevoApi({
        toEmail: recipient,
        subject,
        htmlContent,
        textContent,
        config,
      });
      if (apiFallback.success) {
        setLastEmailError('');
      } else {
        setLastEmailError(apiFallback.error || configError.message);
      }
      return apiFallback;
    }

    throw configError;
  }

  console.log('[MAILER] SMTP config:', {
    smtpServer: config.smtpServer,
    smtpPort: config.smtpPort,
    smtpUser: config.smtpUser,
    smtpPassSanitized: config.smtpPassRaw !== config.smtpPass,
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
      return {
        success: true,
        provider: 'brevo_smtp',
        messageId: info.messageId,
        accepted,
        response: info.response,
      };
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

  if (hasBrevoApiKey(config)) {
    console.warn('[MAILER] SMTP failed, trying Brevo API fallback...');
    const apiFallback = await sendViaBrevoApi({
      toEmail: recipient,
      subject,
      htmlContent,
      textContent,
      config,
    });

    if (apiFallback.success) {
      setLastEmailError('');
      return apiFallback;
    }

    const combinedError = `${finalError} | ${apiFallback.error || 'Brevo API fallback failed'}`;
    setLastEmailError(combinedError);
    return { success: false, provider: 'brevo_smtp', error: combinedError };
  }

  return { success: false, provider: 'brevo_smtp', error: finalError };
}

async function sendOtpEmail(toEmail, otp) {
  const template = generateOtpEmail(otp);

  return sendEmail({
    toEmail,
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    retries: 1,
  });
}

async function sendPasswordResetEmail(toEmail, resetLink) {
  const template = generateResetEmail(resetLink);

  return sendEmail({
    toEmail,
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    retries: 1,
  });
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
    brevo_api_configured: hasBrevoApiKey(config),
    smtp_pass_sanitized: config.smtpPassRaw !== config.smtpPass,
    error: missing.length ? `Missing SMTP env vars: ${missing.join(', ')}` : null,
  };
}

module.exports = {
  sendEmail,
  generateOtpEmail,
  generateResetEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendTestEmail,
  getEmailHealth,
  getLastEmailError,
};
