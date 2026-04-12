/**
 * Fast Browser-Ready Test Suite
 * Tests all endpoints and sends test/password reset emails
 */

const http = require('http');

const tests = [
  {
    name: '1️⃣ Root Endpoint',
    method: 'GET',
    path: '/',
    body: null,
  },
  {
    name: '2️⃣ Health Check',
    method: 'GET',
    path: '/health',
    body: null,
  },
  {
    name: '3️⃣ Email Configuration Health',
    method: 'GET',
    path: '/api/auth/email-health',
    body: null,
  },
  {
    name: '4️⃣ Validate Missing Email (Should Fail)',
    method: 'POST',
    path: '/api/auth/forgot-password',
    body: {},
  },
  {
    name: '5️⃣ Send Test Email',
    method: 'POST',
    path: '/api/auth/test-email',
    body: { email: 'pawasthi063@gmail.com' },
  },
  {
    name: '6️⃣ Send Password Reset Email',
    method: 'POST',
    path: '/api/auth/forgot-password',
    body: { email: 'pawasthi063@gmail.com' },
  },
  {
    name: '7️⃣ 404 Not Found (Should Fail)',
    method: 'GET',
    path: '/non-existent-endpoint-xyz',
    body: null,
  },
];

let testCount = 0;
let passCount = 0;
let failCount = 0;

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
            headers: res.headers,
          });
        } catch {
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers,
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

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 MedTech Backend - Test Suite');
  console.log('='.repeat(80) + '\n');

  for (const test of tests) {
    testCount++;
    try {
      const response = await makeRequest(test.method, test.path, test.body);
      const success = response.status >= 200 && response.status < 300;
      
      if (success) {
        passCount++;
        console.log(`✅ ${test.name}`);
        console.log(`   └─ Status: ${response.status}`);
        if (response.body?.success || response.body?.status) {
          console.log(`   └─ Response: ${JSON.stringify(response.body).substring(0, 100)}...`);
        }
      } else {
        failCount++;
        console.log(`❌ ${test.name}`);
        console.log(`   └─ Status: ${response.status}`);
        console.log(`   └─ Response: ${JSON.stringify(response.body).substring(0, 100)}...`);
      }
    } catch (error) {
      failCount++;
      testCount++;
      console.log(`❌ ${test.name}`);
      console.log(`   └─ Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testCount}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${Math.round((passCount / testCount) * 100)}%`);
  console.log('='.repeat(80) + '\n');

  if (failCount === 0) {
    console.log('🎉 All tests passed! Backend is working correctly!');
    console.log('📧 Check your email (pawasthi063@gmail.com) for:');
    console.log('   1. Test email (from test-email endpoint)');
    console.log('   2. Password reset email (from forgot-password endpoint)');
  } else {
    console.log('⚠️  Some tests failed. Check the output above.');
  }

  console.log('\n');
  process.exit(failCount === 0 ? 0 : 1);
}

runTests().catch((error) => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});
