const express = require('express');

const { db } = require('../../database');
const { sendPrescriptionEmail } = require('../utils/prescriptionEmail');

const router = express.Router();

function sanitizeText(value, max = 500) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function normalizeMedicines(rawMedicines) {
  if (!Array.isArray(rawMedicines)) {
    return [];
  }

  return rawMedicines
    .map((med) => ({
      name: sanitizeText(med && med.name, 120),
      dose: sanitizeText((med && (med.dose || med.dosage)) || '', 120),
      duration: sanitizeText(med && med.duration, 120),
    }))
    .filter((med) => med.name);
}

function mapRow(row) {
  let medicines = [];
  try {
    medicines = JSON.parse(row.medicines || '[]');
  } catch {
    medicines = [];
  }

  return {
    id: row.id,
    patient: {
      id: row.patient_id || '',
      name: row.patient_name,
      email: row.patient_email,
    },
    doctor: {
      name: row.doctor_name,
      specialization: row.doctor_specialization || '',
    },
    diagnosis: row.diagnosis,
    medicines,
    date: row.date,
    created_at: row.created_at,
  };
}

router.post('/', async (req, res) => {
  try {
    console.log('[API] Incoming prescription:', req.body);

    const { patient, doctor, diagnosis, medicines, date } = req.body || {};

    if (!patient?.email || !doctor?.name) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const normalizedPatient = {
      id: sanitizeText(patient.id, 120),
      name: sanitizeText(patient.name, 200) || 'Patient',
      email: sanitizeText(patient.email, 200),
    };
    const normalizedDoctor = {
      name: sanitizeText(doctor.name, 200),
      specialization: sanitizeText(doctor.specialization, 200),
    };
    const normalizedDiagnosis = sanitizeText(diagnosis, 4000);
    const normalizedMedicines = normalizeMedicines(medicines);
    const normalizedDate = sanitizeText(date, 60) || new Date().toISOString();

    const query = `
      INSERT INTO prescriptions (
        patient_name,
        patient_email,
        patient_id,
        doctor_name,
        doctor_specialization,
        diagnosis,
        medicines,
        date,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const values = [
      normalizedPatient.name,
      normalizedPatient.email,
      normalizedPatient.id || null,
      normalizedDoctor.name,
      normalizedDoctor.specialization || null,
      normalizedDiagnosis,
      JSON.stringify(normalizedMedicines),
      normalizedDate,
    ];

    db.run(query, values, async function onInsert(err) {
      if (err) {
        console.error('[DB ERROR]', err);
        return res.status(500).json({ error: 'DB insert failed' });
      }

      const saved = {
        id: this.lastID,
        patient: normalizedPatient,
        doctor: normalizedDoctor,
        diagnosis: normalizedDiagnosis,
        medicines: normalizedMedicines,
        date: normalizedDate,
      };

      console.log('[DB] Prescription saved:', saved.id);

      let emailResult = null;
      try {
        console.log('[MAIL] Triggering email...');
        emailResult = await sendPrescriptionEmail({
          to: normalizedPatient.email,
          patientName: normalizedPatient.name,
          doctorName: normalizedDoctor.name,
          prescription: saved,
        });
        console.log('[MAIL] Email sent');
      } catch (emailErr) {
        console.error('[MAIL ERROR]', emailErr);
      }

      return res.status(201).json({
        success: true,
        data: saved,
        emailSent: Boolean(emailResult && emailResult.success),
      });
    });
  } catch (error) {
    console.error('[API ERROR]', error);
    return res.status(500).json({ error: 'Failed to save prescription' });
  }
});

router.get('/', (req, res) => {
  const patientEmail = sanitizeText(req.query && req.query.patientEmail, 200);
  const patientId = sanitizeText(req.query && req.query.patientId, 120);
  const search = sanitizeText(req.query && req.query.search, 200);

  if (!patientEmail && !patientId) {
    return res.status(400).json({ error: 'patientEmail or patientId is required' });
  }

  let query = `
    SELECT * FROM prescriptions
    WHERE 1 = 1
  `;
  const values = [];

  if (patientEmail) {
    query += ' AND patient_email = ?';
    values.push(patientEmail);
  }

  if (patientId) {
    query += ' AND patient_id = ?';
    values.push(patientId);
  }

  if (search) {
    query += ' AND (LOWER(doctor_name) LIKE ? OR LOWER(diagnosis) LIKE ? OR LOWER(date) LIKE ?)';
    const keyword = `%${search.toLowerCase()}%`;
    values.push(keyword, keyword, keyword);
  }

  query += ' ORDER BY id DESC';

  db.all(query, values, (err, rows) => {
    if (err) {
      console.error('[DB ERROR]', err);
      return res.status(500).json({ error: 'Fetch failed' });
    }

    const formatted = rows.map(mapRow);
    return res.json(formatted);
  });
});

module.exports = router;
