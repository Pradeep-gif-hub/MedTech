const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const emailRoutes = require('./src/routes/email');

const app = express();
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

app.use('/', emailRoutes);
app.use('/api', emailRoutes);

async function startServer() {
  return app.listen(PORT, () => {
    console.log(`[SERVER] Node email service listening on port ${PORT}`);
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
