const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const emailRoutes = require('./src/routes/email');

const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Server is running');
});

app.use('/', emailRoutes);
app.use('/api', emailRoutes);

const PORT = Number.parseInt(process.env.PORT || '8000', 10);

function collectRoutes(application) {
  const routes = [];

  function walk(stack, prefix = '') {
    for (const layer of stack || []) {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods || {})
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase())
          .join(',');
        routes.push(`${methods} ${prefix}${layer.route.path}`);
        continue;
      }

      if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        let mount = '';
        if (layer.regexp && layer.regexp.source && layer.regexp.source !== '^\\/?$') {
          mount = layer.regexp.source
            .replace('^\\', '')
            .replace('\\/?(?=\\/|$)', '')
            .replace('(?=\\/|$)', '')
            .replace('\\/', '/')
            .replace(/\$$/, '');
          if (mount === '?' || mount === '/?' || mount === '\\/?') {
            mount = '';
          }
          mount = mount.replace(/^\//, '/');
        }
        walk(layer.handle.stack, `${prefix}${mount}`);
      }
    }
  }

  walk(application._router && application._router.stack ? application._router.stack : []);
  return routes;
}

function logRegisteredRoutes(application) {
  const routes = collectRoutes(application);
  console.log('[SERVER] Registered routes:');
  if (!routes.length) {
    console.log('[SERVER] (none found)');
    return;
  }
  routes.forEach((r) => console.log(`[SERVER] ${r}`));
}

function startServer() {
  return app.listen(PORT, () => {
    console.log(`[SERVER] Node mail service listening on port ${PORT}`);
    console.log('[SERVER] SMTP_SERVER:', process.env.SMTP_SERVER || process.env.SMTP_HOST || 'smtp-relay.brevo.com');
    console.log('[SERVER] SMTP_PORT:', process.env.SMTP_PORT || '587');
    console.log('[SERVER] SMTP_USER:', process.env.SMTP_USER || '[missing]');
    console.log('[SERVER] SMTP_PASS loaded:', Boolean(process.env.SMTP_PASS));
    logRegisteredRoutes(app);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, collectRoutes };
