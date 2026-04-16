const express = require('express');
const crypto = require('crypto');

const Prescription = require('../models/Prescription');
const { ensureMongoConnected } = require('../utils/mongoose');
const { sendPrescriptionEmail } = require('../utils/prescriptionEmail');
const { generatePrescriptionBuffer } = require('../../prescriptionPdfGenerator');

const router = express.Router();
const MAX_MEDICINES = 20;
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 500);
}

function escapeRegex(input) {
  return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generatePrescriptionId() {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RX-${stamp}-${suffix}`;
}

function normalizeMedicines(rawMedicines) {
  if (!Array.isArray(rawMedicines)) {
    return [];
  }

  return rawMedicines
    .slice(0, MAX_MEDICINES)
    .map((med) => ({
      name: sanitizeText(med && med.name),
      dose: sanitizeText(med && med.dose),
      duration: sanitizeText(med && med.duration),
    }))
    .filter((med) => med.name && med.dose && med.duration);
}

function validateBody(payload) {
  const errors = [];
  const patientId = sanitizeText(payload && payload.patient && payload.patient.id);
  const patientName = sanitizeText(payload && payload.patient && payload.patient.name);
  const patientEmail = sanitizeText(payload && payload.patient && payload.patient.email);
  const doctorName = sanitizeText(payload && payload.doctor && payload.doctor.name);
  const doctorSpecialization = sanitizeText(payload && payload.doctor && payload.doctor.specialization);
  const diagnosis = sanitizeText(payload && payload.diagnosis);
  const rawMedicines = payload && payload.medicines;
  const medicines = normalizeMedicines(rawMedicines);
  const dateValue = new Date(payload && payload.date);

  if (!patientId) errors.push('patient.id is required');
  if (!patientName) errors.push('patient.name is required');
  if (!patientEmail) {
    errors.push('patient.email is required');
  } else if (!SIMPLE_EMAIL_REGEX.test(patientEmail)) {
    errors.push('patient.email must be a valid email address');
  }
  if (!doctorName) errors.push('doctor.name is required');
  if (!doctorSpecialization) errors.push('doctor.specialization is required');
  if (!diagnosis) errors.push('diagnosis is required');
  if (!Array.isArray(rawMedicines)) errors.push('medicines must be an array');
  if (Array.isArray(rawMedicines) && rawMedicines.length > MAX_MEDICINES) {
    errors.push(`medicines must not exceed ${MAX_MEDICINES} items`);
  }
  if (!medicines.length) errors.push('medicines must contain at least one valid item with name, dose, and duration');
  if (Number.isNaN(dateValue.getTime())) errors.push('date must be a valid ISO string');

  return {
    errors,
    normalized: {
      patient: {
        id: patientId,
        name: patientName,
        email: patientEmail,
      },
      doctor: {
        name: doctorName,
        specialization: doctorSpecialization,
      },
      diagnosis,
      medicines,
      date: dateValue,
    },
  };
}

function buildSearchFilter(searchKeyword) {
  const keyword = sanitizeText(searchKeyword);
  if (!keyword) {
    return null;
  }

  const escaped = escapeRegex(keyword);
  const regex = new RegExp(escaped, 'i');

  return {
    $or: [
      { 'patient.name': regex },
      { 'doctor.name': regex },
      {
        $expr: {
          $regexMatch: {
            input: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
              },
            },
            regex: escaped,
            options: 'i',
          },
        },
      },
    ],
  };
}

router.post('/', async (req, res) => {
  try {
    console.log('[API] Saving prescription...');
    await ensureMongoConnected();

    const { errors, normalized } = validateBody(req.body || {});
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid prescription payload',
        errors,
      });
    }

    const prescriptionId = generatePrescriptionId();
    const prescription = new Prescription({
      ...normalized,
      prescriptionId,
    });

    const saved = await prescription.save();
    console.log('[DB] Prescription saved:', saved.prescriptionId);

    const pdfBuffer = await generatePrescriptionBuffer({
      patient: {
        name: normalized.patient.name,
        age: 'N/A',
        gender: 'N/A',
      },
      doctor: {
        name: normalized.doctor.name,
        qualification: normalized.doctor.specialization,
        registrationNumber: saved.prescriptionId,
      },
      diagnosis: normalized.diagnosis,
      medicines: normalized.medicines.map((med) => ({
        name: med.name,
        dosage: med.dose,
        duration: med.duration,
        frequency: '',
      })),
      date: normalized.date,
      prescriptionId: saved.prescriptionId,
    });

    let emailResult = null;
    try {
      if (normalized.patient.email) {
        console.log('[INFO] Sending prescription email to:', normalized.patient.email);
        emailResult = await sendPrescriptionEmail(
          normalized.patient.email,
          {
            patientName: normalized.patient.name,
            doctorName: normalized.doctor.name,
            date: normalized.date,
            prescriptionId: saved.prescriptionId,
          },
          pdfBuffer
        );

        if (emailResult && emailResult.success) {
          console.log('[INFO] Prescription email sent successfully');
        }
      }

      if (!emailResult || !emailResult.success) {
        console.error('[ERROR] Email failed:', emailResult && emailResult.error ? emailResult.error : 'Unknown email error');
      }
    } catch (err) {
      console.error('[ERROR] Email failed:', err);
    }

    return res.status(201).json({
      success: true,
      prescription: saved,
      emailSent: Boolean(emailResult && emailResult.success),
      emailError: emailResult && !emailResult.success ? emailResult.error : null,
    });
  } catch (err) {
    console.error('[ERROR] Saving prescription failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save prescription',
      error: err && err.message ? err.message : 'Unknown error',
    });
  }
});

router.get('/', async (req, res) => {
  try {
    console.log('[API] Fetching prescriptions...');
    await ensureMongoConnected();

    const patientId = sanitizeText(req.query && req.query.patientId);
    const search = sanitizeText(req.query && req.query.search);
    console.log('[API] Fetching prescriptions for:', patientId || 'all');

    const filter = {};
    if (patientId) {
      filter['patient.id'] = patientId;
    }

    const searchFilter = buildSearchFilter(search);
    if (searchFilter) {
      filter.$and = filter.$and || [];
      filter.$and.push(searchFilter);
    }

    const prescriptions = await Prescription.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    console.log('[DB] Fetched prescriptions:', prescriptions.length);
    return res.json(prescriptions);
  } catch (err) {
    console.error('[ERROR] Fetch prescriptions failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch prescriptions',
      error: err && err.message ? err.message : 'Unknown error',
    });
  }
});

router.get('/:patientId', async (req, res) => {
  try {
    await ensureMongoConnected();

    const patientId = sanitizeText(req.params && req.params.patientId);
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId is required' });
    }

    console.log('[API] Fetching prescriptions for:', patientId);

    const prescriptions = await Prescription.find({ 'patient.id': patientId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    console.log('[DB] Fetched prescriptions for patient:', patientId, prescriptions.length);
    return res.json(prescriptions);
  } catch (err) {
    console.error('[ERROR] Fetching patient prescriptions failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch patient prescriptions',
      error: err && err.message ? err.message : 'Unknown error',
    });
  }
});

module.exports = router;
