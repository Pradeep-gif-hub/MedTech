const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { getAsync, allAsync, runAsync } = require('../../database');

const router = express.Router();

const ADMIN_EMAIL = 'pradeep240818@gmail.com';
const ALLOWED_USER_ROLES = new Set(['doctor', 'patient', 'pharmacy']);
const ALLOWED_USER_STATUS = new Set(['active', 'pending', 'suspended']);
const ALLOWED_ALERT_TYPES = new Set(['info', 'warning', 'critical']);

function sanitizeText(value, maxLength = 255) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function getJwtSecret() {
  return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
}

function generateAdminToken(admin) {
  return jwt.sign(
    {
      adminId: admin.id,
      role: 'admin',
      email: admin.email,
      type: 'admin',
      iat: Math.floor(Date.now() / 1000),
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  if (!headerValue.startsWith('Bearer ')) {
    return null;
  }

  return headerValue.slice(7).trim();
}

async function createAlert(req, message, type = 'info') {
  const normalizedType = ALLOWED_ALERT_TYPES.has(type) ? type : 'info';
  const normalizedMessage = sanitizeText(message, 500);

  const result = await runAsync(
    'INSERT INTO alerts (message, type, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [normalizedMessage, normalizedType]
  );

  const alert = await getAsync('SELECT id, message, type, created_at FROM alerts WHERE id = ?', [result.lastID]);

  const io = req.app.get('io');
  if (io && alert) {
    io.emit('system_alert', alert);
  }

  return alert;
}

async function adminAuth(req, res, next) {
  const token = parseBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing admin authorization token',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (_err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired admin token',
    });
  }

  if (decoded.role !== 'admin' || decoded.type !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  const admin = await getAsync('SELECT id, name, email, created_at FROM admins WHERE id = ?', [decoded.adminId]);
  if (!admin) {
    return res.status(401).json({
      success: false,
      error: 'Admin not found',
    });
  }

  req.admin = admin;
  next();
}

function formatUser(row) {
  const profilePic = row.profile_pic || row.picture || row.avatar || null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    location: row.location || '',
    status: row.status || 'active',
    created_at: row.created_at,
    profile_pic: profilePic,
    picture: profilePic,
  };
}

router.post('/login', async (req, res) => {
  try {
    const email = sanitizeText(req.body?.email, 255).toLowerCase();
    const password = String(req.body?.password ?? '').slice(0, 128);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    const admin = await getAsync('SELECT * FROM admins WHERE email = ?', [email]);
    if (!admin || email !== ADMIN_EMAIL) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin credentials',
      });
    }

    const matches = await bcrypt.compare(password, admin.password);
    if (!matches) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin credentials',
      });
    }

    const token = generateAdminToken(admin);

    return res.json({
      success: true,
      token,
      role: 'admin',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error('[ADMIN] login failed:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Admin login failed',
    });
  }
});

router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      activeDoctors,
      dailyConsultations,
      recentRegistrations,
      recentAlerts,
    ] = await Promise.all([
      getAsync('SELECT COUNT(*) AS count FROM users'),
      getAsync("SELECT COUNT(*) AS count FROM users WHERE role = 'doctor' AND status = 'active'"),
      getAsync("SELECT COUNT(*) AS count FROM consultations WHERE DATE(created_at) = DATE('now', 'localtime')"),
      allAsync("SELECT id, name, email, role, location, status, created_at, profile_pic, picture, avatar FROM users WHERE created_at >= datetime('now', '-7 days') ORDER BY datetime(created_at) DESC"),
      allAsync('SELECT id, message, type, created_at FROM alerts ORDER BY datetime(created_at) DESC LIMIT 10'),
    ]);

    const totalUsersValue = Number(totalUsers?.count || 0);
    const activeDoctorsValue = Number(activeDoctors?.count || 0);
    const dailyConsultationsValue = Number(dailyConsultations?.count || 0);
    const uptimeValue = Math.round(process.uptime());

    console.log(`[ADMIN] Dashboard: Total users = ${totalUsersValue}, Active doctors = ${activeDoctorsValue}, Recent registrations (7d) = ${recentRegistrations.length}`);

    return res.json({
      success: true,
      totalUsers: totalUsersValue,
      activeDoctors: activeDoctorsValue,
      dailyConsultations: dailyConsultationsValue,
      uptime: uptimeValue,
      cards: {
        totalUsers: totalUsersValue,
        activeDoctors: activeDoctorsValue,
        dailyConsultations: dailyConsultationsValue,
        systemUptime: uptimeValue,
      },
      recentRegistrations: recentRegistrations.map(formatUser),
      alerts: recentAlerts,
    });
  } catch (error) {
    console.error('[ADMIN] dashboard failed:', error.message);
    await createAlert(req, `Admin dashboard error: ${error.message}`, 'critical');
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    });
  }
});

