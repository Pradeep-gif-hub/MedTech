/* eslint-disable no-console */
require('dotenv').config();

const BASE_URL = (process.env.TEST_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

async function run() {
  const now = new Date().toISOString();
  const patientId = `patient-${Date.now()}`;

  const payload = {
    patient: {
      id: patientId,
      name: 'Pradeep Awasthi',
      email: 'pawasthi063@gmail.com',
    },
    doctor: {
      name: 'Dr. Shreya Verma',
      specialization: 'General Medicine',
    },
    diagnosis: 'Mild fever and seasonal cold',
    medicines: [
      { name: 'Paracetamol', dose: '500mg', duration: '5 days' },
      { name: 'Cetirizine', dose: '10mg', duration: '3 days' },
    ],
    date: now,
  };

  console.log('[TEST] Creating prescription...');
  const postRes = await fetch(`${BASE_URL}/api/prescriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const postBody = await postRes.json().catch(() => ({}));
  if (!postRes.ok || !postBody || !postBody.prescription) {
    console.error('[TEST] Create failed:', postRes.status, postBody);
    process.exit(1);
  }

  const savedId = postBody.prescription.prescriptionId;
  console.log('[TEST] Prescription saved:', savedId);

  console.log('[TEST] Fetching prescriptions by patientId...');
  const getRes = await fetch(`${BASE_URL}/api/prescriptions/${encodeURIComponent(patientId)}`);
  const getBody = await getRes.json().catch(() => []);

  if (!getRes.ok || !Array.isArray(getBody)) {
    console.error('[TEST] Fetch failed:', getRes.status, getBody);
    process.exit(1);
  }

  const exists = getBody.some((item) => item && item.prescriptionId === savedId);
  if (!exists) {
    console.error('[TEST] Fetch success but created prescription not found');
    process.exit(1);
  }

  console.log(`[TEST] Fetch success: ${getBody.length} record found`);
  console.log('[TEST] Verifying search endpoint...');

  const searchRes = await fetch(
    `${BASE_URL}/api/prescriptions?patientId=${encodeURIComponent(patientId)}&search=${encodeURIComponent('shreya')}`
  );
  const searchBody = await searchRes.json().catch(() => []);
  if (!searchRes.ok || !Array.isArray(searchBody)) {
    console.error('[TEST] Search failed:', searchRes.status, searchBody);
    process.exit(1);
  }

  console.log(`[TEST] Search success: ${searchBody.length} record found`);
  console.log('[TEST] PASS: Prescription create/fetch/search smoke check completed');
}

run().catch((err) => {
  console.error('[TEST] FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
