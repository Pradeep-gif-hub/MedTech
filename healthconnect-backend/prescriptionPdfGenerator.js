/**
 * MedTech Prescription PDF Generator
 * Professional hospital-grade prescription PDFs using Puppeteer + HTML + CSS
 * 
 * Features:
 * - Dynamic patient/doctor/medicine data
 * - Professional medical branding
 * - Responsive table layout
 * - Print-friendly A4 format
 * - Authorized stamp and signature placeholder
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Generate HTML prescription template with dynamic data
 * @param {Object} data - Prescription data
 * @returns {string} - HTML string ready for PDF conversion
 */
function generatePrescriptionHTML(data) {
  // Validate and sanitize data
  const {
    patientName = 'N/A',
    patientId = 'N/A',
    patientAge = 'N/A',
    gender = 'N/A',
    doctor = 'N/A',
    diagnosis = 'N/A',
    date = new Date().toISOString().split('T')[0],
    medicines = [],
  } = data;

  // Escape HTML to prevent injection
  const escapeHtml = (str) => {
    if (!str) return 'N/A';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Format date to readable format
  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr || 'N/A';
    }
  };

  // Build medicine table rows
  const medicineTables = medicines.length > 0
    ? medicines
        .map(
          (med, idx) => `
        <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
          <td class="table-cell">${escapeHtml(med.name || 'N/A')}</td>
          <td class="table-cell">${escapeHtml(med.dose || 'N/A')}</td>
          <td class="table-cell">${escapeHtml(med.frequency || 'N/A')}</td>
          <td class="table-cell">${escapeHtml(med.duration || 'N/A')}</td>
        </tr>
      `
        )
        .join('')
    : '<tr><td colspan="4" class="table-cell text-center">No medicines prescribed</td></tr>';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prescription - ${escapeHtml(patientName)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');

    body {
      font-family: 'Poppins', 'Inter', sans-serif;
      background: #f5f5f5;
      padding: 0;
      margin: 0;
      color: #333;
      line-height: 1.6;
    }

    .prescription-container {
      width: 210mm;
      height: 297mm;
      background: white;
      margin: 0 auto;
      padding: 0;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      font-size: 13px;
    }

    /* ===== HEADER SECTION ===== */
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%);
      color: white;
      padding: 25px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #0ea5e9;
      position: relative;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .logo-icon {
      width: 60px;
      height: 60px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: bold;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .header-text h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }

    .header-text p {
      font-size: 12px;
      margin: 4px 0 0 0;
      opacity: 0.95;
      font-weight: 300;
    }

    .header-right {
      text-align: right;
      font-size: 12px;
    }

    .header-right p {
      margin: 6px 0;
      opacity: 0.9;
    }

    .header-right .label {
      opacity: 0.8;
      font-size: 11px;
    }

    /* ===== PATIENT & DOCTOR INFO CARDS ===== */
    .info-section {
      display: flex;
      gap: 20px;
      padding: 20px 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .info-card {
      flex: 1;
      background: white;
      border-radius: 8px;
      padding: 16px;
      border-left: 4px solid #0369a1;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .info-card.patient {
      border-left-color: #0369a1;
    }

    .info-card.doctor {
      border-left-color: #059669;
    }

    .info-card h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .info-field {
      margin-bottom: 8px;
    }

    .info-label {
      font-size: 10px;
      color: #999;
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.3px;
    }

    .info-value {
      font-size: 13px;
      color: #1a1a1a;
      font-weight: 600;
      margin-top: 2px;
    }

    /* ===== DIAGNOSIS SECTION ===== */
    .diagnosis-section {
      padding: 20px 30px;
      border-bottom: 1px solid #e0e0e0;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title::before {
      content: '';
      width: 4px;
      height: 16px;
      background: linear-gradient(to bottom, #0369a1, #06b6d4);
      border-radius: 2px;
    }

    .diagnosis-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 14px;
      color: #164e63;
      font-size: 13px;
      line-height: 1.6;
      min-height: 40px;
    }

    /* ===== MEDICINE TABLE ===== */
    .medicines-section {
      padding: 20px 30px;
      border-bottom: 1px solid #e0e0e0;
    }

    .medicine-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    .table-header {
      background: linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%);
      color: white;
    }

    .table-header th {
      padding: 12px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border: none;
    }

    .table-header th:nth-child(1) {
      width: 40%;
    }

    .table-header th:nth-child(2) {
      width: 20%;
    }

    .table-header th:nth-child(3) {
      width: 20%;
    }

    .table-header th:nth-child(4) {
      width: 20%;
    }

    .table-cell {
      padding: 11px 10px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 12px;
      color: #333;
    }

    .medicine-table tr.even-row {
      background: #f8fafb;
    }

    .medicine-table tr.odd-row {
      background: white;
    }

    .medicine-table tr:hover {
      background: #f0f9ff;
    }

    .text-center {
      text-align: center;
      font-style: italic;
      color: #999;
    }

    /* ===== AUTHORIZATION SECTION ===== */
    .authorization-section {
      padding: 20px 30px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
      gap: 40px;
    }

    .signature-block {
      text-align: center;
      min-width: 140px;
    }

    .signature-line {
      border-top: 1px solid #333;
      height: 0;
      margin-bottom: 4px;
      width: 100%;
    }

    .signature-label {
      font-size: 11px;
      color: #666;
      font-weight: 500;
    }

    .stamp {
      position: relative;
      width: 120px;
      height: 120px;
    }

    .stamp-circle {
      width: 100%;
      height: 100%;
      border: 2px solid #dc2626;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: #dc2626;
      text-align: center;
      opacity: 0.3;
      transform: rotate(-25deg);
      padding: 8px;
    }

    .stamp-circle span {
      line-height: 1.2;
      letter-spacing: 1px;
    }

    /* ===== FOOTER ===== */
    .footer {
      padding: 15px 30px;
      text-align: center;
      border-top: 2px dashed #0369a1;
      background: #fafafa;
      font-size: 11px;
      color: #666;
      line-height: 1.6;
    }

    .footer p {
      margin: 4px 0;
    }

    .footer-note {
      font-style: italic;
      color: #999;
      font-size: 10px;
    }

    /* ===== PRINT STYLES ===== */
    @media print {
      body {
        background: white;
        padding: 0;
      }

      .prescription-container {
        width: 100%;
        height: auto;
        box-shadow: none;
        margin: 0;
        padding: 0;
      }
    }

    @page {
      size: A4;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="prescription-container">
    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <div class="logo-icon">⚕️</div>
        <div class="header-text">
          <h1>MedTech Clinic</h1>
          <p>Smart Healthcare System</p>
        </div>
      </div>
      <div class="header-right">
        <p><span class="label">Date:</span></p>
        <p style="font-weight: 600; font-size: 13px;">${formatDate(date)}</p>
        <p style="margin-top: 8px; opacity: 0.8; font-size: 10px;">Digital Prescription</p>
      </div>
    </div>

    <!-- PATIENT & DOCTOR INFO -->
    <div class="info-section">
      <div class="info-card patient">
        <h3>Patient Information</h3>
        <div class="info-field">
          <div class="info-label">Patient Name</div>
          <div class="info-value">${escapeHtml(patientName)}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Patient ID</div>
          <div class="info-value">${escapeHtml(patientId)}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Age / Gender</div>
          <div class="info-value">${escapeHtml(patientAge)} / ${escapeHtml(gender)}</div>
        </div>
      </div>

      <div class="info-card doctor">
        <h3>Doctor Information</h3>
        <div class="info-field">
          <div class="info-label">Consulting Doctor</div>
          <div class="info-value">${escapeHtml(doctor)}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Prescription Date</div>
          <div class="info-value">${formatDate(date)}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Status</div>
          <div class="info-value" style="color: #059669;">Active</div>
        </div>
      </div>
    </div>

    <!-- DIAGNOSIS SECTION -->
    <div class="diagnosis-section">
      <div class="section-title">Diagnosis / Clinical Notes</div>
      <div class="diagnosis-box">
        ${escapeHtml(diagnosis)}
      </div>
    </div>

    <!-- MEDICINES TABLE -->
    <div class="medicines-section">
      <div class="section-title">Prescribed Medicines</div>
      <table class="medicine-table">
        <thead class="table-header">
          <tr>
            <th>Medicine Name</th>
            <th>Dose / Strength</th>
            <th>Frequency</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${medicineTables}
        </tbody>
      </table>
    </div>

    <!-- AUTHORIZATION SECTION -->
    <div class="authorization-section">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Doctor Signature</div>
      </div>
      <div class="stamp">
        <div class="stamp-circle">
          <span>AUTHORIZED<br/>MedTech Clinic</span>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p>This is a digitally generated prescription from MedTech Clinic</p>
      <p class="footer-note">Valid for use at registered healthcare partners only</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF from prescription data
 * @param {Object} data - Prescription data object
 * @param {string} outputPath - Path where PDF should be saved (optional)
 * @returns {Promise<Buffer|string>} - PDF buffer or file path
 */
async function generatePrescriptionPDF(data, outputPath = null) {
  let browser = null;
  try {
    console.log('[PrescriptionPDF] Starting PDF generation...');

    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data: must be an object');
    }

    // Generate HTML
    const htmlContent = generatePrescriptionHTML(data);

    // Launch Puppeteer browser
    console.log('[PrescriptionPDF] Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();

    // Set viewport and content
    await page.setViewport({ width: 1024, height: 1440 });
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle2',
    });

    console.log('[PrescriptionPDF] Generating PDF...');

    // If output path provided, save to file
    if (outputPath) {
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0px',
          right: '0px',
          bottom: '0px',
          left: '0px',
        },
      });
      console.log(`[PrescriptionPDF] PDF saved to: ${outputPath}`);
      await browser.close();
      return outputPath;
    }

    // Otherwise return buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      },
    });

    await browser.close();
    console.log('[PrescriptionPDF] PDF generated successfully');
    return pdfBuffer;
  } catch (error) {
    console.error('[PrescriptionPDF] Error generating PDF:', error.message);
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Generate filename for prescription
 * @param {string} patientName - Patient name
 * @returns {string} - Formatted filename
 */
function generatePrescriptionFilename(patientName = 'prescription') {
  const sanitizedName = String(patientName)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
  const timestamp = new Date().toISOString().split('T')[0];
  return `prescription_${sanitizedName}_${timestamp}.pdf`;
}

/**
 * Generate prescription and save to temp directory
 * @param {Object} data - Prescription data
 * @returns {Promise<{filename: string, filepath: string, buffer: Buffer}>}
 */
async function generateAndSavePrescription(data) {
  try {
    const filename = generatePrescriptionFilename(data.patientName);
    const tempDir = path.join(os.tmpdir(), 'medtech-prescriptions');

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filepath = path.join(tempDir, filename);

    console.log('[PrescriptionPDF] Generating prescription:', filename);
    await generatePrescriptionPDF(data, filepath);

    // Read file to get buffer
    const buffer = fs.readFileSync(filepath);

    return {
      filename,
      filepath,
      buffer,
    };
  } catch (error) {
    console.error('[PrescriptionPDF] Error in generateAndSavePrescription:', error.message);
    throw error;
  }
}

/**
 * Generate prescription as buffer only (for streaming)
 * @param {Object} data - Prescription data
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generatePrescriptionBuffer(data) {
  return generatePrescriptionPDF(data, null);
}

module.exports = {
  generatePrescriptionPDF,
  generatePrescriptionBuffer,
  generateAndSavePrescription,
  generatePrescriptionFilename,
  generatePrescriptionHTML,
};
