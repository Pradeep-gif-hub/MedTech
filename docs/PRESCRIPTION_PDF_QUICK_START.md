# 🚀 Prescription PDF Generator - Quick Start Guide

## 5-Minute Setup

### Step 1: Install Puppeteer

```bash
cd healthconnect-backend
npm install
# This installs Puppeteer automatically (already added to package.json)
```

### Step 2: Start the Backend

```bash
npm start
# Server will start on port 8000 (or your PORT env var)
# You should see: [Prescription API] endpoints registered
```

### Step 3: Test the API

**In a new terminal:**

```bash
node test-prescription-pdf.js
```

This will run a comprehensive test suite checking:
- ✅ PDF generation with full data
- ✅ PDF generation with minimal data
- ✅ PDF with multiple medicines
- ✅ HTML preview
- ✅ XSS protection
- ✅ Error handling

### Step 4: Generate Your First Prescription

**Using cURL:**

```bash
curl -X POST http://localhost:8000/api/prescription/generate \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "John Doe",
    "patientId": "MED-2026-001",
    "patientAge": "35",
    "gender": "Male",
    "doctor": "Dr. Smith",
    "diagnosis": "High blood pressure - Stage 1",
    "medicines": [
      {
        "name": "Lisinopril",
        "dose": "10mg",
        "frequency": "Once daily",
        "duration": "30 days"
      }
    ]
  }' \
  --output prescription.pdf

# Open the PDF
open prescription.pdf  # macOS
# or
xdg-open prescription.pdf  # Linux
# or
start prescription.pdf  # Windows
```

**Using JavaScript/Node.js:**

```javascript
const http = require('http');

const data = JSON.stringify({
  patientName: "Jane Smith",
  patientId: "MED-2026-002",
  patientAge: "28",
  gender: "Female",
  doctor: "Dr. Johnson",
  diagnosis: "Fever and cough",
  medicines: [
    {
      name: "Paracetamol",
      dose: "500mg",
      frequency: "Twice daily",
      duration: "5 days"
    },
    {
      name: "Cough Syrup",
      dose: "2 teaspoons",
      frequency: "3 times daily",
      duration": "5 days"
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/api/prescription/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    require('fs').writeFileSync('prescription.pdf', buffer);
    console.log('✓ PDF saved as prescription.pdf');
  });
});

req.write(data);
req.end();
```

**Using Fetch (Frontend):**

```javascript
async function generatePrescription() {
  const prescriptionData = {
    patientName: "Alice Brown",
    patientId: "MED-2026-003",
    patientAge: "45",
    gender: "Female",
    doctor: "Dr. Williams",
    diagnosis: "Type 2 Diabetes Mellitus - well controlled",
    medicines: [
      {
        name: "Metformin",
        dose: "500mg",
        frequency: "Twice daily",
        duration": "Ongoing"
      }
    ]
  };

  const response = await fetch('http://localhost:8000/api/prescription/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prescriptionData)
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prescription.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
```

---

## 📚 Available Endpoints

### 1. Generate & Download PDF
```
POST /api/prescription/generate
Content-Type: application/json

Body: {
  "patientName": "Required",
  "doctor": "Required",
  "patientId": "Optional",
  "patientAge": "Optional",
  "gender": "Optional",
  "diagnosis": "Optional",
  "date": "Optional (YYYY-MM-DD)",
  "medicines": "Optional (array)"
}

Response: application/pdf (file download)
```

### 2. Preview HTML (for debugging)
```
POST /api/prescription/preview
Content-Type: application/json

Same body as /generate

Response: text/html (view in browser)
```

### 3. Get Sample Data
```
GET /api/prescription/sample

Response: {
  "success": true,
  "data": { ...sample prescription data... }
}
```

---

## 🎨 PDF Features

✅ **Professional Design**
- Hospital-grade branding with MedTech logo
- Blue-teal gradient header
- Clean card layout for patient/doctor info
- Structured diagnosis section
- Professional medicine table with zebra striping
- Authorized stamp and signature placeholder
- Footer with validity notice

✅ **Responsive Layout**
- A4 paper size (print-ready)
- Proper margins and spacing for printing
- Medical color scheme (blue, teal, green)
- Google Fonts (Poppins, Inter)

✅ **Data Handling**
- NO dummy/random values
- Missing fields show "N/A"
- XSS protection (HTML escaping)
- Supports unlimited medicines
- Proper date formatting

