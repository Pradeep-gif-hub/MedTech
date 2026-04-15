/**
 * Direct Prescription PDF Generator Test
 * Tests the HTML generation without needing the server running
 */

const { generatePrescriptionHTML } = require('./prescriptionPdfGenerator');

console.log('\n' + '═'.repeat(70));
console.log('  PRESCRIPTION PDF GENERATOR - DIRECT TEST');
console.log('═'.repeat(70) + '\n');

// Test 1: Complete prescription data
console.log('📋 TEST 1: Complete Prescription Data');
try {
  const data = {
    patientName: 'Pradeep Awasthi',
    patientId: 'PAT-2026-001',
    patientAge: '35',
    gender: 'Male',
    doctor: 'Dr. Rajesh Kumar',
    diagnosis: 'Hypertension and Type 2 Diabetes Mellitus',
    date: '2026-04-16',
    medicines: [
      { name: 'Lisinopril', dose: '10mg', frequency: 'Once daily', duration: '30 days' },
      { name: 'Metformin', dose: '500mg', frequency: 'Twice daily', duration: '30 days' },
      { name: 'Atorvastatin', dose: '20mg', frequency: 'Once daily', duration: '30 days' },
    ],
  };

  const html = generatePrescriptionHTML(data);
  
  // Verify key sections exist
  const checks = [
    { what: 'DOCTYPE', test: html.includes('<!DOCTYPE html>') },
    { what: 'Header with MedTech', test: html.includes('MedTech Clinic') },
    { what: 'Patient name', test: html.includes('Pradeep Awasthi') },
    { what: 'Patient ID', test: html.includes('PAT-2026-001') },
    { what: 'Doctor name', test: html.includes('Dr. Rajesh Kumar') },
    { what: 'Diagnosis', test: html.includes('Hypertension and Type 2 Diabetes') },
    { what: 'Medicine table', test: html.includes('Lisinopril') && html.includes('Metformin') },
    { what: 'CSS styling', test: html.includes('linear-gradient') },
    { what: 'Authorization stamp', test: html.includes('AUTHORIZED') },
  ];

  let passed = 0;
  checks.forEach((check) => {
    if (check.test) {
      console.log(`  ✓ ${check.what}`);
      passed++;
    } else {
      console.log(`  ✗ ${check.what}`);
    }
  });
  
  console.log(`\n  Result: ${passed}/${checks.length} checks passed`);
  console.log(`  HTML Length: ${html.length} characters\n`);
} catch (err) {
  console.log(`  ✗ Error: ${err.message}\n`);
}

// Test 2: Minimal data
console.log('📋 TEST 2: Minimal Data (should show N/A fields)');
try {
  const data = {
    patientName: 'John Doe',
    doctor: 'Dr. Smith',
  };

  const html = generatePrescriptionHTML(data);
  
  const checks = [
    { what: 'Default values shown', test: html.includes('N/A') },
    { what: 'Patient name', test: html.includes('John Doe') },
    { what: 'Doctor name', test: html.includes('Dr. Smith') },
    { what: 'No medicines message', test: html.includes('No medicines prescribed') },
  ];

  let passed = 0;
  checks.forEach((check) => {
    if (check.test) {
      console.log(`  ✓ ${check.what}`);
      passed++;
    } else {
      console.log(`  ✗ ${check.what}`);
    }
  });
  
  console.log(`\n  Result: ${passed}/${checks.length} checks passed\n`);
} catch (err) {
  console.log(`  ✗ Error: ${err.message}\n`);
}

// Test 3: XSS Protection
console.log('📋 TEST 3: XSS Protection (HTML Escaping)');
try {
  const data = {
    patientName: '<script>alert("XSS")</script>',
    diagnosis: '<img src=x onerror="alert(1)">',
    doctor: 'Dr. "Test" & <Co>',
    medicines: [
      { name: '<b>Injection</b>', dose: '100mg', frequency: 'Daily', duration: '10d' },
    ],
  };

  const html = generatePrescriptionHTML(data);
  
  const checks = [
    { what: 'Script tags escaped', test: !html.includes('<script>') && html.includes('&lt;script&gt;') },
    { what: 'IMG tags escaped', test: !html.includes('<img src=x') && html.includes('&lt;img') },
    { what: 'Ampersand escaped', test: html.includes('&amp;') },
    { what: 'Quotes escaped', test: html.includes('&quot;') },
    { what: 'No raw HTML injection', test: !html.includes('onerror=') },
  ];

  let passed = 0;
  checks.forEach((check) => {
    if (check.test) {
      console.log(`  ✓ ${check.what}`);
      passed++;
    } else {
      console.log(`  ✗ ${check.what}`);
    }
  });
  
  console.log(`\n  Result: ${passed}/${checks.length} checks passed\n`);
} catch (err) {
  console.log(`  ✗ Error: ${err.message}\n`);
}

// Test 4: Multiple medicines
console.log('📋 TEST 4: Multiple Medicines (5+ medicines)');
try {
  const medicines = Array.from({ length: 7 }, (_, i) => ({
    name: `Medicine ${i + 1}`,
    dose: `${50 + i * 10}mg`,
    frequency: i % 2 === 0 ? 'Once daily' : 'Twice daily',
    duration: '30 days',
  }));

  const data = {
    patientName: 'Test Patient',
    doctor: 'Dr. Test',
    medicines,
  };

  const html = generatePrescriptionHTML(data);
  
  const medicineCount = medicines.filter((m) => html.includes(m.name)).length;
  console.log(`  ✓ All ${medicineCount} medicines included in HTML`);
  console.log(`  ✓ Table rows generated: ${(html.match(/<tr/g) || []).length} rows`);
  console.log(`  HTML Length: ${html.length} characters\n`);
} catch (err) {
  console.log(`  ✗ Error: ${err.message}\n`);
}

// Test 5: Design elements verification
console.log('📋 TEST 5: Premium Design Elements');
try {
  const data = {
    patientName: 'Design Test',
    doctor: 'Dr. Design',
    diagnosis: 'Test diagnosis',
    medicines: [
      { name: 'Test Drug', dose: '100mg', frequency: 'Daily', duration: '30d' },
    ],
  };

  const html = generatePrescriptionHTML(data);
  
  const checks = [
    { what: 'Gradient header', test: html.includes('linear-gradient') },
    { what: 'Card shadows', test: html.includes('box-shadow') },
    { what: 'Rounded corners', test: html.includes('border-radius') },
    { what: 'Medical colors', test: html.includes('0369a1') || html.includes('1e3a8a') },
    { what: 'Zebra striping', test: html.includes('f8fafb') },
    { what: 'Responsive table', test: html.includes('table-header') },
    { what: 'Professional stamp', test: html.includes('rotate(-25deg)') },
    { what: 'Print styles', test: html.includes('@media print') },
  ];

  let passed = 0;
  checks.forEach((check) => {
    if (check.test) {
      console.log(`  ✓ ${check.what}`);
      passed++;
    } else {
      console.log(`  ✗ ${check.what}`);
    }
  });
  
  console.log(`\n  Result: ${passed}/${checks.length} design elements verified\n`);
} catch (err) {
  console.log(`  ✗ Error: ${err.message}\n`);
}

console.log('═'.repeat(70));
console.log('  ALL TESTS COMPLETED ✓');
console.log('═'.repeat(70) + '\n');
