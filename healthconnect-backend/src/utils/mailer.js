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
  console.log('[MAILER] Step 1: Loading SMTP configuration from environment variables');
  
  // CRITICAL: Only use SMTP_* variables, NOT EMAIL_* variables
  const smtpServer = String(process.env.SMTP_SERVER || process.env.SMTP_HOST || DEFAULT_SMTP_SERVER).trim();
  console.log(`[MAILER] Step 1a: SMTP_SERVER = ${smtpServer}`);
  
  const smtpPortRaw = String(process.env.SMTP_PORT || DEFAULT_SMTP_PORT).trim();
  const smtpPort = Number.parseInt(smtpPortRaw, 10);
  console.log(`[MAILER] Step 1b: SMTP_PORT = ${smtpPort}`);
  
  // Use ONLY SMTP_USER, NOT EMAIL_USER
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  console.log(`[MAILER] Step 1c: SMTP_USER = ${smtpUser || '[MISSING]'}`);
  
  // Use ONLY SMTP_PASS, NOT EMAIL_PASS
  const smtpPassRaw = String(process.env.SMTP_PASS || '').trim();
  const smtpPass = smtpPassRaw.replace(/\s+/g, '');
  const smtpPassLength = smtpPass.length;
  console.log(`[MAILER] Step 1d: SMTP_PASS length = ${smtpPassLength} chars (set: ${Boolean(smtpPass)})`);
  
  // Check for conflicting EMAIL_USER/EMAIL_PASS variables and ignore them
  const emailUser = String(process.env.EMAIL_USER || '').trim();
  const emailPass = String(process.env.EMAIL_PASS || '').trim();
  if (emailUser || emailPass) {
    console.warn('[MAILER] WARNING: EMAIL_USER and/or EMAIL_PASS environment variables detected but IGNORED');
    console.warn('[MAILER] Using SMTP_USER and SMTP_PASS instead (EMAIL_* vars are deprecated)');
  }
  
  const fromName = String(process.env.FROM_NAME || DEFAULT_FROM_NAME).trim() || DEFAULT_FROM_NAME;
  console.log(`[MAILER] Step 1e: FROM_NAME = ${fromName}`);
  
  const fromEmail = String(process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL || smtpUser || '').trim();
  console.log(`[MAILER] Step 1f: FROM_EMAIL = ${fromEmail}`);
  
  const brevoApiKey = String(process.env.BREVO_API_KEY || process.env.BREVO_KEY || '').trim();
  console.log(`[MAILER] Step 1g: BREVO_API_KEY configured = ${Boolean(brevoApiKey)}`);

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

function validateRequiredSmtpAuth(config) {
  console.log('[MAILER] Step 2: Validating SMTP authentication credentials');
  
  const smtpUser = String(config && config.smtpUser ? config.smtpUser : '').trim();
  const smtpPass = String(config && config.smtpPass ? config.smtpPass : '').trim();

  console.log('[MAILER] Step 2a: SMTP_USER validation:', {
    value: smtpUser || '[MISSING]',
    exists: Boolean(smtpUser),
  });
  
  console.log('[MAILER] Step 2b: SMTP_PASS validation:', {
    length: smtpPass.length,
    exists: Boolean(smtpPass),
  });

  if (!smtpUser || !smtpPass) {
    const error = new Error('Missing required SMTP auth environment variables: SMTP_USER and/or SMTP_PASS');
    error.code = 'SMTP_AUTH_MISSING';
    console.error('[MAILER] ERROR: SMTP authentication failed - missing credentials');
    throw error;
  }
  
  console.log('[MAILER] Step 2c: SMTP authentication validation PASSED');
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
  if (!error) return false;
  
  // Nodemailer EAUTH error
  if (error.code === 'EAUTH') return true;
  
  // SMTP response code 535 = authentication failure
  if (error.responseCode === 535) return true;
  
  // SMTP response code 530 = authentication required
  if (error.responseCode === 530) return true;
  
  // SMTP response code 550 = authentication/permissions
  if (error.responseCode === 550) return true;
  
  // Check error message for auth-related keywords
  const errorStr = String(error.message || error.response || '').toLowerCase();
  if (errorStr.includes('auth') || errorStr.includes('authenticate') || errorStr.includes('credential') || errorStr.includes('unauthorized')) {
    return true;
  }
  
  return false;
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

  const errorCode = error && error.code ? error.code : null;
  const responseCode = error && error.responseCode ? error.responseCode : null;
  const errorMsg = String(error.message || error.toString() || 'Unknown error');

  // Authentication errors
  if (isAuthError(error)) {
    return `SMTP authentication failed (code: ${errorCode || responseCode || 'EAUTH'}). SMTP_USER or SMTP_PASS may be incorrect.`;
  }

  // Connection errors
  if (errorCode === 'ESOCKET' || errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
    return `Cannot reach SMTP server ${errorMsg}. Check smtp-relay.brevo.com is accessible.`;
  }

  // Timeout errors
  if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET') {
    return `SMTP connection timeout: ${errorMsg}. Server may be slow or unreachable.`;
  }

  // Envelope/recipient errors
  if (errorCode === 'EENVELOPE') {
    return `SMTP rejected email envelope or recipient address: ${errorMsg}`;
  }

  // TLS errors
  if (errorCode === 'ESECURE' || errorMsg.includes('TLS')) {
    return `TLS/Security error: ${errorMsg}. Check TLS configuration.`;
  }

  // Generic message with error code
  return `${errorMsg} (${errorCode || responseCode || 'UNKNOWN'})`;
}