router.get('/users', adminAuth, async (req, res) => {
  try {
    const roleFilter = sanitizeText(req.query.role, 30).toLowerCase();
    const where = [];
    const params = [];

    if (ALLOWED_USER_ROLES.has(roleFilter)) {
      where.push('role = ?');
      params.push(roleFilter);
    }

    const query = `
      SELECT id, name, email, role, location, status, created_at, profile_pic, picture, avatar
      FROM users
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY datetime(created_at) DESC
    `;

    const users = await allAsync(query, params);

    console.log(`[ADMIN] Fetched users: count=${users.length}${roleFilter ? `, role=${roleFilter}` : ''}`);

    return res.json({
      success: true,
      users: users.map(formatUser),
      data: users.map(formatUser),
      total: users.length,
    });
  } catch (error) {
    console.error('[ADMIN] get users failed:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
});

router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    const user = await getAsync(
      'SELECT id, name, email, role, location, status, created_at, phone, age, gender, bloodgroup, allergy, dob, profile_pic, picture, avatar FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, user: formatUser(user), details: user });
  } catch (error) {
    console.error('[ADMIN] get user by id failed:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    const updates = [];
    const params = [];

    const name = req.body?.name !== undefined ? sanitizeText(req.body.name, 120) : undefined;
    const location = req.body?.location !== undefined ? sanitizeText(req.body.location, 120) : undefined;
    const role = req.body?.role !== undefined ? sanitizeText(req.body.role, 30).toLowerCase() : undefined;
    const email = req.body?.email !== undefined ? sanitizeText(req.body.email, 255).toLowerCase() : undefined;

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (role !== undefined) {
      if (!ALLOWED_USER_ROLES.has(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role value' });
      }
      updates.push('role = ?');
      params.push(role);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    await runAsync(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await getAsync('SELECT id, name, email, role, location, status, created_at, profile_pic, picture, avatar FROM users WHERE id = ?', [userId]);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, user: formatUser(updated) });
  } catch (error) {
    console.error('[ADMIN] update user failed:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

router.patch('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    const status = sanitizeText(req.body?.status, 30).toLowerCase();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    if (!ALLOWED_USER_STATUS.has(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    await runAsync('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, userId]);

    const user = await getAsync('SELECT id, name, email, role, location, status, created_at, profile_pic, picture, avatar FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const eventPayload = formatUser(user);
    const io = req.app.get('io');
    if (io) {
      io.emit('user_status_changed', eventPayload);
    }

    await createAlert(req, `User status changed: ${user.name} -> ${status}`, status === 'suspended' ? 'warning' : 'info');

    return res.json({ success: true, user: eventPayload });
  } catch (error) {
    console.error('[ADMIN] update user status failed:', error.message);
    await createAlert(req, `Status update error: ${error.message}`, 'critical');
    return res.status(500).json({ success: false, error: 'Failed to update user status' });
  }
});

router.post('/invite', adminAuth, async (req, res) => {
  try {
    const email = sanitizeText(req.body?.email, 255).toLowerCase();
    const role = sanitizeText(req.body?.role, 30).toLowerCase();

    if (!email || !ALLOWED_USER_ROLES.has(role)) {
      return res.status(400).json({ success: false, error: 'Valid email and role are required' });
    }

    const transport = req.app.get('mailTransporter');
    const fromName = req.app.get('mailFromName') || 'MedTech';
    const fromEmail = req.app.get('mailFromEmail') || 'noreply@medtech.com';
    const frontendUrl = req.app.get('frontendUrl') || 'https://medtech-4rjc.onrender.com';

    if (!transport) {
      return res.status(500).json({ success: false, error: 'Email transporter unavailable' });
    }

    const inviteLink = `${frontendUrl}/login?role=${encodeURIComponent(role)}&email=${encodeURIComponent(email)}`;
    await transport.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: 'MedTech account invitation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>MedTech Invitation</h2>
          <p>You have been invited as a <strong>${role}</strong> user.</p>
          <p>Click below to continue:</p>
          <p><a href="${inviteLink}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">Accept Invite</a></p>
          <p style="font-size:12px;color:#666;">If you did not expect this email, you can ignore it.</p>
        </div>
      `,
      text: `You have been invited as a ${role} user. Continue here: ${inviteLink}`,
    });

    await createAlert(req, `User invitation sent: ${email} (${role})`, 'info');

    return res.json({ success: true, message: 'Invite email sent', inviteLink });
  } catch (error) {
    console.error('[ADMIN] invite failed:', error.message);
    await createAlert(req, `Invite email error: ${error.message}`, 'critical');
    return res.status(500).json({ success: false, error: 'Failed to send invite' });
  }
});

router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const [
      totalConsultations,
      totalRevenue,
      patientSatisfaction,
      consultationTrends,
      topSpecializations,
    ] = await Promise.all([
      getAsync('SELECT COUNT(*) AS count FROM consultations'),
      getAsync('SELECT COALESCE(SUM(fee), 0) AS total FROM consultations'),
      getAsync('SELECT COALESCE(AVG(rating), 0) AS avgRating FROM reviews'),
      allAsync('SELECT type, COUNT(*) AS count FROM consultations GROUP BY type'),
      allAsync('SELECT specialization, COUNT(*) AS count FROM consultations WHERE specialization IS NOT NULL AND TRIM(specialization) != "" GROUP BY specialization ORDER BY count DESC LIMIT 10'),
    ]);

    const totalConsultationsValue = Number(totalConsultations?.count || 0);
    const revenueValue = Number(totalRevenue?.total || 0);
    const patientSatisfactionValue = Number(patientSatisfaction?.avgRating || 0);

    return res.json({
      success: true,
      totalConsultations: totalConsultationsValue,
      revenue: revenueValue,
      satisfaction: patientSatisfactionValue,
      analytics: {
        totalConsultations: totalConsultationsValue,
        revenue: revenueValue,
        patientSatisfaction: patientSatisfactionValue,
        consultationTrends,
        topSpecializations,
      },
    });
  } catch (error) {
    console.error('[ADMIN] analytics failed:', error.message);
    await createAlert(req, `Analytics query error: ${error.message}`, 'critical');
    return res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

router.get('/alerts', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 100);
    const alerts = await allAsync('SELECT id, message, type, created_at FROM alerts ORDER BY datetime(created_at) DESC LIMIT ?', [limit]);

    return res.json({ success: true, alerts });
  } catch (error) {
    console.error('[ADMIN] alerts failed:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

module.exports = router;
module.exports.createAlert = createAlert;
