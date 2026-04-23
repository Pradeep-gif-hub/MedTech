import { useEffect, useState, useRef } from 'react';
import jsPDF from 'jspdf';
import { Home } from "lucide-react";
import html2canvas from 'html2canvas';
import { Video, User, FileText, Bell, Heart, Activity, Download, Phone, Star, Clock } from 'lucide-react';
import { useStoredUser } from '../hooks/useStoredUser';
import { buildApiUrl } from '../config/api';
import { useBackendProfile, getAuthHeaders } from '../hooks/useBackendProfile';

interface PatientDashboardProps { 
  onLogout: () => void;
  onNavigateToChatbot: () => void;
}
// sample vitals and data (replace with real API data)
const vitalSigns = {
  heartRate: 78,
  bloodPressure: '120/80',
  temperature: 98.6,
  oxygenLevel: 96,
};

const PatientDashboard = ({ onLogout, onNavigateToChatbot }: PatientDashboardProps) => {
  // normalize tab keys to lowercase ('home') because the rest of the file uses 'home'
  const [activeTab, setActiveTab] = useState('home' as 'home' | 'consultation' | 'profile' | 'prescriptions' | 'notifications');
  const [inConsultation, setInConsultation] = useState(false);

  // Prescriptions / PDF state
  const [serverPrescriptions, setServerPrescriptions] = useState([] as any[]);
  const [loadingServerPrescriptions, setLoadingServerPrescriptions] = useState(false);
  const [prescriptionSearch, setPrescriptionSearch] = useState('');
  const [prescriptionError, setPrescriptionError] = useState(null as string | null);
  const [notifications, setNotifications] = useState([] as any[]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [currentConsultation, setCurrentConsultation] = useState<any>(null);
  const [loadingConsultation, setLoadingConsultation] = useState(false);
  const [consultationError, setConsultationError] = useState<string | null>(null);
  const [assignedDoctor, setAssignedDoctor] = useState<any>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null as any);
  const [loadingPrescriptionDetails, setLoadingPrescriptionDetails] = useState(false);
  const [hrHistory, setHrHistory] = useState([vitalSigns.heartRate] as number[]);


  const [tempHistory, setTempHistory] = useState([vitalSigns.temperature] as number[]);

  const [oxHistory, setOxHistory] = useState([vitalSigns.oxygenLevel] as number[]);

  // Simulated live vitals
  const [liveHeartRate, setLiveHeartRate] = useState(72 as number);
  const [liveTemperature, setLiveTemperature] = useState(98.6 as number);
  const [liveOxygen, setLiveOxygen] = useState(98 as number);
  
  // Fetch user profile from backend
  const { profile, refreshProfile, loading: profileLoading } = useBackendProfile();

  // ============ CRITICAL: Refresh profile on component mount ============
  useEffect(() => {
    console.log('[PatientDashboard] Mounted, refreshing profile...');
    refreshProfile();
  }, []);

  // ============ CRITICAL: Listen for user-updated events to refresh profile ============
  useEffect(() => {
    const handleUserUpdated = () => {
      console.log('[PatientDashboard] User updated event received, refreshing profile...');
      refreshProfile();
    };
    window.addEventListener('user-updated', handleUserUpdated);
    return () => window.removeEventListener('user-updated', handleUserUpdated);
  }, [refreshProfile]);

  // WebRTC / signaling refs (patient = sender)
  const localVideoRef = useRef(null as HTMLVideoElement | null);
  const remoteVideoRef = useRef(null as HTMLVideoElement | null);
  const pcRef = useRef(null as RTCPeerConnection | null);
  const wsRef = useRef(null as WebSocket | null);
  const pendingSends = useRef([] as string[]);

  const buildWsUrl = (endpoint: string) => {
    // ===== DEBUG: Trace environment variables =====
    console.log('[WebSocket] ==== DEBUG TRACE ====');
    console.log('[WebSocket] VITE_WS_URL env:', import.meta.env.VITE_WS_URL);
    console.log('[WebSocket] VITE_API_URL env:', import.meta.env.VITE_API_URL);
    console.log('[WebSocket] DEV mode:', import.meta.env.DEV);
    console.log('[WebSocket] Full env keys:', Object.keys(import.meta.env).filter(k => k.includes('VITE')));

    // Use explicit WebSocket URL if provided
    const wsBaseUrl = import.meta.env.VITE_WS_URL;
    if (wsBaseUrl) {
      const finalUrl = `${wsBaseUrl}${endpoint}`;
      console.log('✅ [WebSocket] Using VITE_WS_URL:', wsBaseUrl);
      console.log('✅ [WebSocket] Final URL:', finalUrl);
      return finalUrl;
    }

    // Fallback: convert API URL to WebSocket URL
    console.warn('[WebSocket] ⚠️ VITE_WS_URL not set, converting from API URL');
    const httpUrl = buildApiUrl(endpoint);
    console.log('[WebSocket] Converted from API URL:', httpUrl);
    
    let wsUrl = httpUrl;
    if (httpUrl.startsWith('https://')) wsUrl = httpUrl.replace('https://', 'wss://');
    else if (httpUrl.startsWith('http://')) wsUrl = httpUrl.replace('http://', 'ws://');
    
    console.log('✅ [WebSocket] Final WS URL:', wsUrl);
    return wsUrl;
  };

  const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const normalizeMedicines = (rawMedicines: any): Array<{ name: string; dose: string; frequency: string; duration: string }> => {
    let list = rawMedicines;

    if (typeof list === 'string') {
      try {
        const parsed = JSON.parse(list);
        list = parsed;
      } catch {
        list = list
          .split('\n')
          .map((line: string) => line.trim())
          .filter(Boolean);
      }
    }

    if (!Array.isArray(list)) {
      list = list ? [list] : [];
    }

    return list
      .map((item: any) => {
        if (typeof item === 'string') {
          const parts = item.split('|').map((s: string) => s.trim());
          return {
            name: parts[0] || item,
            dose: parts[1] || '',
            frequency: parts[2] || '',
            duration: parts[3] || '',
          };
        }

        return {
          name: item?.name || item?.medicine || '',
          dose: item?.dose || item?.dosage || '',
          frequency: item?.frequency || '',
          duration: item?.duration || item?.days || '',
        };
      })
      .filter((med: any) => med.name);
  };

  const normalizePrescriptionApiPayload = (apiData: any, fallbackPrescription: any) => {
    const fallback = fallbackPrescription || {};
    const patient = apiData?.patient || {};
    const doctor = apiData?.doctor || {};
    const prescription = apiData?.prescription || {};

    const medicines = normalizeMedicines(apiData?.medicines ?? fallback.medicines ?? fallback.medications);

    return {
      ...fallback,
      id: prescription.id || fallback.id,
      fullname: patient.name || fallback.fullname || fallback.patient_name || '',
      patient: {
        id: patient.id || fallback.patient_id || userId || 'N/A',
        name: patient.name || fallback.fullname || fallback.patient_name || '',
        age: patient.age ?? fallback.patient_age ?? null,
        gender: patient.gender || fallback.patient_gender || '',
      },
      doctor_name: doctor.name || fallback.doctor_name || fallback.doctor?.name || fallback.doctor || '',
      doctor: {
        name: doctor.name || fallback.doctor_name || fallback.doctor?.name || fallback.doctor || '',
        specialization: doctor.specialization || fallback.doctor_specialization || '',
        hospital: doctor.hospital || doctor.hospital_name || fallback.hospital_name || '',
      },
      diagnosis: prescription.diagnosis || fallback.diagnosis || fallback.reason || '',
      reason: prescription.notes || prescription.diagnosis || fallback.reason || fallback.diagnosis || '',
      reportId: prescription.reportId || fallback.reportId || (prescription.id ? `RX-${prescription.id}` : ''),
      date: prescription.date || fallback.date || fallback.created_at || null,
      created_at: fallback.created_at || prescription.date || null,
      medicines,
      medications: medicines,
    };
  };

  const fetchPrescriptionById = async (prescriptionId: number | string, fallbackPrescription?: any, showErrorAlert = true) => {
    const response = await fetch(buildApiUrl(`/api/prescription/${encodeURIComponent(String(prescriptionId))}`), {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Prescription fetch failed (${response.status})`);
    }

    const payload = await response.json();
    const normalized = normalizePrescriptionApiPayload(payload, fallbackPrescription);

    if (!normalized.medicines.length && showErrorAlert) {
      alert('Prescription has no medicines in the latest data.');
    }

    return normalized;
  };

  // JSON export helper
  const generatePrescriptionJsonPdf = async (prescription: any) => {
    if (!prescription) { alert('No prescription'); return }
    const payload = JSON.stringify(prescription, null, 2);
    const html = `<div style="font-family:monospace;padding:16px;background:#fff"><pre>${escapeHtml(payload)}</pre></div>`;
    const temp = document.createElement('div'); temp.style.position = 'fixed'; temp.style.left = '-9999px'; temp.innerHTML = html; document.body.appendChild(temp);
    try {
      if ((document as any).fonts && (document as any).fonts.ready) await (document as any).fonts.ready;
      await new Promise(r => setTimeout(r, 120));
      const canvas = await (html2canvas as any)(temp, { useCORS: true, backgroundColor: '#fff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('portrait', 'pt', 'a4');
      const w = pdf.internal.pageSize.getWidth(); const h = pdf.internal.pageSize.getHeight();
      pdf.addImage(img, 'PNG', 0, 0, w, h);
      pdf.save(`prescription_json_${Date.now()}.pdf`);
    } catch (e) { console.error(e); alert('Failed to export'); } finally { temp.remove(); }
  };
   


  const formatIST = (date: any) => {
    if (!date) return "";
    try {
      const dateObj = new Date(date);
      // Use proper timezone conversion via Intl API
      const istFormatted = new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      }).format(dateObj);
      console.log('[formatIST] Input:', date, '-> Formatted IST:', istFormatted);
      return istFormatted;
    } catch (err) {
      console.error('[formatIST] Error:', err);
      return String(date);
    }
  };

  // Styled multi-page-aware PDF
  const handleDownloadPDF = async (prescription: any) => {
    if (!prescription) { alert('No prescription'); return }
    let livePrescription = prescription;
    if (prescription.id) {
      setLoadingPrescriptionDetails(true);
      try {
        livePrescription = await fetchPrescriptionById(prescription.id, prescription, false);
        setSelectedPrescription((prev: any) => (prev && prev.id === prescription.id ? livePrescription : prev));
      } catch (error) {
        console.error('Failed to fetch latest prescription for PDF', error);
        alert('Failed to fetch latest prescription data. Downloading last available data.');
      } finally {
        setLoadingPrescriptionDetails(false);
      }
    }

    const patientId = livePrescription?.patient?.id || livePrescription?.patient_id || userId || 'N/A';
    const patientName = livePrescription?.patient?.name || livePrescription?.fullname || '';
    const patientAge = livePrescription?.patient?.age;
    const patientGender = livePrescription?.patient?.gender || '';
    const doctorName = livePrescription?.doctor?.name || livePrescription?.doctor_name || livePrescription?.doctor || 'N/A';
    const doctorSpecialization = livePrescription?.doctor?.specialization || livePrescription?.doctor_specialization || 'N/A';
    const clinicName = livePrescription?.doctor?.hospital || livePrescription?.hospital_name || 'N/A';
    const reportId = livePrescription?.reportId || (livePrescription?.id ? `RX-${livePrescription.id}` : `RX-${patientId}-${Date.now().toString().slice(-4)}`);
    const diagnosisText = livePrescription?.diagnosis || livePrescription?.reason || 'No notes provided';
    const medicines = normalizeMedicines(livePrescription?.medicines ?? livePrescription?.medications);

const headerHTML = `
<div style="font-family:'Segoe UI',Roboto,Arial,sans-serif; padding:30px; width:760px; background:linear-gradient(to bottom,#f0f9ff,#ffffff); color:#0f172a; position:relative;">

  <!-- WATERMARK -->
  <div style="position:absolute; top:45%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); font-size:90px; color:rgba(0,0,0,0.03); font-weight:800;">
    MEDTECH
  </div>

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb); padding:20px; border-radius:14px; display:flex; justify-content:space-between; align-items:center; color:white; box-shadow:0 8px 25px rgba(0,0,0,0.15);">
    
    <div style="display:flex; align-items:center; gap:14px;">
      <div style="width:52px;height:52px;background:white;border-radius:14px;display:flex;align-items:center;justify-content:center;">
        <div style="width:26px;height:26px;background:#22c55e;border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;">+</div>
      </div>

      <div>
        <div style="font-size:22px;font-weight:700;">MedTech Clinic</div>
        <div style="font-size:12px;opacity:0.9;">Advanced Digital Healthcare Pvt. Ltd.</div>
      </div>
    </div>

    <div style="text-align:right;">
      <div style="font-size:12px;opacity:0.8;">Download Date (IST)</div>
      <div style="font-size:14px;font-weight:600;">
        ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </div>
    </div>

  </div>

  <!-- DETAILS TABLE -->
  <div style="margin-top:18px;background:white;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.08);">
    
    <table style="width:100%; border-collapse:collapse; font-size:13px;">

      <tbody>

        <tr>
          <td style="padding:12px; border:1px solid #e2e8f0; font-weight:600; color:#475569; width:25%;">Patient ID</td>
          <td style="padding:12px; border:1px solid #e2e8f0; width:25%;">${escapeHtml(patientId)}</td>

          <td style="padding:12px; border:1px solid #e2e8f0; font-weight:600; color:#475569; width:25%;">Doctor</td>
          <td style="padding:12px; border:1px solid #e2e8f0; width:25%;">${escapeHtml(doctorName)}</td>
        </tr>

        <tr style="background:#f8fafc;">
          <td style="padding:12px; border:1px solid #e2e8f0; font-weight:600; color:#475569;">Patient Name</td>
          <td style="padding:12px; border:1px solid #e2e8f0;">${escapeHtml(patientName || 'N/A')}</td>

          <td style="padding:12px; border:1px solid #e2e8f0; font-weight:600; color:#475569;">Date</td>
          <td style="padding:12px; border:1px solid #e2e8f0;">${escapeHtml(formatIST(livePrescription.created_at || livePrescription.date || Date.now()) || 'N/A')}</td>
        </tr>

        <tr>
          <td style="padding:12px; border:1px solid #e2e8f0; font-weight:600; color:#475569;">Report ID</td>
          <td style="padding:12px; border:1px solid #e2e8f0;">${escapeHtml(reportId)}</td>

          <td style="padding:12px; border:1px solid #e2e8f0; font-weight:600; color:#475569;">Department / Specialization</td>
          <td style="padding:12px; border:1px solid #e2e8f0;">${escapeHtml(doctorSpecialization)}</td>
        </tr>

        <tr style="background:#f8fafc;">
          <td style="padding:12px; border:1px solid #e2e8f0; font-weight:600; color:#475569;">Patient Age / Gender</td>
          <td style="padding:12px; border:1px solid #e2e8f0;">${escapeHtml(`${patientAge ?? 'N/A'} / ${patientGender || 'N/A'}`)}</td>

          <td style="padding:12px; border:1px solid #e2e8f0; font-weight:600; color:#475569;">Hospital / Clinic</td>
          <td style="padding:12px; border:1px solid #e2e8f0;">${escapeHtml(clinicName)}</td>
        </tr>

      </tbody>

    </table>

  </div>

  <!-- DIAGNOSIS -->
  <div style="margin-top:18px;background:white;padding:16px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <div style="font-size:16px;font-weight:600;margin-bottom:6px;">Diagnosis / Notes</div>
    <div style="font-size:13px;line-height:1.5;color:#334155;">
      ${escapeHtml((diagnosisText || 'No notes provided').toString())}
    </div>
  </div>

  <!-- MEDICINE TABLE -->
  <div style="margin-top:20px;background:white;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.08);">
    
    <div style="padding:12px 16px;font-weight:600;background:#e0f2fe;color:#0369a1;">
      Prescribed Medicines
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#2563eb;color:white;">
          <th style="padding:12px;text-align:left;">Medicine</th>
          <th style="padding:12px;">Dose</th>
          <th style="padding:12px;">Duration</th>
        </tr>
      </thead>

      <tbody>
        ${medicines.map(function(m, i){
          var bg = (i % 2 === 0) ? '#f8fafc' : '#ffffff';

          return '<tr style="background:'+bg+';">' +
            '<td style="padding:10px;border:1px solid #e2e8f0;font-weight:500;">'+escapeHtml(m.name || '')+'</td>' +
            '<td style="padding:10px;border:1px solid #e2e8f0;text-align:center;">'+escapeHtml(m.dose || '')+'</td>' +
            '<td style="padding:10px;border:1px solid #e2e8f0;text-align:center;">'+escapeHtml(m.duration || '')+'</td>' +
          '</tr>';
        }).join('') || '<tr><td colspan="4" style="padding:10px;border:1px solid #e2e8f0;text-align:center;">No medicines available</td></tr>'}
      </tbody>

    </table>
  </div>

  <!-- FOOTER -->
  <div style="margin-top:30px; display:flex; justify-content:space-between; align-items:center;">

    <div style="font-size:12px;color:#64748b;">
      Digitally generated prescription • No physical signature required
    </div>

    <div style="text-align:center;">
      <div style="width:140px;border-bottom:1px solid #000;margin-bottom:4px;"></div>
      <div style="font-size:11px;font-weight:600;">MedTech Pvt. Ltd.</div>
      <div style="font-size:10px;color:#64748b;">Authorized Medical Authority</div>
    </div>

    <div style="width:80px;height:80px;border-radius:50%;border:2px solid #22c55e;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#16a34a;font-size:11px;font-weight:700;">
      ✔ VERIFIED
    </div>

  </div>

</div>
`;
    const temp = document.createElement('div');
    temp.style.position = 'fixed'; temp.style.left = '-9999px'; temp.style.top = '0'; temp.style.width = '760px'; temp.style.background = '#fff'; temp.style.color = '#111'; temp.innerHTML = headerHTML; document.body.appendChild(temp);

    try {
      if ((document as any).fonts && (document as any).fonts.ready) await (document as any).fonts.ready;
      await new Promise(r => setTimeout(r, 120));
      const canvas = await (html2canvas as any)(temp, { useCORS: true, backgroundColor: '#fff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('portrait', 'pt', 'a4'); const pdfW = pdf.internal.pageSize.getWidth(); const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = canvas.width; const imgH = canvas.height; const pageCanvasHeight = Math.floor(imgW * (pdfH / pdfW));
      if (imgH <= pageCanvasHeight) { pdf.addImage(img, 'PNG', 0, 0, pdfW, pdfH); }
      else { let y = 0; while (y < imgH) { const slice = Math.min(pageCanvasHeight, imgH - y); const pageCanvas = document.createElement('canvas'); pageCanvas.width = imgW; pageCanvas.height = slice; const ctx = pageCanvas.getContext('2d')!; ctx.drawImage(canvas, 0, y, imgW, slice, 0, 0, imgW, slice); const pageData = pageCanvas.toDataURL('image/png'); pdf.addImage(pageData, 'PNG', 0, 0, pdfW, pdfH); y += slice; if (y < imgH) pdf.addPage(); } }
      const safeDate = (livePrescription.date || new Date().toISOString()).toString().replace(/[^a-zA-Z0-9_\-]/g, '_');
      const patientNameSafe = (livePrescription.fullname || 'patient')
  .toString()
  .replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`${patientNameSafe}_prescription_${safeDate}.pdf`);
    } catch (e) { console.error(e); alert('Failed to create PDF'); } finally { temp.remove(); }
  };

  // Fetch latest prescriptions (tries a few endpoints)
  const handleOpenLatestPrescription = async () => {
    if (!userId) { alert('Login required'); return }
    setLoadingServerPrescriptions(true);
    try {
      const baseUrl = buildApiUrl('');
      const urls = [`${baseUrl}/api/prescriptions/${userId}`, `${baseUrl}/api/prescriptions/patient/${userId}`, `${baseUrl}/api/prescriptions`];
      let list: any[] = [];
      for (const u of urls) { try { const r = await fetch(u); if (!r.ok) continue; const d = await r.json(); if (Array.isArray(d)) list = d; else if (d) list = [d]; if (list.length) break } catch (e) { } }
      setServerPrescriptions(list);
      if (list.length) { const latest = list.slice().sort((a: any, b: any) => (new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime()))[0]; setSelectedPrescription(latest); setShowPrescriptionModal(true); }
      else alert('No prescriptions');
    } catch (e) { console.error(e); alert('Error fetching prescriptions') } finally { setLoadingServerPrescriptions(false); }
  };

  // Simulated vitals updater
  useEffect(() => { let mounted = true; const tick = () => { if (!mounted) return; setLiveHeartRate((h: number) => Math.max(55, Math.min(110, h + Math.round((Math.random() * 2 - 1) * 3)))); setLiveTemperature((t: number) => Math.round((t + ((Math.random() * 2 - 1) * 0.2)) * 10) / 10); setLiveOxygen((o: number) => Math.max(90, Math.min(100, o + Math.round((Math.random() * 2 - 1) * 1)))); setTimeout(tick, 3000 + Math.floor(Math.random() * 1000)); }; const id = window.setTimeout(tick, 1000); return () => { mounted = false; clearTimeout(id); } }, []);

  const fetchCurrentConsultation = async () => {
    if (!userId) return null;

    setLoadingConsultation(true);
    try {
      const response = await fetch(buildApiUrl('/api/consultation/current'), {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setCurrentConsultation(null);
          setConsultationError(null);
          return null;
        }
        const errorText = await response.text();
        setConsultationError(`Failed to load consultation (${response.status})`);
        console.warn('Consultation fetch failed', response.status, errorText);
        return null;
      }

      const data = await response.json();
      console.log('Consultation:', data);
      if (!data || data.status === 'none') {
        setCurrentConsultation(null);
        setConsultationError(null);
        return null;
      }

      const normalized = {
        ...data,
        consultation_id: data.consultation_id || data.id,
        room_id: data.room_id || `consultation-${data.consultation_id || data.id}`,
      };

      setCurrentConsultation(normalized);
      setConsultationError(null);
      if (normalized.consultation_id) {
        localStorage.setItem('currentConsultationId', String(normalized.consultation_id));
      }
      return normalized;
    } catch (error) {
      console.error('Failed to fetch consultation', error);
      setConsultationError('Failed to load consultation status');
      return null;
    } finally {
      setLoadingConsultation(false);
    }
  };

  const fetchDoctorDetails = async (doctorId: number) => {
    setDoctorLoading(true);
    try {
      const response = await fetch(buildApiUrl(`/api/doctors/${doctorId}`), {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[PatientDashboard] Doctor details fetched:', data);
        setAssignedDoctor(data);
        // Update consultation with doctor details
        if (currentConsultation) {
          setCurrentConsultation((prev: any) => ({
            ...prev,
            doctor: data,
            doctor_name: data.full_name || data.name || prev?.doctor_name,
          }));
        }
        return data;
      } else {
        console.error('Failed to fetch doctor details:', response.status);
      }
    } catch (err) {
      console.error('[PatientDashboard] Error fetching doctor details:', err);
    } finally {
      setDoctorLoading(false);
    }
  };

  // Create consultation in backend database
  const createConsultationInBackend = async (inputConsultationData?: any) => {
    try {
      const consultationData = inputConsultationData || (() => {
        const pendingConsultationStr = localStorage.getItem('pendingConsultation');
        return pendingConsultationStr ? JSON.parse(pendingConsultationStr) : null;
      })();

      if (!consultationData) {
        console.log('No pending consultation found');
        return null;
      }

      const patientId = profile?.id;
      if (!patientId) {
        console.error('Patient ID not found');
        alert('Error: Patient ID not found');
        return null;
      }

      const condition = consultationData.disease || consultationData.condition;

      const response = await fetch(buildApiUrl('/api/consultations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          patient_id: patientId,
          patientId,
          disease: condition,
          condition,
          symptoms: consultationData.symptoms,
          duration: consultationData.duration,
          appointment_time: (() => { const now = new Date(); const istOffset = 5.5 * 60 * 60 * 1000; return new Date(now.getTime() + istOffset).toLocaleTimeString('en-IN'); })(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to create consultation:', error);
        setConsultationError(error.detail || error.message || 'Unknown error');
        alert(`Failed to create consultation: ${error.detail || error.message || 'Unknown error'}`);
        return null;
      }

      const result = await response.json();
      const normalized = {
        ...result,
        consultation_id: result.consultation_id || result.id,
        room_id: result.room_id || `consultation-${result.consultation_id || result.id}`,
      };
      console.log('Consultation:', normalized);

      setCurrentConsultation(normalized);
      setConsultationError(null);
      if (normalized.consultation_id) {
        localStorage.setItem('currentConsultationId', String(normalized.consultation_id));
      }

      return normalized;
    } catch (err) {
      console.error('Error creating consultation:', err);
      setConsultationError('Error submitting consultation to backend');
      alert('Error submitting consultation to backend');
      return null;
    }
  };

  // Start live as sender (patient)
  const startLiveSender = async () => {
    const consultation = currentConsultation?.consultation_id
      ? currentConsultation
      : await createConsultationInBackend();

    if (!consultation?.consultation_id) {
      alert('Submit consultation details first.');
      return;
    }

    if (!consultation?.doctor) {
      alert('Doctor is still being assigned. Please wait a moment.');
      return;
    }

    const roomId = consultation.room_id || `consultation-${consultation.consultation_id}`;

    try {
      const wsUrl = buildWsUrl(`/webrtc/ws/live-consultation/sender?roomId=${encodeURIComponent(roomId)}`);
      console.log('[WebRTC] Patient connecting to:', wsUrl);
      console.log('[WebRTC] Room ID:', roomId);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      const flushPending = () => {
        while (pendingSends.current.length && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = pendingSends.current.shift();
          if (message) wsRef.current.send(message);
        }
      };

      ws.onopen = () => {
        console.log('✅ WebSocket connected! Joining room:', roomId);
        ws.send(JSON.stringify({ type: 'join-room', roomId, role: 'patient' }));
        flushPending();
      };

      ws.onmessage = async (ev) => {
        try {
          const data = JSON.parse(ev.data);
          console.log('[WebRTC] Message received:', data.type);
          
          // Handle consultation/doctor data updates
          if (data.type === 'joined') {
            console.log('[WebRTC] Joined consultation room');
            if (currentConsultation?.doctor_id) {
              await fetchDoctorDetails(currentConsultation.doctor_id);
            }
            return;
          }
          
          if (data.type === 'doctor-assigned') {
            console.log('[WebRTC] Doctor assigned:', data.doctor);
            setAssignedDoctor(data.doctor);
            setCurrentConsultation((prev: any) => ({
              ...prev,
              doctor: data.doctor,
              doctor_id: data.doctor.id || data.doctor.user_id,
              doctor_name: data.doctor.full_name || data.doctor.name,
            }));
            return;
          }
          
          if (data.type === 'answer' && data.sdp) {
            await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
          } else if ((data.type === 'ice' || data.type === 'ice-candidate') && data.candidate) {
            try {
              await pcRef.current?.addIceCandidate(data.candidate);
            } catch {
              // Ignore late/malformed candidates.
            }
          }
        } catch (err) {
          console.error('WS msg parse error', err);
        }
      };

      ws.onclose = () => {
        console.log('⚠️ WebSocket closed');
      };
      
      ws.onerror = (e) => {
        console.error('❌ WebSocket ERROR:', e);
        console.error('[WebRTC] Failed to connect to:', wsUrl);
        alert('WebSocket connection failed. Check console and verify backend is running.');
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const message = JSON.stringify({ type: 'ice-candidate', candidate: event.candidate, roomId });
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(message);
          else pendingSends.current.push(message);
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => { });
        }
      };

      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: true 
        });
        console.log('[PatientDashboard] Got local media stream:', localStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch((err) => { 
            console.error('[PatientDashboard] Video play error:', err);
          });
        }
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      } catch (mediaErr) {
        console.error('[PatientDashboard] getUserMedia failed:', mediaErr);
        alert('Camera/microphone permission denied or not available. Please allow access and try again.');
        throw mediaErr;
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const offerMessage = JSON.stringify({ type: 'offer', sdp: pc.localDescription, roomId });
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(offerMessage);
      else pendingSends.current.push(offerMessage);

      setInConsultation(true);
    } catch (err) {
      console.error('startLiveSender failed', err);
      alert('Failed to start live consultation: ' + String(err));
    }
  };

  // End / cleanup live session
  const endLiveConsultation = () => {
    setInConsultation(false);
    try {
      wsRef.current?.close();
    } catch { }
    try {
      pcRef.current?.getSenders()?.forEach((s: RTCRtpSender) => { try { (s.track as MediaStreamTrack | null)?.stop(); } catch { } });
      pcRef.current?.close();
    } catch { }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const s = localVideoRef.current.srcObject as MediaStream;
      s.getTracks().forEach(t => t.stop());
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    pcRef.current = null;
    wsRef.current = null;
    pendingSends.current = [];
    // Keep users on Home; prescriptions should be menu-driven only.
    setActiveTab('home');
  };

  // Minimal profile save handler (was referenced from UI)
  const updateProfile = async () => {
    try {
      const payload = {
        name: fullName,
        role: profile?.role || sessionUser?.role || localStorage.getItem('role') || 'patient',
        age: dob ? Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : null,
        phone,
        dob,
        gender: Gender,
        bloodgroup: bloodGroup,
        emergency_contact: emergencyContact,
        allergy: allergies,
        allergies,
        medications,
        surgeries,
        abha_id: abhaId,
      };

      const res = await fetch(buildApiUrl('/api/users/update-profile'), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const updated = await res.json();
      setFullName(updated.name || fullName);
      setEmail(updated.email || email);
      setPhone(updated.phone || phone);
      setDob(updated.dob || dob);
      setGender(updated.gender || Gender);
      setBloodGroup(updated.bloodgroup || bloodGroup);
      setEmergencyContact(updated.emergency_contact || emergencyContact);
      setAllergies(updated.allergies || updated.allergy || allergies);
      setMedications(updated.medications || medications);
      setSurgeries(updated.surgeries || surgeries);
      setAbhaId(updated.abha_id || abhaId);

      window.dispatchEvent(new CustomEvent('user-updated', { detail: updated }));
      await refreshProfile();
      alert('Profile updated successfully.');
    } catch (e) {
      console.error('updateProfile error', e);
      alert('Failed to update profile.');
    }
  };

  // cleanup on unload
  useEffect(() => {
    const onUnload = () => {
      try { wsRef.current?.close(); } catch { }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('beforeunload', onUnload); endLiveConsultation(); };
  }, []);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [Gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  // Medical history state
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [abhaId, setAbhaId] = useState('');

  // Feedback form state
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedPrescriptionForFeedback, setSelectedPrescriptionForFeedback] = useState<any>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const userId = profile?.id ? String(profile.id) : '';

  // Logged-in user state (fetched from backend)
  const [userName, setUserName] = useState('' as string);

  const sessionUser = useStoredUser();

  const fetchPatientPrescriptions = async (searchKeyword?: string) => {
    const patientEmail = String(profile?.email || sessionUser?.email || email || '').trim();
    if (!patientEmail && !userId) return;
    setLoadingServerPrescriptions(true);
    setPrescriptionError(null);
    try {
      const escapedSearch = escapeHtml((searchKeyword ?? prescriptionSearch).trim());
      const queryParts = [] as string[];
      if (userId) {
        queryParts.push(`patientId=${encodeURIComponent(userId)}`);
      } else if (patientEmail) {
        queryParts.push(`patientEmail=${encodeURIComponent(patientEmail)}`);
      }
      if (escapedSearch) {
        queryParts.push(`search=${encodeURIComponent(escapedSearch)}`);
      }

      const response = await fetch(buildApiUrl(`/api/prescriptions?${queryParts.join('&')}`), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        console.warn('Prescription fetch failed', response.status);
        setPrescriptionError(`Failed to fetch prescriptions (${response.status})`);
        setServerPrescriptions([]);
        return;
      }
      const data = await response.json();
      console.log('Prescriptions:', data);
      const list = Array.isArray(data) ? data : Array.isArray(data?.prescriptions) ? data.prescriptions : [];
      if (Array.isArray(list)) {
        const sorted = list.slice().sort((a: any, b: any) => new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime());
        setServerPrescriptions(sorted);
      } else {
        setServerPrescriptions([]);
      }
    } catch (error) {
      console.error('Failed to fetch prescriptions', error);
      setPrescriptionError('Failed to fetch prescriptions');
      setServerPrescriptions([]);
    } finally {
      setLoadingServerPrescriptions(false);
    }
  };

  const fetchNotifications = async () => {
    if (!userId) return;
    setLoadingNotifications(true);
    try {
      const response = await fetch(buildApiUrl(`/api/notifications?userId=${encodeURIComponent(userId)}`), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const message = await response.text();
        console.warn('Notification fetch failed', response.status, message);
        setNotificationError(`Failed to load notifications (${response.status})`);
        setNotifications([]);
        return;
      }
      const data = await response.json();
      console.log('Notifications:', data);
      if (Array.isArray(data)) {
        const sorted = data.slice().sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setNotifications(sorted);
        setNotificationError(null);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      setNotificationError('Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchPatientPrescriptions();
    fetchNotifications();
    fetchCurrentConsultation();
    const interval = window.setInterval(() => {
      fetchPatientPrescriptions();
      fetchNotifications();
      fetchCurrentConsultation();
    }, 10000);
    return () => {
      window.clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || activeTab !== 'prescriptions') {
      return;
    }

    const timer = window.setTimeout(() => {
      fetchPatientPrescriptions(prescriptionSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [prescriptionSearch, activeTab, userId]);

  // Fetch doctor details when doctor is assigned to consultation
  useEffect(() => {
    if (inConsultation && currentConsultation?.doctor_id && !assignedDoctor) {
      console.log('[PatientDashboard] Fetching assigned doctor details:', currentConsultation.doctor_id);
      fetchDoctorDetails(currentConsultation.doctor_id);
    }
  }, [inConsultation, currentConsultation?.doctor_id]);

  const openPrescriptionPdf = (prescription: any) => {
    const url = prescription.pdf_url || buildApiUrl(`/api/prescriptions/pdf/${prescription.id}`);
    window.open(url, '_blank');
  };

  const handleViewNotification = (notification: any) => {
    setActiveTab('prescriptions');
    const match = serverPrescriptions.find((pres: any) => pres.id === notification.related_prescription_id);
    if (match) {
      setSelectedPrescription(match);
      setShowPrescriptionModal(true);
      if (match.id) {
        setLoadingPrescriptionDetails(true);
        fetchPrescriptionById(match.id, match)
          .then((latest) => setSelectedPrescription(latest))
          .catch((error) => {
            console.error('Failed to fetch prescription details', error);
            alert('Failed to fetch latest prescription details.');
          })
          .finally(() => setLoadingPrescriptionDetails(false));
      }
    }
  };

  const handleDeleteNotification = async (notificationId: number) => {
    if (!userId) return;
    const confirmed = window.confirm('Are you sure you want to delete this notification?');
    if (!confirmed) return;

    const previous = notifications;
    setNotifications((prev: any[]) => prev.filter((n: any) => n.id !== notificationId));

    try {
      const response = await fetch(
        buildApiUrl(`/api/notifications/${notificationId}?userId=${encodeURIComponent(userId)}`),
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }
    } catch (error) {
      console.error('Failed to delete notification', error);
      setNotifications(previous);
      alert('Failed to delete notification');
    }
  };

  const handleDeletePrescription = async (prescriptionId: number) => {
    if (!window.confirm('Are you sure you want to delete this prescription?')) return;
    try {
      const response = await fetch(buildApiUrl(`/api/prescriptions/${prescriptionId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        alert('Prescription deleted successfully');
        setShowPrescriptionModal(false);
        setSelectedPrescription(null);
        // Remove from notifications in parallel
        setNotifications(prev => prev.filter(n => n.related_prescription_id !== prescriptionId));
        await Promise.all([
          fetchPatientPrescriptions(),
          fetchNotifications()
        ]);
      } else {
        alert('Failed to delete prescription');
      }
    } catch (error) {
      alert('Error deleting prescription');
      console.error(error);
    }
  };

  const handleMarkPrescriptionRead = async (prescriptionId: number) => {
    try {
      const response = await fetch(buildApiUrl(`/api/prescriptions/${prescriptionId}/mark-read`), {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        alert('Prescription marked as read');
        // Remove from notifications in parallel
        setNotifications(prev => prev.filter(n => n.related_prescription_id !== prescriptionId));
        await Promise.all([
          fetchPatientPrescriptions(),
          fetchNotifications()
        ]);
      } else {
        alert('Failed to mark prescription as read');
      }
    } catch (error) {
      alert('Error marking prescription as read');
      console.error(error);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!serverPrescriptions.length) {
      alert('No prescriptions available to rate');
      return;
    }
    if (feedbackRating === 0) {
      alert('Please select a rating before submitting feedback');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const prescriptionId = serverPrescriptions[0].id;
      const response = await fetch(buildApiUrl('/api/analytics/feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          prescription_id: prescriptionId,
          rating: feedbackRating,
          feedback_text: feedbackText,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Feedback submitted successfully! Thank you for your feedback.');
        // Reset form
        setFeedbackRating(0);
        setFeedbackText('');
      } else {
        alert(`Failed to submit feedback: ${data.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      alert('Error submitting feedback: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleLocalLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.dispatchEvent(new CustomEvent('user-updated', { detail: null }));
    } catch {
      // no-op
    }
    onLogout();
  };

  // Keep profile state in sync with authenticated session profile.
  useEffect(() => {
    if (!sessionUser) return;
    try {
      const s: any = sessionUser;
      if (s.name || s.fullname || s.displayName) setFullName(s.name || s.fullname || s.displayName);
      if (s.email) setEmail(s.email);
      if (s.phone) setPhone(s.phone);
      if (s.dob || s.birthdate) setDob(s.dob || s.birthdate);
      if (s.gender) setGender(s.gender);
      if (s.bloodgroup || s.bloodGroup) setBloodGroup(s.bloodgroup || s.bloodGroup);
      if (s.emergencyContact) setEmergencyContact(s.emergencyContact);
      if (typeof s.allergies === 'string' && s.allergies) setAllergies(s.allergies);
      if (typeof s.medications === 'string' && s.medications) setMedications(s.medications);
      if (typeof s.abha_id === 'string') setAbhaId(s.abha_id);
      if (typeof s.abhaId === 'string') setAbhaId(s.abhaId);
    } catch (err) {
      // ignore mapping errors
    }
  }, [sessionUser]);

  // Fetch user info from backend profile endpoint.
  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        const res = await fetch(buildApiUrl('/api/users/me'), {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (!res.ok) {
          return;
        }

        const response = await res.json();
        const data = response.user || response;
        
        if (!data || !mounted) {
          return;
        }

        const name = data.name || data.fullname || data.full_name || data.username || data.email || '';
        if (name) {
          setUserName(name);
        }
        if (data.name) setFullName(data.name);
        if (data.email) setEmail(data.email);
        if (typeof data.allergies === 'string') setAllergies(data.allergies || '');
        if (typeof data.medications === 'string') setMedications(data.medications || '');
        if (typeof data.surgeries === 'string') setSurgeries(data.surgeries || '');
        if (data.gender) setGender(data.gender);
        if (data.dob) setDob(data.dob);
        if (data.bloodgroup) setBloodGroup(data.bloodgroup);
        if (data.phone) setPhone(data.phone);
        if (data.emergency_contact) setEmergencyContact(data.emergency_contact);
        if (data.abha_id) setAbhaId(data.abha_id);
        if (data.abhaId) setAbhaId(data.abhaId);
      } catch (e) {
        // ignore and keep current state
      }
    };
    fetchUser();
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (profile.name) setFullName(profile.name);
    if (profile.email) setEmail(profile.email);
    if (profile.phone) setPhone(profile.phone);
    if (profile.dob) setDob(profile.dob);
    if (profile.gender) setGender(profile.gender);
    if (profile.bloodgroup) setBloodGroup(profile.bloodgroup);
    if (profile.emergency_contact) setEmergencyContact(profile.emergency_contact);
    if (profile.allergies) setAllergies(profile.allergies);
    if (profile.medications) setMedications(profile.medications);
    if (profile.surgeries) setSurgeries(profile.surgeries);
    if (profile.abha_id) setAbhaId(profile.abha_id);
    if (profile.abhaId) setAbhaId(profile.abhaId);
  }, [profile]);

  // NEW: represent blood pressure as systolic/diastolic so it can vary smoothly
  const parseBP = (bp: string) => {
    const m = String(bp).match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return { sys: 120, dia: 80 };
    return { sys: Number(m[1]), dia: Number(m[2]) };
  };
  const initialBP = parseBP(vitalSigns.bloodPressure);
  const [liveBP, setLiveBP] = useState(initialBP as { sys: number; dia: number });
  const [bpHistory, setBpHistory] = useState([`${initialBP.sys}/${initialBP.dia}`] as string[]);

  const [liveLDR, setLiveLDR] = useState(null as number | null);
  const [ldrHistory, setLdrHistory] = useState([] as number[]);

  // Helper to produce a smooth next value given previous value
  function nextValue(prev: number, min: number, max: number, variance = 2) {
    const change = (Math.random() * 2 - 1) * variance; // -variance..+variance
    let next = Math.round(prev + change);
    if (next < min) next = min;
    if (next > max) next = max;
    return next;
  }



  // Replace the consultation renderer with a richer, doctor-like UI but for the patient
  const renderHome = () => (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 items-start overflow-x-hidden">
      {/* LEFT HALF - Info */}
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 sm:col-start-1 sm:col-span-1">

        {/* Existing Profile Card */}
        <div className="bg-emerald-50 rounded-lg sm:rounded-xl lg:rounded-2xl shadow-md p-3 sm:p-4 lg:p-6">
          {/* Compact Modern Profile Card */}
          <div className="flex justify-center mt-4 sm:mt-5 lg:mt-6">
<div className="relative bg-gradient-to-br from-blue-50 via-blue-100 to-white rounded-2xl sm:rounded-3xl shadow-xl p-3 sm:p-4 lg:p-5 w-full max-w-sm sm:max-w-md transform transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl">

              {/* Header - Profile Image + Name */}
              <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6 lg:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full overflow-hidden border-4 border-emerald-300 shadow-lg transform transition-transform duration-300 hover:scale-105 flex-shrink-0">
                  <img
                    src={profile?.avatar || profile?.picture || profile?.profile_picture_url || sessionUser?.avatar || sessionUser?.picture || sessionUser?.profile_picture_url || '/default-avatar.png'}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-emerald-900">
                    <p className="text-xs sm:text-sm opacity-500 font-normal">{profile?.name || sessionUser?.name || 'Patient'}</p>
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">{email || 'No email provided'}</p>
                  <p className="text-xs text-emerald-700 mt-1 font-medium hidden sm:block">Your Health Summary</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5 lg:gap-3 mb-3 sm:mb-5 lg:mb-6 text-xs sm:text-sm">
                {/* Age */}
                <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3 shadow hover:shadow-lg flex items-center gap-2 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0">
                    🎂
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-gray-800">Age</div>
                    <div className="text-gray-500 font-medium text-xs sm:text-sm truncate">
                      {dob ? Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : '—'}
                    </div>
                  </div>
                </div>

                {/* Gender (dynamic from signedUser/localStorage) */}
                <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3 shadow hover:shadow-lg flex items-center gap-2 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0">
                    ⚥
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-gray-800">Gender</div>
                    <div className="text-gray-500 font-medium text-xs sm:text-sm truncate">{Gender || '—'}</div>
                  </div>
                </div>

                {/* Blood Group */}
                <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3 shadow hover:shadow-lg flex items-center gap-2 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0">
                    🩸
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-gray-800">Blood Group</div>
                    <div className="text-gray-500 font-medium text-xs sm:text-sm truncate">{bloodGroup || '—'}</div>
                  </div>
                </div>

                {/* DOB */}
                <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3 shadow hover:shadow-lg flex items-center gap-2 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0">
                    📅
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-gray-800">Date of Birth</div>
                    <div className="text-gray-500 font-medium text-xs sm:text-sm truncate">{dob || '—'}</div>
                  </div>
                </div>

                {/* Phone */}
                <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3 shadow hover:shadow-lg flex items-center gap-2 cursor-pointer col-span-1 md:col-span-2">
                  <div className="bg-emerald-100 text-emerald-700 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0">
                    📞
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-gray-800">Phone</div>
                    <div className="text-gray-500 font-medium text-xs sm:text-sm truncate">{phone || '—'}</div>
                  </div>
                </div>
              </div>

              {/* ABHA ID */}
            <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3 shadow hover:shadow-lg flex items-center gap-2 cursor-pointer col-span-1 md:col-span-2">
            <div className="bg-emerald-100 text-emerald-700 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0">
             🏥
             </div>
 
             <div className="min-w-0">
             <div className="text-xs sm:text-sm font-bold text-gray-800">ABHA ID</div>
             <div className="text-gray-500 font-medium text-xs sm:text-sm truncate">
             {abhaId || '—'}
            </div>
           </div>
           </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-3 sm:mt-4 lg:mt-5">
                <button
                  onClick={() => setActiveTab('profile')}
                  className="px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-bold shadow hover:bg-emerald-700 transform hover:-translate-y-0.5 transition-all"
                >
                  View Profile
                </button>

              </div>

            </div>
          </div>
        </div>

      </div>
      {/* RIGHT HALF - Form */}
      <div className="bg-gray-50 rounded-lg sm:rounded-xl lg:rounded-2xl shadow-md p-3 sm:p-4 lg:p-6 sm:col-start-2 sm:col-span-1 self-start">
        <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-4 sm:mb-5 lg:mb-6">
          Consultation Form
        </h3>
        <div className="space-y-3 sm:space-y-4 lg:space-y-5">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              Select Disease
            </label>
            <select
              id="diseaseSelect"  // added ID here
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-black text-xs sm:text-sm"
            >
              <option value="">Select the Disease</option>
              <option>Fever</option>
              <option>Cold</option>
              <option>Flu</option>
              <option>Cardiac Arrest</option>
              <option>Cardiomyopathy</option>
              <option>Heart Attack</option>
              <option>Arrhythmia</option>
              <option>Hypertension</option>
              <option>Angina</option>
              <option>Heart Block</option>
              <option>Valve Disease</option>
              <option>Asthma</option>
              <option>COPD</option>
              <option>Pneumonia</option>
              <option>Bronchitis</option>
              <option>Respiratory Failure</option>
              <option>Respiratory Infection</option>
              <option>Lung Disease</option>
              <option>Shortness of Breath</option>
              <option>Migraine</option>
              <option>Epilepsy</option>
              <option>Stroke</option>
              <option>Parkinson</option>
              <option>Alzheimer</option>
              <option>Neuropathy</option>
              <option>Neurological Disorder</option>
              <option>Neuralgic Pain</option>
              <option>Dermatitis</option>
              <option>Eczema</option>
              <option>Psoriasis</option>
              <option>Acne</option>
              <option>Fungal Infection</option>
              <option>Skin Allergy</option>
              <option>Rash</option>
              <option>Skin Disorders</option>
              <option>Dermatological Issue</option>
              <option>General Checkup</option>
              <option>Infection</option>
              <option>Weakness</option>
              <option>Fatigue</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symptoms
            </label>
            <textarea
              id="symptomsTextarea"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-20 text-black"
              placeholder="Describe your symptoms..."
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration of Illness
            </label>
            <input
              id="durationInput"
              type="text"
              placeholder="e.g. 2 weeks"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
            />
          </div>

          <button
            type="button"
            onClick={async () => {
              // Get form values
              const diseaseSelect = document.getElementById('diseaseSelect') as HTMLSelectElement;
              const symptomsTextarea = document.getElementById('symptomsTextarea') as HTMLTextAreaElement;
              const durationInput = document.getElementById('durationInput') as HTMLInputElement;
              
              // Validate form
              if (!diseaseSelect.value) {
                alert('Please select a disease');
                return;
              }
              if (!symptomsTextarea.value) {
                alert('Please describe your symptoms');
                return;
              }
              if (!durationInput.value) {
                alert('Please enter illness duration');
                return;
              }

              // Store consultation data in localStorage for persistence
              const consultationData = {
                disease: diseaseSelect.value,
                symptoms: symptomsTextarea.value,
                duration: durationInput.value,
                timestamp: new Date().toISOString()
              };
              localStorage.setItem('pendingConsultation', JSON.stringify(consultationData));

              const createdConsultation = await createConsultationInBackend(consultationData);
              if (!createdConsultation) {
                return;
              }

              await fetchCurrentConsultation();
              
              // Switch to consultation tab
              setActiveTab('consultation');
            }}
            className="w-full bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Submit Consultation
          </button>
        </div>
      </div>
    </div>
  );

  const renderConsultation = () => (
    <div className="bg-slate-950 rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-sm overflow-hidden p-2 sm:p-3 lg:p-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
        {/* LEFT: Doctor's video / placeholder */}
        <div className="p-2 sm:p-3 lg:p-4 bg-white rounded-lg sm:rounded-2xl lg:rounded-3xl shadow-lg lg:shadow-xl border border-gray-200">
          <div className="bg-gray-50 rounded-lg sm:rounded-xl lg:rounded-2xl relative flex items-center justify-center overflow-hidden h-64 sm:h-80 md:h-96 lg:h-[430px] aspect-video sm:aspect-auto">
            {inConsultation ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-xl bg-gray-200"
                />
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
                {(() => {
                  // Get pending consultation data
                  const pendingConsultationStr = localStorage.getItem('pendingConsultation');
                  const pendingConsultation = pendingConsultationStr ? JSON.parse(pendingConsultationStr) : null;
                  const consultationPreview = pendingConsultation || (currentConsultation ? {
                    disease: currentConsultation.condition,
                    symptoms: currentConsultation.symptoms,
                    duration: currentConsultation.duration,
                    timestamp: currentConsultation.created_at,
                  } : null);

                  return consultationPreview ? (
<div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg sm:rounded-2xl lg:rounded-3xl shadow-lg border border-gray-200 w-full max-w-xs sm:max-w-sm lg:max-w-md">
                      <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-3 sm:mb-4 lg:mb-6 text-gray-900">Your Consultation Request</h3>
                      
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <div className="text-xs sm:text-sm text-gray-600">Condition</div>
                          <div className="text-sm sm:text-base text-gray-900 font-medium">{consultationPreview.disease || 'Not provided'}</div>
                        </div>
                        
                        <div>
                          <div className="text-xs sm:text-sm text-gray-600">Symptoms</div>
                          <div className="text-sm sm:text-base text-gray-900 font-medium">{consultationPreview.symptoms || 'Not provided'}</div>
                        </div>
                        
                        <div>
                          <div className="text-xs sm:text-sm text-gray-600">Duration</div>
                          <div className="text-sm sm:text-base text-gray-900 font-medium">{consultationPreview.duration || 'Not provided'}</div>
                        </div>

                        <div className="text-xs sm:text-sm text-gray-600 pt-2">
                          Submitted on: {consultationPreview.timestamp ? formatIST(consultationPreview.timestamp) : 'Unknown'}
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-5 lg:mt-6 text-center text-xs sm:text-sm text-gray-600">
                        {loadingConsultation
                          ? 'Looking for available doctor...'
                          : currentConsultation?.doctor
                            ? `Doctor assigned: ${currentConsultation.doctor.name}`
                            : 'Waiting for doctor assignment...'}
                        <div className="mt-2">
                          <div className="animate-pulse inline-block w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                          <div className="animate-pulse inline-block w-2 h-2 bg-green-400 rounded-full mr-1" style={{animationDelay: '0.2s'}}></div>
                          <div className="animate-pulse inline-block w-2 h-2 bg-green-400 rounded-full" style={{animationDelay: '0.4s'}}></div>
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-5 lg:mt-6">
                        <button
                          onClick={startLiveSender}
                          disabled={loadingConsultation || !currentConsultation?.doctor}
                          className="inline-flex items-center justify-center gap-2 sm:gap-3 bg-emerald-600 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold shadow hover:bg-emerald-700 transition-all w-full disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Video className="h-4 w-4 sm:h-5 sm:w-5" />
                          {currentConsultation?.doctor ? 'Start Video Consultation' : 'Waiting for Doctor Assignment'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <svg
                        className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 text-gray-400 animate-spin mb-3 sm:mb-4 lg:mb-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          strokeOpacity="0.12"
                          strokeWidth="2"
                        />
                        <path
                          d="M21 12a9 9 0 10-3.78 7.02"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="text-base sm:text-lg lg:text-xl font-semibold mb-2 sm:mb-3 lg:mb-4 text-gray-900">
                        No Active Consultation
                      </div>
                      <div className="text-xs sm:text-sm opacity-80 mb-4 sm:mb-6 text-center">
                        Please fill out the consultation form on the home page
                      </div>
                      <button
                        onClick={() => setActiveTab('home')}
                        className="inline-flex items-center gap-2 sm:gap-3 bg-emerald-600 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold shadow hover:bg-emerald-700 transition-all"
                      >
                        <Home className="h-4 w-4 sm:h-5 sm:w-5" />
                        Go to Home
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Doctor Info / Live Vitals */}
        <div className="p-2 sm:p-3 lg:p-4">
          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg sm:rounded-2xl lg:rounded-3xl min-h-96 sm:min-h-[420px] flex flex-col justify-between shadow-lg border border-gray-200">
            <div className="flex-1">
              {!inConsultation ? (
                <>
                  <h3 className="font-bold text-gray-900 mb-4 sm:mb-6 text-base sm:text-lg lg:text-2xl">Doctor Information</h3>
                  {loadingConsultation ? (
                    <div className="bg-gray-50 p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-2xl lg:rounded-3xl border border-gray-200 shadow-md text-xs sm:text-sm text-gray-600">
                      Finding a matching doctor based on your condition...
                    </div>
                  ) : currentConsultation?.doctor ? (
                    <div className="bg-gray-50 p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-2xl lg:rounded-3xl border border-gray-200 shadow-md">
                      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white text-lg sm:text-xl font-semibold shadow-lg flex-shrink-0">
                          {currentConsultation.doctor.avatar ? (
                            <img
                              src={currentConsultation.doctor.avatar}
                              alt={currentConsultation.doctor.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>DR</span>
                          )}
                        </div>
                        <div className="flex-1 w-full">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg mb-1">{currentConsultation.doctor.name}</h3>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2 sm:mb-3">
                            <span className="px-2 sm:px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs sm:text-sm font-medium">
                              {currentConsultation.doctor.specialization || 'General Medicine'}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 flex items-center gap-2">
                            Assigned based on your consultation condition
                          </div>
                          <p className="text-xs sm:text-sm text-gray-700 bg-white p-2 sm:p-3 rounded-lg border border-gray-200">
                            Consultation status: {currentConsultation.status || 'assigned'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-2xl lg:rounded-3xl border border-gray-200 shadow-md text-xs sm:text-sm text-gray-600">
                      {consultationError || 'Submit consultation details to get an assigned doctor.'}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="font-bold text-gray-800 mb-4 sm:mb-6 text-base sm:text-lg lg:text-2xl text-center bg-white/90 py-2 sm:py-3 lg:py-4 rounded-lg shadow-sm">Live Vitals Monitor</h3>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 px-2 sm:px-4">
                    {/* Heart Rate Card */}
                    <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl border-2 border-red-500 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="p-1.5 sm:p-2 bg-red-500 rounded-full flex-shrink-0">
                            <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-gray-900">Heart Rate</span>
                        </div>
                        <span className="text-xs font-bold bg-red-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full flex-shrink-0">BPM</span>
                      </div>
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 ml-2 flex items-baseline gap-2">
                        {liveHeartRate}
                        <div className="flex gap-1">
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full animate-pulse delay-100"></div>
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full animate-pulse delay-200"></div>
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full animate-pulse delay-300"></div>
                        </div>
                      </div>
                    </div>

                    {/* Blood Pressure Card */}
                    <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl border-2 border-blue-500 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="p-1.5 sm:p-2 bg-blue-500 rounded-full flex-shrink-0">
                            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-gray-900">Blood Pressure</span>
                        </div>
                        <span className="text-xs font-bold bg-blue-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full flex-shrink-0">mmHg</span>
                      </div>
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 ml-2 flex items-baseline gap-2">
                        {liveBP.sys}/{liveBP.dia}
                        <div className="flex gap-1">
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-pulse delay-100"></div>
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-pulse delay-200"></div>
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-pulse delay-300"></div>
                        </div>
                      </div>
                    </div>

                    {/* Temperature Card */}
                    <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl border-2 border-amber-500 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="p-2 bg-amber-500 rounded-full">
                            <Clock className="h-5 w-5 text-white" />
                          </span>
                          <span className="text-base font-semibold text-gray-900">Temperature</span>
                        </div>
                        <span className="text-xs font-bold bg-amber-500 text-white px-3 py-1 rounded-full">°F</span>
                      </div>
                      <div className="text-4xl font-bold text-gray-900 ml-2 flex items-baseline gap-2">
                        {liveTemperature.toFixed(1)}
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse delay-100"></div>
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse delay-200"></div>
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse delay-300"></div>
                        </div>
                      </div>
                    </div>

                    {/* SpO₂ Card */}
                    <div className="bg-white p-5 rounded-xl border-2 border-emerald-500 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="p-2 bg-emerald-500 rounded-full">
                            <Activity className="h-5 w-5 text-white" />
                          </span>
                          <span className="text-base font-semibold text-gray-900">Oxygen Saturation</span>
                        </div>
                        <span className="text-xs font-bold bg-emerald-500 text-white px-3 py-1 rounded-full">%</span>
                      </div>
                      <div className="text-4xl font-bold text-gray-900 ml-2 flex items-baseline gap-2">
                        {liveOxygen}
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse delay-100"></div>
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse delay-200"></div>
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse delay-300"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 text-right">
              {!inConsultation ? (
                <button
                  onClick={startLiveSender}
                  disabled={loadingConsultation || !currentConsultation?.doctor}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-lg text-sm font-semibold shadow-lg hover:bg-emerald-700 transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Video className="h-5 w-5" />
                  {currentConsultation?.doctor ? 'Start Consultation' : 'Waiting for Assignment'}
                </button>
              ) : (
                <button
                  onClick={endLiveConsultation}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg text-sm font-semibold shadow-lg hover:bg-red-700 transition-all inline-flex items-center gap-2"
                >
                  <Phone className="h-5 w-5" />
                  End Call
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
  type="tel"
  value={phone}
  onChange={(e) => {
    const value = e.target.value.replace(/\D/g, ""); // remove non-digits
    if (value.length <= 10) {
      setPhone(value);
    }
  }}
  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
            >
              <option>A+</option>
              <option>B+</option>
              <option>O+</option>
              <option>AB+</option>
              <option>AB-</option>
              <option>O-</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact</label>
            <input
              type="tel"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Abha-ID</label>
            <input
              type="tel"
              value={abhaId}
              onChange={(e) => setAbhaId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
            />
          </div>
         <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
              value={Gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option>Male</option>
              <option>Female</option>
              <option>Others</option>
            </select>
          </div>
          <div></div>
        </div>
        <button onClick={updateProfile} className="mt-6 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
          Update Profile
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Medical History</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-20 text-black"
              placeholder="List any known allergies..."
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            ></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Medications</label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-20 text-black"
              placeholder="List current medications..."
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
            ></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Previous Surgeries</label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-20 text-black"
              placeholder="List any previous surgeries..."
              value={surgeries}
              onChange={(e) => setSurgeries(e.target.value)}
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPrescriptions = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Digital Prescriptions</h2>
            <p className="text-sm text-gray-500">Latest prescriptions from your doctor.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={prescriptionSearch}
              onChange={(e) => setPrescriptionSearch(e.target.value)}
              placeholder="Search by patient, doctor, or date"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => fetchPatientPrescriptions(prescriptionSearch)}
             className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transform hover:-translate-y-0.5 transition-all"
            >
              Refresh
            </button>
          </div>
        </div>

        {loadingServerPrescriptions ? (
          <div className="text-gray-600">Loading prescriptions...</div>
        ) : prescriptionError ? (
          <div className="text-red-600">{prescriptionError}</div>
        ) : serverPrescriptions.length === 0 ? (
          <div className="text-gray-600">No prescriptions found.</div>
        ) : (
          <div className="space-y-4">
            {serverPrescriptions.map((prescription, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">Prescribed by {prescription.doctor_name || prescription.doctor?.name || prescription.doctor || 'Dr. Unknown'}</h3>
                    <p>{formatIST(prescription.created_at || prescription.date)}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-800">Newest</span>
                </div>
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Medicines</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {(prescription.medicines || prescription.medications || []).map((medicine: any, i: number) => (
                      <li key={i} className="text-gray-600">
                        {typeof medicine === 'string' ? medicine : `${medicine.name || medicine.medicine || ''} ${medicine.dosage || medicine.dose || ''} ${medicine.duration || medicine.days || ''}`.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedPrescription(prescription);
                      setShowPrescriptionModal(true);
                      if (prescription.id) {
                        setLoadingPrescriptionDetails(true);
                        fetchPrescriptionById(prescription.id, prescription)
                          .then((latest) => setSelectedPrescription(latest))
                          .catch((error) => {
                            console.error('Failed to fetch prescription details', error);
                            alert('Failed to fetch latest prescription details.');
                          })
                          .finally(() => setLoadingPrescriptionDetails(false));
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transform hover:-translate-y-0.5 transition-all"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Notifications</h2>
            <p className="text-sm text-gray-500">Alerts from your care team.</p>
          </div>
          <button
            type="button"
            onClick={fetchNotifications}
             className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transform hover:-translate-y-0.5 transition-all"
          >
            Refresh
          </button>
        </div>

        {loadingNotifications ? (
          <div className="text-gray-600">Loading notifications...</div>
        ) : notificationError ? (
          <div className="text-red-600">{notificationError}</div>
        ) : notifications.length === 0 ? (
          <div className="text-gray-600">No new notifications for your account.</div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification: any) => (
              <div
                key={notification.id || `${notification.related_prescription_id}-${notification.created_at}`}
                className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{notification.message}</p>
                    <p className="text-sm text-gray-500 mt-2">{formatIST(notification.created_at || Date.now())}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleViewNotification(notification)}
                      className="text-xs text-emerald-700 font-semibold hover:text-emerald-800"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNotification(notification.id)}
                      className="text-xs text-red-600 font-semibold hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Share Your Feedback</h2>
        
        {serverPrescriptions.length > 0 ? (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitFeedback();
            }}
            className="space-y-6"
          >
            {/* Prescription Info */}
            <div className="border-l-4 border-emerald-500 pl-4 py-2 bg-emerald-50 rounded">
              <p className="text-sm text-gray-600">You are rating:</p>
              <p className="font-semibold text-gray-900">Dr. {serverPrescriptions[0].doctor_name || 'Your Doctor'}</p>
              <p className="text-xs text-gray-500 mt-1">Prescription Date: {formatIST(serverPrescriptions[0].created_at || Date.now())}</p>
            </div>

            {/* Rating Stars */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">How satisfied are you with this prescription?</label>
              <div className="flex items-center space-x-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className={`transition-all hover:scale-125 ${
                      star <= feedbackRating ? 'text-yellow-400 scale-110' : 'text-gray-300 hover:text-yellow-300'
                    }`}
                    title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                  >
                    <Star className="h-10 w-10 fill-current" />
                  </button>
                ))}
              </div>
              <div className="mt-2">
                {feedbackRating > 0 && (
                  <p className="text-sm font-medium text-emerald-600">
                    ★ {feedbackRating === 1 ? 'Poor' : feedbackRating === 2 ? 'Fair' : feedbackRating === 3 ? 'Good' : feedbackRating === 4 ? 'Very Good' : 'Excellent'}
                  </p>
                )}
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <label htmlFor="feedback-text" className="block text-sm font-semibold text-gray-900 mb-2">
                Tell us more (optional)
              </label>
              <textarea
                id="feedback-text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg h-24 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors"
                placeholder="Share your experience with this prescription..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submittingFeedback || feedbackRating === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedbackRating(0);
                  setFeedbackText('');
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Helper Text */}
            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
              💡 Your feedback helps doctors improve their service. All feedback is sent to the doctor's analytics dashboard.
            </p>
          </form>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-2">No prescriptions to rate yet</p>
            <p className="text-sm text-gray-500">Once you receive a prescription, you'll be able to share your feedback here.</p>
          </div>
        )}
      </div>
    </div>
  );
  // Replace top-level layout (header + nav + main) to Doctor-like theme
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1220] to-[#0b2537] text-white">
      {/* Loading Spinner - Show while profile is loading */}
      {profileLoading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="inline-block">
              <div className="w-16 h-16 border-4 border-purple-400/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
            </div>
            <p className="text-white/90 font-semibold text-lg">Loading Dashboard...</p>
            <p className="text-white/60 text-sm mt-2">Fetching your profile and data</p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-gradient-to-r from-[#7c3aed] to-[#ec4899] shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/10 rounded-full">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Patient Dashboard</h1>
              <p className="text-sm opacity-80">{sessionUser ? `Welcome back, ${sessionUser.name || 'Patient'} !! ` : 'Welcome back !! '}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-sm opacity-90">Signed in as <span className="font-semibold">{sessionUser?.email || 'Not signed in'}</span></div>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20">
                <img
                  src={profile?.avatar || profile?.picture || profile?.profile_picture_url || sessionUser?.avatar || sessionUser?.picture || sessionUser?.profile_picture_url || '/default-avatar.png'}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <button onClick={onNavigateToChatbot} className="bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white px-4 py-2 rounded-lg font-medium shadow hover:scale-[1.02] transition flex items-center gap-2">
              Prasthi-AI
            </button>
            <button onClick={handleLocalLogout} className="bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white px-4 py-2 rounded-lg font-medium shadow hover:scale-[1.02] transition">Logout</button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-6 py-3">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'home'
                ? 'bg-white/6 ring-1 ring-white/20 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/3'
                }`}
            >
              <Home className="h-5 w-5" />
              <span>Home</span>
            </button>
            <button onClick={() => setActiveTab('consultation')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'consultation' ? 'bg-white/6 ring-1 ring-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/3'}`}>
              <Video className="h-5 w-5" />
              <span>Consultation</span>
            </button>

            <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'profile' ? 'bg-white/6 ring-1 ring-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/3'}`}>
              <User className="h-5 w-5" />
              <span>Profile</span>
            </button>

            <button onClick={() => setActiveTab('prescriptions')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'prescriptions' ? 'bg-white/6 ring-1 ring-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/3'}`}>
              <FileText className="h-5 w-5" />
              <span>Prescriptions</span>
            </button>

            <button onClick={() => setActiveTab('notifications')} className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'notifications' ? 'bg-white/6 ring-1 ring-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/3'}`}>
              <Bell className="h-5 w-5" />
              <span>Notifications</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'consultation' && renderConsultation()}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'prescriptions' && renderPrescriptions()}
        {activeTab === 'notifications' && renderNotifications()}
      </main>

      {/* Prescription modal */}
      {showPrescriptionModal && selectedPrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowPrescriptionModal(false)}></div>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full z-10 p-6 overflow-auto max-h-[80vh] select-none">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Prescription Details</h3>
              <div className="flex items-center space-x-2">
                <button onClick={() => handleDownloadPDF(selectedPrescription)} className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">Download PDF</button>
                <button onClick={() => handleMarkPrescriptionRead(selectedPrescription.id)} className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Mark as Read</button>
                <button onClick={() => handleDeletePrescription(selectedPrescription.id)} className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                <button onClick={() => setShowPrescriptionModal(false)} className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Close</button>
              </div>
            </div>
            <div className="text-gray-900 space-y-3">
              {loadingPrescriptionDetails ? (
                <div className="text-sm text-gray-600">Loading prescription...</div>
              ) : (
                <>
                  <div className="text-sm">
                    <span className="font-semibold">Prescribed by:  Dr </span> <span className="text-gray-800">{selectedPrescription.doctor_name || selectedPrescription.doctor?.name || selectedPrescription.doctor || 'N/A'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">Date:</span> <span className="text-gray-800">{formatIST(selectedPrescription.created_at || selectedPrescription.date || Date.now())}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">Diagnosis / Notes:</span>
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-gray-800 whitespace-pre-wrap">{selectedPrescription.diagnosis || selectedPrescription.reason || 'No notes provided.'}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default PatientDashboard;

