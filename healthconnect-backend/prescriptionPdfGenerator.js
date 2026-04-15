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

const TEMPLATE_PATH = path.join(__dirname, 'prescription-template.html');
let templateCache = null;
let templateMtimeMs = 0;

function getPrescriptionTemplateHtml() {
  console.log('[PrescriptionPDF] 📂 TEMPLATE FILE USED:', TEMPLATE_PATH);
  const templateStat = fs.statSync(TEMPLATE_PATH);
  const disableCache = process.env.DISABLE_TEMPLATE_CACHE === '1';
  const needsReload = disableCache || templateCache === null || templateMtimeMs !== templateStat.mtimeMs;

  if (needsReload) {
    templateMtimeMs = templateStat.mtimeMs;
    templateCache = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    if (disableCache) {
      console.log('[PrescriptionPDF] Template cache disabled by DISABLE_TEMPLATE_CACHE=1.');
    } else {
      console.log('[PrescriptionPDF] Template cache refreshed from disk.');
    }
    console.log('[PrescriptionPDF] 📄 RAW TEMPLATE CONTENT:\n', templateCache.slice(0, 500));
  }

  return templateCache;
}

function resolveBrowserExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

/**
 * 🔧 FIX 1: GLOBAL escapeHtml - Available everywhere (not just inside functions)
 */
function escapeHtml(str) {
  if (!str) return 'N/A';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format date to readable format
 */
function formatDate(dateStr) {
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
}

/**
 * Get current time in HH:MM:SS format
 */
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

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

  // Escape all values before passing to template.
  const safeData = {
    patientName: escapeHtml(patientName),
    patientId: escapeHtml(patientId),
    patientAge: escapeHtml(patientAge),
    gender: escapeHtml(gender),
    doctor: escapeHtml(doctor),
    diagnosis: escapeHtml(diagnosis),
    dateFormatted: formatDate(date),
    timeFormatted: getCurrentTime(),
  };

  // Build medicine table rows with escaping
  const medicinesRows = medicines.length > 0
    ? medicines
        .map(
          (med, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#f8fafb' : 'white'};">
              <td class="table-cell medicine-name">${escapeHtml(med.name || 'N/A')}</td>
              <td class="table-cell">${escapeHtml(med.dose || 'N/A')}</td>
              <td class="table-cell">${escapeHtml(med.frequency || 'N/A')}</td>
              <td class="table-cell">${escapeHtml(med.duration || 'N/A')}</td>
            </tr>
          `
        )
        .join('')
    : '<tr><td colspan="4" class="table-cell empty">No medicines prescribed</td></tr>';

  // Call template with safe, pre-escaped data
  const templateHtml = beautifulPrescriptionTemplate({
    patientName: safeData.patientName,
    patientId: safeData.patientId,
    patientAge: safeData.patientAge,
    gender: safeData.gender,
    doctor: safeData.doctor,
    diagnosis: safeData.diagnosis,
    dateFormatted: safeData.dateFormatted,
    timeFormatted: safeData.timeFormatted,
    medicinesRows,
    medicinesCount: medicines.length,
  });

  return templateHtml;
}

function beautifulPrescriptionTemplate(data) {
  const safeData = data && typeof data === 'object'
    ? data
    : {};

  const replacements = {
    patientName: safeData.patientName || 'N/A',
    patientId: safeData.patientId || 'N/A',
    patientAge: safeData.patientAge || 'N/A',
    gender: safeData.gender || 'N/A',
    doctor: safeData.doctor || 'N/A',
    diagnosis: safeData.diagnosis || 'N/A',
    dateFormatted: safeData.dateFormatted || formatDate(new Date().toISOString().split('T')[0]),
    timeFormatted: safeData.timeFormatted || getCurrentTime(),
    medicinesRows: safeData.medicinesRows || '<tr><td colspan="4" class="table-cell empty">No medicines prescribed</td></tr>',
  };

  let template = getPrescriptionTemplateHtml();
  for (const [key, value] of Object.entries(replacements)) {
    template = template.split(`{{${key}}}`).join(value);
  }

  console.log('[PrescriptionPDF] 🧪 FINAL HTML AFTER REPLACEMENT:\n', template.slice(0, 500));

  return template;
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

    // 🔧 FIX 6: Ensure correct function flow
    console.log('[PrescriptionPDF] Generating HTML with generatePrescriptionHTML()...');
    let html = generatePrescriptionHTML(data);
    console.log('[PrescriptionPDF] HTML generated successfully');

    if (process.env.FORCE_PDF_TEMPLATE_TEST === '1') {
      html = "<h1 style='color:red;'>FORCE TEST TEMPLATE</h1>";
      console.log('[PrescriptionPDF] ⚠️ FORCE_PDF_TEMPLATE_TEST is enabled. Overriding html with FORCE TEST TEMPLATE.');
    }

    console.log('🚨 FINAL HTML SENT TO PUPPETEER:\n', html);

    // 🔧 FIX 7: Launch Puppeteer browser
    console.log('[PrescriptionPDF] Launching Puppeteer browser...');
    const executablePath = resolveBrowserExecutablePath();
    console.log('[PrescriptionPDF] Browser executable path:', executablePath || 'default Puppeteer browser');

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medtech-puppeteer-profile-'));

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      pipe: true,
      timeout: 120000,
      userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1024, height: 1440 });

    // 🔧 FIX 7: Use networkidle0 for better rendering
    console.log('[PrescriptionPDF] Setting HTML content...');
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });
    console.log('[PrescriptionPDF] HTML content rendered successfully');

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
      console.log(`[PrescriptionPDF] ✅ PDF saved to: ${outputPath}`);
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
    console.log('[PrescriptionPDF] ✅ PDF generated successfully - Buffer size:', pdfBuffer.length, 'bytes');
    return pdfBuffer;
  } catch (error) {
    console.error('[PrescriptionPDF] ❌ Error generating PDF:', error.message);
    console.error('[PrescriptionPDF] Stack trace:', error.stack);
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
  beautifulPrescriptionTemplate,
};
