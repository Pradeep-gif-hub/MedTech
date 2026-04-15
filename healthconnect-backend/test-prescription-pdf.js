/**
 * Prescription PDF Generator - Test Suite
 * 
 * Tests all functionality:
 * - PDF generation with complete data
 * - PDF generation with minimal data
 * - PDF generation with multiple medicines
 * - HTML preview generation
 * - XSS protection (HTML escaping)
 * 
 * Run: node test-prescription-pdf.js
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 8000}`;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  test: (msg) => console.log(`\n${colors.blue}📋 TEST: ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.yellow}${'═'.repeat(70)}\n  ${msg}\n${'═'.repeat(70)}${colors.reset}`),
};

/**
 * Make HTTP POST request
 */
function makeRequest(path, data, expectPDF = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data)),
      },
    };

    const req = http.request(options, (res) => {
      let responseData = Buffer.alloc(0);

      res.on('data', (chunk) => {
        responseData = Buffer.concat([responseData, chunk]);
      });

      res.on('end', () => {
        if (expectPDF) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            buffer: responseData,
            size: responseData.length,
          });
        } else {
          try {
            const jsonData = JSON.parse(responseData.toString());
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: jsonData,
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: responseData.toString(),
            });
          }
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Make HTTP GET request
 */
function getRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonData,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData,
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Test Suite
 */
