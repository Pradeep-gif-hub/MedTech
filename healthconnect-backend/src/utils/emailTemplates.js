const OTP_SUBJECT = 'Your MedTech verification code';
const RESET_SUBJECT = 'Reset your MedTech password';
const OTP_EXPIRY_MINUTES = 5;
const RESET_EXPIRY_MINUTES = 15;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateOtpEmail(otp) {
  const rawOtp = String(otp || '').trim();
  const safeOtp = escapeHtml(rawOtp || '------');

  const html = `
  <div style="margin:0;padding:24px 12px;background-color:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;border-collapse:collapse;background-color:#ffffff;border:1px solid #d1d5db;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px 8px 24px;font-family:Arial,sans-serif;color:#111827;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#4b5563;">MedTech</p>
                <h1 style="margin:10px 0 0 0;font-size:24px;line-height:1.25;font-weight:700;color:#111827;">Verify your account</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;font-family:Arial,sans-serif;color:#374151;font-size:15px;line-height:1.6;">
                Use the verification code below to complete your sign in.
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#eef6ff;border:1px solid #bfdbfe;border-radius:8px;">
                  <tr>
                    <td align="center" style="padding:16px 12px;font-family:Arial,sans-serif;color:#1d4ed8;font-size:34px;font-weight:700;letter-spacing:6px;line-height:1;">
                      ${safeOtp}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 0 24px;font-family:Arial,sans-serif;color:#374151;font-size:14px;line-height:1.6;">
                This code expires in ${OTP_EXPIRY_MINUTES} minutes.
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px 24px;font-family:Arial,sans-serif;color:#4b5563;font-size:13px;line-height:1.6;">
                Do not share this code with anyone. If you did not request it, you can ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;

  const text = [
    'MedTech',
    '',
    'Verify your account',
    `Your verification code: ${rawOtp || '------'}`,
    `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    'Do not share this code with anyone.',
    'If you did not request this code, you can ignore this email.',
  ].join('\n');

  return {
    subject: OTP_SUBJECT,
    html,
    text,
  };
}

function generateResetEmail(resetLink) {
  const rawLink = String(resetLink || '').trim();
  const safeLink = escapeHtml(rawLink);

  const html = `
  <div style="margin:0;padding:24px 12px;background-color:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;border-collapse:collapse;background-color:#ffffff;border:1px solid #d1d5db;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px 8px 24px;font-family:Arial,sans-serif;color:#111827;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#4b5563;">MedTech</p>
                <h1 style="margin:10px 0 0 0;font-size:24px;line-height:1.25;font-weight:700;color:#111827;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;font-family:Arial,sans-serif;color:#374151;font-size:15px;line-height:1.6;">
                We received a request to reset your MedTech account password.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 24px 0 24px;">
                <a href="${safeLink}" style="display:inline-block;padding:12px 22px;background-color:#0f766e;border-radius:8px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;">Reset Password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 0 24px;font-family:Arial,sans-serif;color:#374151;font-size:14px;line-height:1.6;">
                This link expires in ${RESET_EXPIRY_MINUTES} minutes.
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;font-family:Arial,sans-serif;color:#6b7280;font-size:13px;line-height:1.6;">
                If the button does not work, copy and paste this link into your browser:
              </td>
            </tr>
            <tr>
              <td style="padding:6px 24px 0 24px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;word-break:break-all;">
                <a href="${safeLink}" style="color:#2563eb;text-decoration:underline;">${safeLink || 'Reset link unavailable'}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 24px 24px;font-family:Arial,sans-serif;color:#4b5563;font-size:13px;line-height:1.6;">
                If you did not request a password reset, no action is required. For your security, consider updating your password if you suspect unauthorized access.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;

  const text = [
    'MedTech',
    '',
    'Reset your MedTech password',
    'We received a request to reset your MedTech account password.',
    '',
    `Reset link: ${rawLink || 'Reset link unavailable'}`,
    `This link expires in ${RESET_EXPIRY_MINUTES} minutes.`,
    '',
    'If you did not request a password reset, no action is required.',
    'For your security, consider updating your password if you suspect unauthorized access.',
  ].join('\n');

  return {
    subject: RESET_SUBJECT,
    html,
    text,
  };
}

module.exports = {
  generateOtpEmail,
  generateResetEmail,
};