---

## 🐛 Troubleshooting

### "npm: command not found"
Install Node.js from https://nodejs.org/

### "Puppeteer not found after npm install"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Browser launch failed" on Linux
Install system dependencies:
```bash
sudo apt-get install -y chromium-browser
# or
sudo apt-get install -y fonts-liberation libappindicator3-1 libnss3
```

### "Port 8000 already in use"
Use a different port:
```bash
PORT=3001 npm start
```

### "PDF is blank or corrupted"
1. Test the HTML preview first:
   ```bash
   curl http://localhost:8000/api/prescription/preview ...
   ```
2. Check the console logs for `[PrescriptionPDF]` errors
3. Ensure all required fields are present

---

## 📋 Example: Complete Patient Prescription

```json
{
  "patientName": "Pradeep Awasthi",
  "patientId": "MED-2026-00032",
  "patientAge": "28",
  "gender": "Male",
  "doctor": "Dr. Sharma (MBBS, MD Internal Medicine)",
  "diagnosis": "Acute Viral Fever with mild respiratory symptoms. Patient has been experiencing high fever (101-102°F) for 3 days along with dry cough and throat pain. Clinical examination reveals no significant abnormalities. Respiratory rate normal. Patient advised to maintain hydration and rest.",
  "date": "2026-04-16",
  "medicines": [
    {
      "name": "Paracetamol",
      "dose": "500mg",
      "frequency": "Twice daily (morning & evening)",
      "duration": "5 days"
    },
    {
      "name": "Amoxicillin",
      "dose": "250mg",
      "frequency": "Three times daily (with meals)",
      "duration": "7 days"
    },
    {
      "name": "Cetirizine HCL",
      "dose": "10mg",
      "frequency": "Once at night (with dinner)",
      "duration": "5 days"
    },
    {
      "name": "Linctus Cough Syrup",
      "dose": "2 teaspoons",
      "frequency": "Three times daily (after meals)",
      "duration": "5 days"
    },
    {
      "name": "Multivitamin Tablet",
      "dose": "1 tablet",
      "frequency": "Once daily (with breakfast)",
      "duration": "15 days"
    }
  ]
}
```

---

## 🔧 Integration with Your App

### In Your Doctor Dashboard

```javascript
// When doctor clicks "Generate Prescription"
async function downloadDoctorPrescription(consultationId) {
  // Fetch consultation data from your backend
  const consultation = await fetch(`/api/consultations/${consultationId}`).then(r => r.json());

  // Prepare prescription data from consultation
  const prescriptionData = {
    patientName: consultation.patient.name,
    patientId: consultation.patient.id,
    patientAge: consultation.patient.age,
    gender: consultation.patient.gender,
    doctor: consultation.doctor.name,
    diagnosis: consultation.notes,
    date: consultation.date,
    medicines: consultation.medicines
  };

  // Generate and download PDF
  const response = await fetch('http://localhost:8000/api/prescription/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prescriptionData)
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prescription_${consultation.patient.name}.pdf`;
  a.click();
}
```

### In Your Patient Portal

```javascript
// Show prescription to patient after consultation
async function viewPrescription(prescriptionId) {
  const prescription = await fetch(`/api/prescriptions/${prescriptionId}`).then(r => r.json());

  // Generate HTML for viewing/printing
  const response = await fetch('http://localhost:8000/api/prescription/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prescription.data)
  });

  const html = await response.text();
  
  // Display in modal or new tab
  const modal = document.createElement('div');
  modal.innerHTML = html;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;overflow:auto;z-index:9999;background:rgba(0,0,0,0.5);padding:20px;';
  document.body.appendChild(modal);
}
```

---

## 📞 Next Steps

1. ✅ Install and test with `npm install && npm start && node test-prescription-pdf.js`
2. ✅ Check the generated PDFs
3. ✅ Integrate into your doctor/patient dashboard
4. ✅ Customize the stamp/branding if needed
5. ✅ Deploy to production when ready

---

## 📖 Full Documentation

See [PRESCRIPTION_PDF_GENERATOR.md](./docs/PRESCRIPTION_PDF_GENERATOR.md) for:
- Complete API reference
- All configuration options
- Production deployment guide
- Security best practices
- Integration examples
- Troubleshooting FAQs

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** April 16, 2026
