const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const emailRoutes = require('./src/routes/email');
const prescriptionsRouter = require('./src/routes/prescriptions');

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

async function startServer() {
  return app.listen(PORT, () => {
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
