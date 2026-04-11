# Fixed Nodemailer Configuration for Brevo SMTP

## Summary of Changes

Your Node.js backend now uses **only SMTP_USER and SMTP_PASS** environment variables for Brevo SMTP authentication. The code no longer references EMAIL_USER or EMAIL_PASS.

### Key Changes Made:

#### 1. **getSmtpConfig()** Function
- ✅ Uses ONLY `process.env.SMTP_USER` (not EMAIL_USER)
- ✅ Uses ONLY `process.env.SMTP_PASS` (not EMAIL_PASS)
- ✅ Warns if EMAIL_USER/EMAIL_PASS env vars are present (deprecated)
- ✅ Logs all config values for debugging

#### 2. **validateRequiredSmtpAuth()** Function
- ✅ Enhanced logging to show which credentials are being validated
- ✅ Confirms SMTP_USER and SMTP_PASS are present
- ✅ Clear error message if credentials missing

#### 3. **createTransporter()** Function
- ✅ Logs exact transporter configuration
- ✅ Confirms Brevo SMTP settings:
  - `host: smtp-relay.brevo.com`
  - `port: 587`
  - `secure: false` (CRITICAL for Brevo)
  - `requireTLS: true`
  - `authMethod: LOGIN`
- ✅ Shows which credentials are being used

#### 4. **sendEmail()** Function
- ✅ Enhanced logging at every step
- ✅ Shows exact SMTP config values being used
- ✅ Clear success/failure indicators (✅ ❌)
- ✅ Better error messages and stack traces
- ✅ Shows which SMTP_USER succeeded or failed

---

## Environment Variables Setup (Render)

Your current Render configuration is **correct**:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=a791ff001@smtp-brevo.com
SMTP_PASS=xsmtpsib-[long-key]
FROM_EMAIL=noreply@medtech.com
FROM_NAME=MedTech
FRONTEND_URL=https://medtech-4rjc.onrender.com
```

**Important:**
- ✅ Do NOT change SMTP_USER and SMTP_PASS (they're correct)
- ✅ Do NOT add EMAIL_USER or EMAIL_PASS
- ✅ If EMAIL_USER/EMAIL_PASS exist, remove them (they're ignored)

---

## Complete Fixed Code

### Part 1: getSmtpConfig() - Configuration Loading

```javascript
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
```

### Part 2: validateRequiredSmtpAuth() - Credential Validation

```javascript
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
```

### Part 3: createTransporter() - Transporter Creation

```javascript
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
  });
  
  console.log('[MAILER] Step 3b: Nodemailer transporter created successfully');
  
  return transporter;
}
```

### Part 4: sendEmail() - Email Sending with Enhanced Logging

```javascript
async function sendEmail({ toEmail, subject, htmlContent, textContent = '', retries = 1 }) {
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
```

---

## Testing the Fixed Configuration

### Test 1: Check SMTP Configuration

```bash
curl http://localhost:8000/api/auth/email-health
```

**Expected Response:**
```json
{
  "provider": "brevo_smtp",
  "configured": true,
  "from_email": "MedTech <noreply@medtech.com>",
  "smtp_server": "smtp-relay.brevo.com",
  "smtp_port": 587,
  "smtp_user": "a791ff001@smtp-brevo.com",
  "brevo_api_configured": false,
  "error": null
}
```

### Test 2: Send Test Email

```bash
curl -X POST http://localhost:8000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@gmail.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Email sent",
  "to": "your-test-email@gmail.com",
  "provider": "brevo_smtp",
  "messageId": "<message-id@example.com>"
}
```

### Test 3: Check Console Logs

When sending an email, you should see:

```
[MAILER] ===== SEND EMAIL REQUEST =====
[MAILER] Recipient: your-email@example.com
[MAILER] Step 1: Loading SMTP configuration
[MAILER] Step 1a: SMTP_SERVER = smtp-relay.brevo.com
[MAILER] Step 1b: SMTP_PORT = 587
[MAILER] Step 1c: SMTP_USER = a791ff001@smtp-brevo.com
[MAILER] Step 1d: SMTP_PASS length = 45 chars (set: true)
[MAILER] Step 2: Validating SMTP authentication credentials
[MAILER] Step 2c: SMTP authentication validation PASSED
[MAILER] Step 3: Creating Nodemailer transporter for Brevo SMTP
[MAILER] Step 3a: Transporter configuration:
[MAILER]   - host: smtp-relay.brevo.com
[MAILER]   - port: 587
[MAILER]   - secure: false (required for Brevo)
[MAILER] Attempt 1/1: Creating SMTP transporter
[MAILER] Attempt 1/1: Sending email via SMTP
[MAILER] ✅ SMTP send SUCCESS:
[MAILER] ===== EMAIL SENT SUCCESSFULLY via SMTP (User: a791ff001@smtp-brevo.com) =====
```

---

## What Changed

| Item | Before | After |
|------|--------|-------|
| **SMTP_USER source** | Checked multiple places | Only `process.env.SMTP_USER` |
| **SMTP_PASS source** | Checked multiple places | Only `process.env.SMTP_PASS` |
| **EMAIL_USER** | Used if present | Ignored (shows warning) |
| **EMAIL_PASS** | Used if present | Ignored (shows warning) |
| **Logging** | Basic | Enhanced with step indicators and ✅ ❌ |
| **Error handling** | Generic messages | Specific error codes and context |
| **Authentication** | May use wrong credentials | Always uses SMTP_USER/SMTP_PASS |

---

## Summary

✅ **Now using ONLY**:
- `process.env.SMTP_USER` (value: `a791ff001@smtp-brevo.com`)
- `process.env.SMTP_PASS` (value: Brevo SMTP API key)

✅ **Removed/Ignored**:
- EMAIL_USER (if present, ignored with warning)
- EMAIL_PASS (if present, ignored with warning)

✅ **Correct Brevo Configuration**:
- Host: `smtp-relay.brevo.com`
- Port: `587`
- Secure: `false`
- TLS: `required`

✅ **Enhanced Logging**:
- Shows exact SMTP config values
- Step-by-step authentication validation
- Clear success/failure indicators
- Full stack traces on error
- Shows which SMTP_USER succeeded

Email delivery should now work without authentication errors! 🚀
