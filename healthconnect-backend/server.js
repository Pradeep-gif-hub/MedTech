const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const emailRoutes = require('./src/routes/email');
const prescriptionsRouter = require('./src/routes/prescriptions');
const adminRoutes = require('./routes/admin');

const app = express();

// CORS Configuration - MUST be before routes
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://medtech-4rjc.onrender.com',
    'https://medtech-hcmo.onrender.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

console.log('[SERVER] Configuring CORS with options:', corsOptions);
app.use(cors(corsOptions));

// Handle OPTIONS requests manually as fallback
app.options('*', cors(corsOptions));

app.use(express.json());

const PORT = Number.parseInt(process.env.PORT || '8000', 10);

const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
const SMTP_SERVER = String(process.env.SMTP_SERVER || process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();
const SMTP_PORT = String(process.env.SMTP_PORT || '587').trim();

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Node email backend is running',
  });
});

// Health check endpoint with CORS info
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Backend health check',
    cors_enabled: true,
    timestamp: new Date().toISOString(),
  });
});

app.use('/', emailRoutes);
app.use('/api', emailRoutes);
app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/v1/admin', adminRoutes);

const transporter = require('nodemailer').createTransport({
  host: SMTP_SERVER,
  port: Number.parseInt(SMTP_PORT, 10),
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

app.set('mailTransporter', transporter);
app.set('mailFromName', String(process.env.FROM_NAME || 'MedTech'));
app.set('mailFromEmail', String(process.env.FROM_EMAIL || 'noreply@medtech.com'));
app.set('frontendUrl', String(process.env.FRONTEND_URL || 'https://medtech-4rjc.onrender.com'));

async function startServer() {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[SERVER][SOCKET] connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[SERVER][SOCKET] disconnected: ${socket.id}`);
    });
  });

  app.set('io', io);

  return server.listen(PORT, () => {
    console.log(`[SERVER] Node email backend listening on port ${PORT}`);
    console.log(`[SERVER] CORS enabled for: ${corsOptions.origin.join(', ')}`);
    console.log('[SERVER] SMTP_SERVER:', SMTP_SERVER || '[missing]');
    console.log('[SERVER] SMTP_PORT:', SMTP_PORT || '[missing]');
    console.log('[SERVER] SMTP_USER:', SMTP_USER || '[missing]');
    console.log('[SERVER] SMTP_PASS configured:', Boolean(SMTP_PASS));
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
};
