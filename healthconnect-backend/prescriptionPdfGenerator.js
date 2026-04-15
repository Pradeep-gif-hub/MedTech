/**
 * MedTech Prescription PDF Generator (PDFKit)
 * Data flow: JSON -> PDFKit -> PDF Buffer/File
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PAGE_MARGIN = 50;
const TABLE_COLUMNS = [
  { key: 'name', label: 'Medicine', width: 190 },
  { key: 'dosage', label: 'Dosage', width: 90 },
  { key: 'frequency', label: 'Frequency', width: 115 },
  { key: 'duration', label: 'Duration', width: 70 },
];

function formatDate(dateValue) {
  try {
    const d = new Date(dateValue || Date.now());
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(dateValue || 'N/A');
  }
}

function sanitizeText(value, fallback = 'N/A') {
  if (value === null || value === undefined) {
    return fallback;
  }

  const str = String(value).trim();
  return str || fallback;
}

function resolveImagePath(filePath) {
  if (!filePath) {
    return null;
  }

  const candidates = [
    filePath,
    path.resolve(__dirname, filePath),
    path.resolve(process.cwd(), filePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveDefaultAsset(relativePaths) {
  for (const rel of relativePaths) {
    const found = resolveImagePath(rel);
    if (found) {
      return found;
    }
  }

  return null;
}

function normalizePrescriptionData(data = {}) {
  const doctorBlock = typeof data.doctor === 'object' && data.doctor !== null
    ? data.doctor
    : {
        name: data.doctor || 'Dr. John Doe',
        qualification: data.doctorQualification || data.qualification || 'MBBS, MD',
        registrationNumber: data.doctorRegistrationNumber || data.registrationNumber || 'N/A',
      };

  const patientBlock = typeof data.patient === 'object' && data.patient !== null
    ? data.patient
    : {
        name: data.patientName || 'N/A',
        age: data.patientAge || 'N/A',
        gender: data.gender || 'N/A',
      };

  const medicines = Array.isArray(data.medicines)
    ? data.medicines.map((med) => ({
        name: sanitizeText(med?.name),
        dosage: sanitizeText(med?.dosage || med?.dose),
        frequency: sanitizeText(med?.frequency),
        duration: sanitizeText(med?.duration),
      }))
    : [];

  return {
    clinicName: sanitizeText(data.clinicName || data.clinic?.name || 'MedTech Clinic'),
    clinicAddress: sanitizeText(
      data.clinicAddress || data.clinic?.address || '21 Health Avenue, Sector 12, New Delhi',
      '21 Health Avenue, Sector 12, New Delhi'
    ),
    clinicContact: sanitizeText(
      data.clinicContact || data.clinic?.contact || '+91-98765-43210 | support@medtechclinic.com',
      '+91-98765-43210 | support@medtechclinic.com'
    ),
    emergencyContact: sanitizeText(data.emergencyContact || 'Emergency: +91-102-108'),
    doctor: {
      name: sanitizeText(doctorBlock.name),
      qualification: sanitizeText(doctorBlock.qualification, 'MBBS, MD'),
      registrationNumber: sanitizeText(doctorBlock.registrationNumber),
    },
    patient: {
      name: sanitizeText(patientBlock.name),
      age: sanitizeText(patientBlock.age),
      gender: sanitizeText(patientBlock.gender),
    },
    diagnosis: sanitizeText(data.diagnosis || data.notes || data.clinicalNotes || 'General consultation'),
    prescriptionId: sanitizeText(data.prescriptionId || data.patientId || `RX-${Date.now()}`),
    dateFormatted: formatDate(data.date),
    medicines,
    footerDisclaimer: sanitizeText(
      data.footerDisclaimer || 'This is a computer-generated prescription',
      'This is a computer-generated prescription'
    ),
    logoPath: resolveImagePath(data.logoPath || data.assets?.logoPath || data.logo) ||
      resolveDefaultAsset(['assets/logo.png', 'assets/logo.jpg', 'assets/logo.jpeg']),
    signaturePath: resolveImagePath(data.signaturePath || data.assets?.signaturePath || data.signature) ||
      resolveDefaultAsset(['assets/signature.png', 'assets/signature.jpg']),
    stampPath: resolveImagePath(data.stampPath || data.assets?.stampPath || data.stamp) ||
      resolveDefaultAsset(['assets/stamp.png', 'assets/stamp.jpg']),
  };
}

function addWatermark(doc, watermarkText) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  doc.save();
  doc.fillOpacity(0.08);
  doc.fillColor('#6b7280');
  doc.font('Helvetica-Bold');
  doc.fontSize(64);
  doc.rotate(-35, { origin: [pageWidth / 2, pageHeight / 2] });

  const watermarkWidth = doc.widthOfString(watermarkText);
  doc.text(
    watermarkText,
    (pageWidth - watermarkWidth) / 2,
    pageHeight / 2,
    { lineBreak: false }
  );

  doc.restore();
  doc.fillOpacity(1);
  doc.fillColor('#111827');
}

function drawHeader(doc, payload, startY) {
  const leftX = PAGE_MARGIN;
  const rightX = doc.page.width - PAGE_MARGIN - 180;
  let titleX = leftX;

  if (payload.logoPath) {
    try {
      doc.image(payload.logoPath, leftX, startY, { fit: [52, 52], align: 'left' });
      titleX = leftX + 62;
    } catch (error) {
      console.warn('[PrescriptionPDF] Could not load logo image:', error.message);
    }
  }

  doc.font('Helvetica-Bold').fontSize(24).fillColor('#0f172a').text(payload.clinicName, titleX, startY);
  doc.font('Helvetica').fontSize(10).fillColor('#334155').text(payload.clinicAddress, titleX, startY + 30, { width: 320 });
  doc.fontSize(10).text(payload.clinicContact, titleX, startY + 45, { width: 320 });

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a8a').text('Prescription ID', rightX, startY);
  doc.font('Helvetica').fontSize(11).fillColor('#111827').text(payload.prescriptionId, rightX, startY + 14, { width: 180 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a8a').text('Date', rightX, startY + 32);
  doc.font('Helvetica').fontSize(11).fillColor('#111827').text(payload.dateFormatted, rightX, startY + 46, { width: 180 });

  const lineY = startY + 72;
  doc.moveTo(PAGE_MARGIN, lineY).lineTo(doc.page.width - PAGE_MARGIN, lineY).lineWidth(1).strokeColor('#cbd5e1').stroke();
  return lineY + 14;
}

function drawInformationBlocks(doc, payload, startY) {
  const cardHeight = 96;
  const totalWidth = doc.page.width - PAGE_MARGIN * 2;
  const gap = 12;
  const cardWidth = (totalWidth - gap) / 2;
  const leftX = PAGE_MARGIN;
  const rightX = leftX + cardWidth + gap;

  doc.roundedRect(leftX, startY, cardWidth, cardHeight, 8).fillAndStroke('#f8fafc', '#dbeafe');
  doc.roundedRect(rightX, startY, cardWidth, cardHeight, 8).fillAndStroke('#f8fafc', '#dbeafe');

  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Patient Details', leftX + 12, startY + 10);
  doc.font('Helvetica').fontSize(10)
    .text(`Name: ${payload.patient.name}`, leftX + 12, startY + 28)
    .text(`Age / Gender: ${payload.patient.age} / ${payload.patient.gender}`, leftX + 12, startY + 44)
    .text(`Prescription ID: ${payload.prescriptionId}`, leftX + 12, startY + 60);

  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Doctor Details', rightX + 12, startY + 10);
  doc.font('Helvetica').fontSize(10)
    .text(`Name: ${payload.doctor.name}`, rightX + 12, startY + 28)
    .text(`Qualification: ${payload.doctor.qualification}`, rightX + 12, startY + 44)
    .text(`Reg. No: ${payload.doctor.registrationNumber}`, rightX + 12, startY + 60);

  return startY + cardHeight + 16;
}

function drawDiagnosisSection(doc, payload, startY) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Diagnosis / Clinical Notes', PAGE_MARGIN, startY);
  const boxY = startY + 16;
  const boxWidth = doc.page.width - PAGE_MARGIN * 2;
  const boxHeight = Math.max(48, doc.heightOfString(payload.diagnosis, { width: boxWidth - 20 }) + 18);

  doc.roundedRect(PAGE_MARGIN, boxY, boxWidth, boxHeight, 6).fillAndStroke('#f0f9ff', '#bae6fd');
  doc.fillColor('#0f172a').font('Helvetica').fontSize(10).text(payload.diagnosis, PAGE_MARGIN + 10, boxY + 8, { width: boxWidth - 20 });

  return boxY + boxHeight + 18;
}

function drawTableHeader(doc, y) {
  const tableWidth = TABLE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
  doc.rect(PAGE_MARGIN, y, tableWidth, 24).fill('#1e3a8a');

  let cursorX = PAGE_MARGIN;
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
  for (const col of TABLE_COLUMNS) {
    doc.text(col.label, cursorX + 8, y + 7, { width: col.width - 12, align: 'left' });
    cursorX += col.width;
  }

  doc.fillColor('#111827');
  return y + 24;
}

function drawContinuationHeader(doc, payload) {
  addWatermark(doc, payload.clinicName);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Prescription - Continued', PAGE_MARGIN, PAGE_MARGIN - 6);
  doc.moveTo(PAGE_MARGIN, PAGE_MARGIN + 10).lineTo(doc.page.width - PAGE_MARGIN, PAGE_MARGIN + 10).strokeColor('#cbd5e1').stroke();
  return PAGE_MARGIN + 18;
}

function drawMedicinesTable(doc, payload, startY) {
  const medicines = payload.medicines.length > 0
    ? payload.medicines
    : [{ name: 'No medicines prescribed', dosage: '-', frequency: '-', duration: '-' }];

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Prescribed Medicines', PAGE_MARGIN, startY);
  let y = drawTableHeader(doc, startY + 16);
  let rowIndex = 0;

  for (const med of medicines) {
    const textHeight = Math.max(
      doc.heightOfString(med.name, { width: TABLE_COLUMNS[0].width - 14 }),
      doc.heightOfString(med.dosage, { width: TABLE_COLUMNS[1].width - 14 }),
      doc.heightOfString(med.frequency, { width: TABLE_COLUMNS[2].width - 14 }),
      doc.heightOfString(med.duration, { width: TABLE_COLUMNS[3].width - 14 })
    );

    const rowHeight = Math.max(26, textHeight + 10);
    const footerReserve = 130;
    if (y + rowHeight > doc.page.height - PAGE_MARGIN - footerReserve) {
      doc.addPage();
      y = drawTableHeader(doc, drawContinuationHeader(doc, payload));
      rowIndex = 0;
    }

    const rowFill = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
    const tableWidth = TABLE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
    doc.rect(PAGE_MARGIN, y, tableWidth, rowHeight).fill(rowFill);

    let x = PAGE_MARGIN;
    doc.fillColor('#111827').font('Helvetica').fontSize(10);
    for (const col of TABLE_COLUMNS) {
      doc.text(med[col.key], x + 7, y + 5, { width: col.width - 12, align: 'left' });
      x += col.width;
      doc.moveTo(x, y).lineTo(x, y + rowHeight).strokeColor('#e2e8f0').stroke();
    }

    doc.moveTo(PAGE_MARGIN, y + rowHeight).lineTo(PAGE_MARGIN + tableWidth, y + rowHeight).strokeColor('#e2e8f0').stroke();
    y += rowHeight;
    rowIndex += 1;
  }

  return y + 16;
}

function drawSignatureAndFooter(doc, payload, startY) {
  const minRequired = 120;
  let y = startY;
  if (y + minRequired > doc.page.height - PAGE_MARGIN) {
    doc.addPage();
    y = drawContinuationHeader(doc, payload);
  }

  const signatureBlockX = doc.page.width - PAGE_MARGIN - 180;
  const signatureTopY = y;

  if (payload.signaturePath) {
    try {
      doc.image(payload.signaturePath, signatureBlockX + 20, signatureTopY, { fit: [130, 45], align: 'center' });
    } catch (error) {
      console.warn('[PrescriptionPDF] Could not load signature image:', error.message);
    }
  }

  if (payload.stampPath) {
    try {
      doc.image(payload.stampPath, signatureBlockX - 65, signatureTopY - 8, { fit: [58, 58] });
    } catch (error) {
      console.warn('[PrescriptionPDF] Could not load stamp image:', error.message);
    }
  }

  doc.moveTo(signatureBlockX + 18, signatureTopY + 52)
    .lineTo(signatureBlockX + 158, signatureTopY + 52)
    .strokeColor('#334155')
    .stroke();
  doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Authorized Signature', signatureBlockX + 36, signatureTopY + 57);

  const footerY = doc.page.height - PAGE_MARGIN - 30;
  doc.moveTo(PAGE_MARGIN, footerY - 8)
    .lineTo(doc.page.width - PAGE_MARGIN, footerY - 8)
    .strokeColor('#cbd5e1')
    .stroke();

  doc.font('Helvetica').fontSize(9).fillColor('#475569')
    .text(payload.footerDisclaimer, PAGE_MARGIN, footerY, { width: doc.page.width - PAGE_MARGIN * 2, align: 'center' })
    .text(payload.emergencyContact, PAGE_MARGIN, footerY + 12, { width: doc.page.width - PAGE_MARGIN * 2, align: 'center' });
}

function renderPrescriptionDocument(doc, payload) {
  addWatermark(doc, payload.clinicName);

  let cursorY = PAGE_MARGIN;
  cursorY = drawHeader(doc, payload, cursorY);
  cursorY = drawInformationBlocks(doc, payload, cursorY);
  cursorY = drawDiagnosisSection(doc, payload, cursorY);
  cursorY = drawMedicinesTable(doc, payload, cursorY);
  drawSignatureAndFooter(doc, payload, cursorY);
}

function getPatientName(data) {
  if (typeof data?.patient === 'object' && data.patient?.name) {
    return data.patient.name;
  }
  return data?.patientName || 'prescription';
}

function generatePrescriptionFilename(patientName = 'prescription') {
  const sanitizedName = String(patientName)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
  const timestamp = new Date().toISOString().split('T')[0];
  return `prescription_${sanitizedName}_${timestamp}.pdf`;
}

/**
 * Generate prescription PDF.
 * @param {Object} data
 * @param {string|null} outputPath
 * @returns {Promise<Buffer|string>}
 */
async function generatePrescriptionPDF(data, outputPath = null) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: must be an object');
  }

  const payload = normalizePrescriptionData(data);
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: PAGE_MARGIN,
      bottom: PAGE_MARGIN,
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
    },
  });

  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        if (outputPath) {
          fs.writeFileSync(outputPath, pdfBuffer);
          console.log(`[PrescriptionPDF] PDF saved to ${outputPath}`);
          resolve(outputPath);
          return;
        }

        resolve(pdfBuffer);
      } catch (error) {
        reject(error);
      }
    });

    try {
      renderPrescriptionDocument(doc, payload);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function generatePrescriptionBuffer(data) {
  return generatePrescriptionPDF(data, null);
}

async function generateAndSavePrescription(data) {
  const filename = generatePrescriptionFilename(getPatientName(data));
  const tempDir = path.join(os.tmpdir(), 'medtech-prescriptions');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filepath = path.join(tempDir, filename);
  await generatePrescriptionPDF(data, filepath);
  return {
    filename,
    filepath,
    buffer: fs.readFileSync(filepath),
  };
}

module.exports = {
  generatePrescriptionPDF,
  generatePrescriptionBuffer,
  generateAndSavePrescription,
  generatePrescriptionFilename,
  normalizePrescriptionData,
};