function createTransporter(config) {
  console.log('[MAILER] Step 3: Creating Nodemailer transporter for Brevo SMTP');
  
  console.log('[MAILER] Step 3a: Transporter configuration:');
  console.log(`[MAILER]   - host: ${config.smtpServer}`);
  console.log(`[MAILER]   - port: ${config.smtpPort}`);
  console.log(`[MAILER]   - secure: false (required for Brevo)`);
  console.log(`[MAILER]   - requireTLS: true`);
  console.log(`[MAILER]   - authMethod: LOGIN`);
  console.log(`[MAILER]   - auth.user: ${config.smtpUser}`);
  console.log(`[MAILER]   - auth.pass: [${config.smtpPass.length} chars]`);
  console.log(`[MAILER]   - TLS minVersion: TLSv1.2`);
  
  // DEBUG: Show first 20 and last 20 chars of password
  if (config.smtpPass.length > 40) {
    const passStart = config.smtpPass.substring(0, 20);
    const passEnd = config.smtpPass.substring(config.smtpPass.length - 20);
    console.log(`[MAILER] DEBUG: Auth key preview: ${passStart}...${passEnd}`);
  }
  
  const transporter = nodemailer.createTransport({
    host: config.smtpServer,
    port: config.smtpPort,
    secure: false,  // CRITICAL: Must be false for Brevo SMTP (port 587)
    requireTLS: true,  // Force TLS upgrade
    authMethod: 'LOGIN',  // Brevo requires LOGIN auth method
    auth: {
      user: config.smtpUser,  // Use SMTP_USER from environment
      pass: config.smtpPass,  // Use SMTP_PASS from environment
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    debug: true,  // Enable Nodemailer debug mode
    logger: true,  // Log all SMTP interactions
  });
  
  console.log('[MAILER] Step 3b: Nodemailer transporter created successfully');
  
  return transporter;
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
        } catch (parseError) {
          console.warn('[MAILER] Brevo API non-JSON response body parse failed:', parseError && parseError.message ? parseError.message : parseError);
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

async function sendEmail({ toEmail, subject, htmlContent, textContent = '', retries = 1, attachments = [] }) {
  const recipient = String(toEmail || '').trim();
  const safeRetries = Number.isFinite(Number(retries)) ? Math.max(0, Number(retries)) : 1;
  const attempts = safeRetries + 1;

  console.log(`\n[MAILER] ===== SEND EMAIL REQUEST =====`);
  console.log(`[MAILER] Recipient: ${recipient || '[missing]'}`);
  console.log(`[MAILER] Subject: ${subject || '[missing]'}`);
  console.log(`[MAILER] Content: html=${Boolean(htmlContent)}, text=${Boolean(textContent)}`);
  console.log(`[MAILER] Retry attempts: ${attempts}`);

  if (!recipient) {
    const error = 'Recipient email is required.';
    setLastEmailError(error);
    console.error('[MAILER] ERROR: Recipient email is required');
    return { success: false, error };
  }

  if (!subject) {
    const error = 'Email subject is required.';
    setLastEmailError(error);
    console.error('[MAILER] ERROR: Email subject is required');
    return { success: false, error };
  }

  if (!htmlContent && !textContent) {
    const error = 'Email content is required (htmlContent or textContent).';
    setLastEmailError(error);
    console.error('[MAILER] ERROR: Email content is required');
    return { success: false, error };
  }

  console.log('[MAILER] Step 0: Input validation passed');
  
  const config = getSmtpConfig();
  
  try {
    validateRequiredSmtpAuth(config);
  } catch (authError) {
    const authMessage = authError && authError.message ? authError.message : 'SMTP auth validation failed';
    setLastEmailError(authMessage);
    console.error('[MAILER] SMTP auth validation FAILED:', authMessage);
    if (authError && authError.stack) {
      console.error('[MAILER] SMTP auth validation stack:', authError.stack);
    }
    throw authError;
  }

  const missing = validateSmtpConfig(config);
  if (missing.length > 0) {
    const configError = createMissingConfigError(config, missing);
    setLastEmailError(configError.message);
    console.error('[MAILER] SMTP config INVALID - Missing:', missing);
    console.error('[MAILER] SMTP config error:', configError.meta);
    if (configError && configError.stack) {
      console.error('[MAILER] SMTP config error stack:', configError.stack);
    }

    if (hasBrevoApiKey(config)) {
      console.warn('[MAILER] SMTP config missing, falling back to Brevo API');
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

  console.log('[MAILER] SMTP configuration verified:');
  console.log(`[MAILER]   Server: ${config.smtpServer}`);
  console.log(`[MAILER]   Port: ${config.smtpPort}`);
  console.log(`[MAILER]   User: ${config.smtpUser}`);
  console.log(`[MAILER]   Pass: [${config.smtpPass.length} chars]`);
  console.log(`[MAILER]   From: ${getFromHeader(config)}`);

  const mailOptions = {
    from: getFromHeader(config),
    to: recipient,
    subject,
    text: textContent || 'Please open this message in an HTML-capable email client.',
    html: htmlContent || `<pre>${textContent}</pre>`,
    attachments: Array.isArray(attachments) ? attachments : [],
  };

  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let transporter;

    try {
      console.log(`[MAILER] Attempt ${attempt}/${attempts}: Creating SMTP transporter`);
      transporter = createTransporter(config);

      console.log(`[MAILER] Attempt ${attempt}/${attempts}: Sending email via SMTP`);
      const info = await transporter.sendMail(mailOptions);
      const accepted = Array.isArray(info.accepted) ? info.accepted : [];

      console.log('[MAILER] ✅ SMTP send SUCCESS:', {
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
      console.log(`[MAILER] ===== EMAIL SENT SUCCESSFULLY via SMTP (User: ${config.smtpUser}) =====\n`);
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

      console.error('');
      console.error(`[MAILER] ❌ Attempt ${attempt}/${attempts} FAILED`);
      console.error('[MAILER] Error details:', {
        attempt,
        error: failureMessage,
        code: error && error.code,
        responseCode: error && error.responseCode,
      });
      if (error && error.stack) {
        console.error('[MAILER] Stack trace:', error.stack);
      }

      if (isAuthError(error)) {
        console.error('[MAILER] Authentication error detected - will not retry');
        break;
      }

      if (attempt < attempts && isRetryableError(error)) {
        console.warn(`[MAILER] Retryable error detected - retrying (attempt ${attempt + 1}/${attempts})...`);
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
  
  console.error('');
  console.error('[MAILER] ❌ SMTP DELIVERY FAILED after all attempts');
  console.error('[MAILER] Final error message:', finalError);
  if (lastError && lastError.code) {
    console.error('[MAILER] Error code:', lastError.code);
  }
  if (lastError && lastError.stack) {
    console.error('[MAILER] Full stack trace:', lastError.stack);
  }

  if (hasBrevoApiKey(config)) {
    console.warn('[MAILER] Attempting Brevo API fallback as last resort...');
    const apiFallback = await sendViaBrevoApi({
      toEmail: recipient,
      subject,
      htmlContent,
      textContent,
      config,
    });

    if (apiFallback.success) {
      console.log('[MAILER] ✅ Email sent via Brevo API fallback');
      setLastEmailError('');
      return apiFallback;
    }

    const combinedError = `${finalError} | ${apiFallback.error || 'Brevo API fallback failed'}`;
    console.error('[MAILER] ❌ Brevo API fallback also failed:', combinedError);
    console.log('[MAILER] ===== EMAIL FAILED (Both SMTP and API) =====\n');
    setLastEmailError(combinedError);
    return { success: false, provider: 'brevo_smtp', error: combinedError };
  }

  console.log('[MAILER] ===== EMAIL FAILED (SMTP only, no API fallback) =====\n');
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

async function sendPrescriptionEmail(toEmail, payload = {}) {
  const patientName = String(payload.patientName || 'Patient').trim();
  const doctorName = String(payload.doctorName || 'Doctor').trim();
  const prescriptionId = String(payload.prescriptionId || '').trim();
  const formattedDate = new Date(payload.prescriptionDate || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const subject = 'Your Prescription - MedTech Clinic';
  const textContent = [
    `Hello ${patientName},`,
    '',
    'Your prescription has been generated successfully.',
    `Doctor: ${doctorName}`,
    `Date: ${formattedDate}`,
    prescriptionId ? `Prescription ID: ${prescriptionId}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const htmlContent = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#0f766e;padding:18px 22px;color:white;font-size:20px;font-weight:700">MedTech Clinic</div>
      <div style="padding:24px;background:#ffffff;color:#111827">
        <p style="margin:0 0 12px 0">Hello ${patientName},</p>
        <p style="margin:0 0 12px 0">Your prescription has been generated successfully.</p>
        <p style="margin:0 0 6px 0"><strong>Doctor:</strong> ${doctorName}</p>
        <p style="margin:0 0 6px 0"><strong>Date:</strong> ${formattedDate}</p>
        ${prescriptionId ? `<p style="margin:0 0 6px 0"><strong>Prescription ID:</strong> ${prescriptionId}</p>` : ''}
        <p style="margin:14px 0 0 0;color:#4b5563;font-size:14px">The prescription PDF is attached to this email.</p>
      </div>
    </div>
  `;

  const attachments = [];
  if (payload.pdfBuffer) {
    attachments.push({
      filename: `prescription_${prescriptionId || Date.now()}.pdf`,
      content: payload.pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  return sendEmail({
    toEmail,
    subject,
    htmlContent,
    textContent,
    retries: 1,
    attachments,
  });
}

// =============== SMTP CONNECTION VERIFICATION ===============
async function verifySmtpConnection() {
  console.log('\n[MAILER-VERIFY] ===== SMTP CONNECTION VERIFICATION =====');
  const config = getSmtpConfig();

  // Step 1: Validate config
  console.log('[MAILER-VERIFY] Step 1: Validating SMTP configuration');
  const missing = validateSmtpConfig(config);
  if (missing.length > 0) {
    const error = `Configuration invalid - Missing: ${missing.join(', ')}`;
    console.error('[MAILER-VERIFY] ❌ CONFIG INVALID:', error);
    return { success: false, error, verified: false, step: 'config_validation' };
  }
  console.log('[MAILER-VERIFY] ✅ Step 1 PASSED: Configuration is valid');

  // Step 2: Create transporter
  console.log('[MAILER-VERIFY] Step 2: Creating Nodemailer transporter');
  let transporter;
  try {
    transporter = createTransporter(config);
    console.log('[MAILER-VERIFY] ✅ Step 2 PASSED: Transporter created');
  } catch (error) {
    const err = `Failed to create transporter: ${error && error.message ? error.message : String(error)}`;
    console.error('[MAILER-VERIFY] ❌ Transporter creation failed:', err);
    return { success: false, error: err, verified: false, step: 'transporter_creation' };
  }

  // Step 3: Verify SMTP connection
  console.log('[MAILER-VERIFY] Step 3: Verifying SMTP connection with transporter.verify()');
  try {
    const verified = await transporter.verify();
    if (verified) {
      console.log('[MAILER-VERIFY] ✅ Step 3 PASSED: SMTP connection verified - ready to send emails');
      console.log('[MAILER-VERIFY] ===== VERIFICATION SUCCESSFUL =====\n');
      transporter.close();
      return {
        success: true,
        verified: true,
        step: 'smtp_verification',
        smtp_user: config.smtpUser,
        smtp_server: config.smtpServer,
        smtp_port: config.smtpPort,
        message: 'SMTP connection is working correctly',
      };
    } else {
      const error = 'transporter.verify() returned false (unknown reason)';
      console.error('[MAILER-VERIFY] ❌ Step 3 FAILED:', error);
      transporter.close();
      return { success: false, verified: false, error, step: 'smtp_verification' };
    }
  } catch (error) {
    const errorMsg = error && error.message ? error.message : String(error);
    const errorCode = error && error.code ? error.code : 'UNKNOWN';
    
    console.error('[MAILER-VERIFY] ❌ Step 3 FAILED: SMTP connection error');
    console.error('[MAILER-VERIFY] Error details:', {
      message: errorMsg,
      code: errorCode,
      responseCode: error && error.responseCode ? error.responseCode : null,
    });

    if (error && error.stack) {
      console.error('[MAILER-VERIFY] Full stack trace:');
      console.error(error.stack);
    }

    transporter.close();

    // Specific error handling
    let helpMessage = '';
    if (errorCode === 'EAUTH' || error.responseCode === 535) {
      helpMessage = 'SMTP_USER or SMTP_PASS is incorrect. Check your Brevo SMTP credentials in .env';
    } else if (errorCode === 'ESOCKET' || errorCode === 'ECONNREFUSED') {
      helpMessage = 'Cannot connect to SMTP host. Check if smtp-relay.brevo.com is accessible.';
    } else if (errorCode === 'ETIMEDOUT') {
      helpMessage = 'SMTP server connection timed out. Try again or check network connectivity.';
    }

    return {
      success: false,
      verified: false,
      error: errorMsg,
      code: errorCode,
      help: helpMessage,
      step: 'smtp_verification',
    };
  }
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
  sendPrescriptionEmail,
  getEmailHealth,
  getLastEmailError,
  verifySmtpConnection,
};
