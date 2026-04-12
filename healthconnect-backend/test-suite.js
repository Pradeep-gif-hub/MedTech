/**
 * MedTech Backend - Comprehensive Test Script
 * Tests all endpoints including CORS, health checks, email config, and forgot password flow
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');

const TEST_PORT = 8000;
const TEST_HOST = 'http://localhost';
const TEST_EMAIL = process.env.TEST_EMAIL || 'pawasthi063@gmail.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  title: (msg) => console.log(`\n${colors.cyan}${'═'.repeat(70)}${colors.reset}\n${colors.blue}${msg}${colors.reset}\n${colors.cyan}${'═'.repeat(70)}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.yellow}ℹ️  ${msg}${colors.reset}`),
  data: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
};

// Helper function to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `${TEST_HOST}:${TEST_PORT}`);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Main test suite
async function runTests() {
  log.title('🧪 MedTech Backend - Comprehensive Test Suite');

  try {
    // Wait a bit for server to be ready
    await new Promise((r) => setTimeout(r, 1000));

    // Test 1: Health Check
    log.title('Test 1: Health Check');
    try {
      const healthRes = await makeRequest('GET', '/health');
      
      if (healthRes.status === 200 && healthRes.body?.status === 'healthy') {
        log.success('Health check endpoint responded correctly');
        log.data(`Status: ${healthRes.body.status}`);
        log.data(`Backend: ${healthRes.body.backend}`);
        log.data(`CORS Enabled: ${healthRes.body.cors_enabled}`);
        log.data(`Email Configured: ${healthRes.body.email_configured}`);
      } else {
        log.error(`Health check failed with status ${healthRes.status}`);
      }
    } catch (e) {
      log.error(`Failed to reach health endpoint: ${e.message}`);
    }

    // Test 2: Root Endpoint
    log.title('Test 2: Root Endpoint');
    try {
      const rootRes = await makeRequest('GET', '/');
      
      if (rootRes.status === 200 && rootRes.body?.success) {
        log.success('Root endpoint is working');
        log.data(`Message: ${rootRes.body.message}`);
      } else {
        log.error(`Root endpoint failed with status ${rootRes.status}`);
      }
    } catch (e) {
      log.error(`Failed to reach root endpoint: ${e.message}`);
    }

    // Test 3: Email Configuration Status
    log.title('Test 3: Email Configuration Status');
    try {
      const emailHealthRes = await makeRequest('GET', '/api/auth/email-health');
      
      if (emailHealthRes.status === 200) {
        log.success('Email health check endpoint responded');
        log.data(`Provider: ${emailHealthRes.body.provider}`);
        log.data(`Configured: ${emailHealthRes.body.configured}`);
        log.data(`SMTP Server: ${emailHealthRes.body.smtp_server}`);
        log.data(`SMTP Port: ${emailHealthRes.body.smtp_port}`);
        log.data(`From Email: ${emailHealthRes.body.from_email}`);
      } else {
        log.error(`Email health check failed with status ${emailHealthRes.status}`);
      }
    } catch (e) {
      log.error(`Failed to reach email health endpoint: ${e.message}`);
    }

    // Test 4: CORS Headers Check
    log.title('Test 4: CORS Headers Check');
    try {
      const corsRes = await makeRequest('GET', '/health');
      const accessControlAllowOrigin = corsRes.headers['access-control-allow-origin'];
      
      if (accessControlAllowOrigin) {
        log.success(`CORS header is set correctly`);
        log.data(`Allow-Origin: ${accessControlAllowOrigin}`);
      } else {
        log.error('CORS headers not found in response');
      }
    } catch (e) {
      log.error(`Failed to check CORS headers: ${e.message}`);
    }

    // Test 5: Test Email Endpoint
    log.title(`Test 5: Send Test Email to ${TEST_EMAIL}`);
    try {
      log.info(`Sending test email to: ${TEST_EMAIL}`);
      const testEmailRes = await makeRequest('POST', '/api/auth/test-email', {
        email: TEST_EMAIL,
      });

      if (testEmailRes.status === 200 && testEmailRes.body?.success) {
        log.success(`Test email sent successfully!`);
        log.data(`To: ${testEmailRes.body.to}`);
        log.data(`Message ID: ${testEmailRes.body.messageId}`);
        log.info('Check your inbox for the test email');
      } else {
        log.error(`Test email failed with status ${testEmailRes.status}`);
        log.data(`Response: ${JSON.stringify(testEmailRes.body, null, 2)}`);
      }
    } catch (e) {
      log.error(`Failed to send test email: ${e.message}`);
    }

    // Test 6: Forgot Password Endpoint
    log.title(`Test 6: Forgot Password Request for ${TEST_EMAIL}`);
    try {
      log.info(`Initiating forgot password flow for: ${TEST_EMAIL}`);
      const forgotPasswordRes = await makeRequest('POST', '/api/auth/forgot-password', {
        email: TEST_EMAIL,
      });

      if (forgotPasswordRes.status === 200 && forgotPasswordRes.body?.success) {
        log.success(`Forgot password request processed successfully!`);
        log.data(`Message: ${forgotPasswordRes.body.message}`);
        log.data(`Email: ${forgotPasswordRes.body.email}`);
        log.info('Check your inbox for the password reset email');
      } else {
        log.error(`Forgot password request failed with status ${forgotPasswordRes.status}`);
        log.data(`Response: ${JSON.stringify(forgotPasswordRes.body, null, 2)}`);
      }
    } catch (e) {
      log.error(`Failed to process forgot password request: ${e.message}`);
    }

    // Test 7: Invalid Forgot Password (Missing Email)
    log.title('Test 7: Validation - Missing Email in Forgot Password');
    try {
      const invalidRes = await makeRequest('POST', '/api/auth/forgot-password', {});

      if (invalidRes.status === 400) {
        log.success(`Validation working correctly - rejected request without email`);
        log.data(`Response: ${invalidRes.body.message}`);
      } else {
        log.error(`Validation failed - should have rejected with 400`);
      }
    } catch (e) {
      log.error(`Failed validation test: ${e.message}`);
    }

    // Test 8: 404 Handler
    log.title('Test 8: 404 Handler for Non-existent Endpoint');
    try {
      const notFoundRes = await makeRequest('GET', '/api/non-existent-endpoint');

      if (notFoundRes.status === 404 && !notFoundRes.body?.success) {
        log.success(`404 handler working correctly`);
        log.data(`Response: ${notFoundRes.body.error}`);
      } else {
        log.error(`404 handler not working as expected`);
      }
    } catch (e) {
      log.error(`Failed 404 test: ${e.message}`);
    }

    log.title('✅ Test Suite Complete!');
    log.info('Next steps:');
    log.info('1. Check your inbox for test and forgot-password emails');
    log.info('2. Click the reset link in the forgot-password email');
    log.info('3. Verify that the frontend can communicate with the backend');
    log.info('4. If all tests pass, we can push to GitHub and deploy!');

  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
  }

  // Give time for console output before process ends
  await new Promise((r) => setTimeout(r, 500));
  process.exit(0);
}

// Give server time to start, then run tests
setTimeout(runTests, 2000);