async function runTests() {
  log.header('Prescription PDF Generator Test Suite');

  try {
    // Test 1: Get Sample Data
    log.test('Get Sample Prescription Data');
    try {
      const sampleRes = await getRequest('/api/prescription/sample');
      if (sampleRes.statusCode === 200 && sampleRes.body.data) {
        log.success('Sample data retrieved successfully');
        console.log(`  - Patient: ${sampleRes.body.data.patientName}`);
        console.log(`  - Doctor: ${sampleRes.body.data.doctor}`);
        console.log(`  - Medicines: ${sampleRes.body.data.medicines.length}`);
      } else {
        log.error(`Failed to get sample data: ${sampleRes.statusCode}`);
      }
    } catch (error) {
      log.error(`Sample data request failed: ${error.message}`);
    }

    // Test 2: Generate PDF with Complete Data
    log.test('Generate PDF with Complete Data');
    const completeData = {
      patientName: 'Pradeep Awasthi',
      patientId: 'MED-2026-00032',
      patientAge: '28',
      gender: 'Male',
      doctor: 'Dr. Sharma (MBBS, MD)',
      diagnosis: 'Fever and cold with mild cough. Patient experiencing fatigue and body aches for 2-3 days. Temperature recorded at 101.5°F.',
      date: '2026-04-16',
      medicines: [
        {
          name: 'Paracetamol',
          dose: '500mg',
          frequency: 'Twice daily (morning & evening)',
          duration: '5 days',
        },
        {
          name: 'Amoxicillin',
          dose: '250mg',
          frequency: 'Three times daily (with meals)',
          duration: '7 days',
        },
        {
          name: 'Cetirizine HCL',
          dose: '10mg',
          frequency: 'Once at night',
          duration: '5 days',
        },
      ],
    };

    try {
      const pdfRes = await makeRequest('/api/prescription/generate', completeData, true);
      if (pdfRes.statusCode === 200 && pdfRes.buffer.length > 0) {
        log.success('PDF generated successfully');
        console.log(`  - File size: ${(pdfRes.buffer.length / 1024).toFixed(2)} KB`);
        console.log(`  - Content-Type: ${pdfRes.headers['content-type']}`);
        console.log(`  - Filename: ${pdfRes.headers['content-disposition']}`);

        // Check if it's a valid PDF
        const isPDF = pdfRes.buffer[0] === 0x25 && pdfRes.buffer[1] === 0x50; // %P
        if (isPDF) {
          log.success('Valid PDF file format detected');
        } else {
          log.error('PDF format validation failed');
        }
      } else {
        log.error(`Failed to generate PDF: ${pdfRes.statusCode}`);
      }
    } catch (error) {
      log.error(`PDF generation failed: ${error.message}`);
    }

    // Test 3: Generate PDF with Minimal Data
    log.test('Generate PDF with Minimal Data (N/A Fields)');
    const minimalData = {
      patientName: 'Test Patient',
      doctor: 'Dr. Test',
    };

    try {
      const pdfRes = await makeRequest('/api/prescription/generate', minimalData, true);
      if (pdfRes.statusCode === 200 && pdfRes.buffer.length > 0) {
        log.success('Minimal data PDF generated successfully');
        console.log(`  - File size: ${(pdfRes.buffer.length / 1024).toFixed(2)} KB`);
        console.log(`  - Expected: Missing fields should show "N/A"`);
      } else {
        log.error(`Failed to generate minimal PDF: ${pdfRes.statusCode}`);
      }
    } catch (error) {
      log.error(`Minimal data PDF generation failed: ${error.message}`);
    }

    // Test 4: Generate PDF with Multiple Medicines
    log.test('Generate PDF with Multiple Medicines');
    const multiMedicinesData = {
      patientName: 'Medicine Test Patient',
      doctor: 'Dr. Test',
      medicines: [
        { name: 'Medicine 1', dose: '500mg', frequency: 'Twice daily', duration: '5 days' },
        { name: 'Medicine 2', dose: '250mg', frequency: 'Three times daily', duration: '7 days' },
        { name: 'Medicine 3', dose: '10mg', frequency: 'Once daily', duration: '10 days' },
        { name: 'Medicine 4', dose: '20ml', frequency: 'Three times daily', duration: '5 days' },
        { name: 'Medicine 5', dose: '1 tablet', frequency: 'At bedtime', duration: '14 days' },
      ],
    };

    try {
      const pdfRes = await makeRequest('/api/prescription/generate', multiMedicinesData, true);
      if (pdfRes.statusCode === 200 && pdfRes.buffer.length > 0) {
        log.success('Multi-medicine PDF generated successfully');
        console.log(`  - File size: ${(pdfRes.buffer.length / 1024).toFixed(2)} KB`);
        console.log(`  - Number of medicines: 5`);
      } else {
        log.error(`Failed to generate multi-medicine PDF: ${pdfRes.statusCode}`);
      }
    } catch (error) {
      log.error(`Multi-medicine PDF generation failed: ${error.message}`);
    }

    // Test 5: Generate HTML Preview
    log.test('Generate HTML Preview');
    const previewData = {
      patientName: 'Preview Test',
      patientId: 'PREV-001',
      doctor: 'Dr. Preview',
      diagnosis: 'Test diagnosis',
      medicines: [{ name: 'Test Medicine', dose: '500mg', frequency: 'Daily', duration: '5 days' }],
    };

    try {
      const previewRes = await makeRequest('/api/prescription/preview', previewData, false);
      if (previewRes.statusCode === 200 && typeof previewRes.body === 'string') {
        const htmlLength = previewRes.body.length;
        log.success('HTML preview generated successfully');
        console.log(`  - HTML size: ${(htmlLength / 1024).toFixed(2)} KB`);
        console.log(`  - Contains prescription HTML: ${previewRes.body.includes('prescription-container')}`);
      } else {
        log.error(`Failed to generate preview: ${previewRes.statusCode}`);
      }
    } catch (error) {
      log.error(`Preview generation failed: ${error.message}`);
    }

    // Test 6: XSS Protection (HTML Escaping)
    log.test('XSS Protection - HTML Escaping');
    const xssData = {
      patientName: "<script>alert('XSS')</script>John",
      doctor: "Dr. O'Brien & Associates",
      diagnosis: 'Patient has "fever" & <cold>',
    };

    try {
      const previewRes = await makeRequest('/api/prescription/preview', xssData, false);
      if (previewRes.statusCode === 200) {
        const html = previewRes.body;
        const hasUnescapedScript = html.includes("<script>alert('XSS')</script>");
        const hasEscapedEntities =
          html.includes('&lt;script&gt;') || html.includes('&amp;') || html.includes('&quot;');

        if (!hasUnescapedScript && hasEscapedEntities) {
          log.success('XSS protection working - HTML entities escaped');
        } else {
          log.error('XSS protection failed - unescaped content detected');
        }
      } else {
        log.error(`Failed to test XSS: ${previewRes.statusCode}`);
      }
    } catch (error) {
      log.error(`XSS test failed: ${error.message}`);
    }

    // Test 7: Missing Required Fields
    log.test('Error Handling - Missing Required Fields');
    const incompleteData = {
      patientName: 'Only Patient', // Missing doctor
    };

    try {
      const errorRes = await makeRequest('/api/prescription/generate', incompleteData, false);
      if (errorRes.statusCode === 400 && errorRes.body.error) {
        log.success('Properly rejected missing required fields');
        console.log(`  - Error message: "${errorRes.body.error}"`);
      } else {
        log.error('Failed to properly validate required fields');
      }
    } catch (error) {
      log.error(`Error handling test failed: ${error.message}`);
    }

    // Test 8: Empty Medicines Array
    log.test('Empty Medicines Array Handling');
    const noMedicinesData = {
      patientName: 'No Meds Patient',
      doctor: 'Dr. Test',
      medicines: [],
    };

    try {
      const pdfRes = await makeRequest('/api/prescription/generate', noMedicinesData, true);
      if (pdfRes.statusCode === 200 && pdfRes.buffer.length > 0) {
        log.success('PDF with no medicines generated successfully');
        console.log(`  - Should display "No medicines prescribed"`);
      } else {
        log.error(`Failed to generate no-medicines PDF: ${pdfRes.statusCode}`);
      }
    } catch (error) {
      log.error(`No medicines PDF generation failed: ${error.message}`);
    }

    log.header('Test Suite Complete ✓');
    console.log('\n✓ All tests completed!');
    console.log('\nNext steps:');
    console.log('  1. Run the backend: npm start');
    console.log('  2. Run tests: node test-prescription-pdf.js');
    console.log('  3. Check generated PDFs in /tmp/medtech-prescriptions/ (Linux/Mac)');
    console.log('  4. Or use the API directly from your frontend\n');
  } catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    console.error(error);
  }
}

// Run tests
console.log('\n🔍 Checking server connection...');
getRequest('/health')
  .then(() => {
    console.log('✓ Server is running\n');
    runTests();
  })
  .catch((error) => {
    log.error(`Cannot connect to server at ${BASE_URL}`);
    log.info(`Make sure the backend is running: npm start`);
    log.info(`Error: ${error.message}`);
    process.exit(1);
  });
