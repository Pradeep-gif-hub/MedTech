import { useEffect, useState, useRef } from 'react';
import jsPDF from 'jspdf';
import { Home } from "lucide-react";
import html2canvas from 'html2canvas';
import { Video, User, FileText, Bell, Heart, Activity, Download, Phone, Star, Clock } from 'lucide-react';
import { useStoredUser } from '../hooks/useStoredUser';
import { buildApiUrl } from '../config/api';
import { useBackendProfile, getAuthHeaders } from '../hooks/useBackendProfile';

interface PatientDashboardProps { onLogout: () => void }
// sample vitals and data (replace with real API data)
const vitalSigns = {
  heartRate: 78,
  bloodPressure: '120/80',
  temperature: 98.6,
  oxygenLevel: 96,
};

const PatientDashboard = ({ onLogout }: PatientDashboardProps) => {
  // normalize tab keys to lowercase ('home') because the rest of the file uses 'home'
  const [activeTab, setActiveTab] = useState('home' as 'home' | 'consultation' | 'profile' | 'prescriptions' | 'notifications');
  const [inConsultation, setInConsultation] = useState(false);

  // Prescriptions / PDF state
  const [serverPrescriptions, setServerPrescriptions] = useState([] as any[]);
  const [loadingServerPrescriptions, setLoadingServerPrescriptions] = useState(false);
  const [notifications, setNotifications] = useState([] as any[]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null as any);
  const [hrHistory, setHrHistory] = useState([vitalSigns.heartRate] as number[]);


  const [tempHistory, setTempHistory] = useState([vitalSigns.temperature] as number[]);

  const [oxHistory, setOxHistory] = useState([vitalSigns.oxygenLevel] as number[]);

  // Simulated live vitals
  const [liveHeartRate, setLiveHeartRate] = useState(72 as number);
  const [liveTemperature, setLiveTemperature] = useState(98.6 as number);
  const [liveOxygen, setLiveOxygen] = useState(98 as number);
  const { profile, refreshProfile } = useBackendProfile();

  // WebRTC / signaling refs (patient = sender)
  const localVideoRef = useRef(null as HTMLVideoElement | null);
  const remoteVideoRef = useRef(null as HTMLVideoElement | null);
  const pcRef = useRef(null as RTCPeerConnection | null);
  const wsRef = useRef(null as WebSocket | null);
  const pendingSends = useRef([] as string[]);

  const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

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
   


  const formatIST = (date) => {
  if (!date) return "";
  const utcDate = new Date(date);
  const istOffset = 5.5 * 60 * 60 * 1000; 
  const istDate = new Date(utcDate.getTime() + istOffset);

  return istDate.toLocaleString("en-IN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
};

  // Styled multi-page-aware PDF
  const handleDownloadPDF = async (prescription: any) => {
    if (!prescription) { alert('No prescription'); return }
    const downloadDate = new Date().toLocaleString();
    const patientId = userId || 'N/A';
    const medicines = Array.isArray(prescription.medicines) ? prescription.medicines : (prescription.medicines ? [prescription.medicines] : []);

    const headerHTML = `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#111; padding:24px; width:760px; box-sizing:border-box; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:18px;">
          <div>
            <h1 style="margin:0;font-size:26px;color:#0b7a44;">MedTech Clinic</h1>
            <div style="font-size:12px;color:#334155;">Dispensary</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:#374151">Download Date</div>
            <div style="font-size:13px;font-weight:600;color:#111">${downloadDate}</div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:12px;">
          <div style="flex:1">
            <div style="font-size:12px;color:#64748b">Patient ID</div>
            <div style="font-size:14px;font-weight:600">${patientId}</div>
            <div style="font-size:12px;color:#64748b;margin-top:6px">Patient Name</div>
            <div style="font-size:14px;font-weight:600">${escapeHtml(prescription.fullname || '')}</div>
          </div>
          <div style="flex:1">
            <div style="font-size:12px;color:#64748b">Prescribed By</div>
            <div style="font-size:14px;font-weight:600">${escapeHtml(prescription.doctor?.name || prescription.doctor || 'Dr. Mohammad Hasan')}</div>
            <div style="font-size:12px;color:#64748b;margin-top:6px">Prescription Date</div>
            <div style="font-size:14px;font-weight:600">${new Date(prescription.created_at || prescription.date || Date.now()).toLocaleDateString()}</div>
          </div>
        </div>
        <h2 style="font-size:16px;color:#0f172a;margin:8px 0 6px">Diagnosis / Notes</h2>
        <div style="font-size:13px;color:#1f2937;margin-bottom:14px; line-height:1.4">${escapeHtml((prescription.diagnosis || prescription.reason || 'Null').toString()) || 'No notes provided.'}</div>
        <div style="margin-top:8px;">
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr>
                <th style="border:1px solid #0c78d7ff; padding:8px; background:#f8fafc; text-align:left">Medicine</th>
                <th style="border:1px solid #0c78d7ff; padding:8px; background:#f8fafc; text-align:left">Dose / Strength</th>
                <th style="border:1px solid #0c78d7ff; padding:8px; background:#f8fafc; text-align:left">Frequency</th>
                <th style="border:1px solid #0c78d7ff; padding:8px; background:#f8fafc; text-align:left">Duration</th>
              </tr>
            </thead>
            <tbody>
              ${medicines.map((m: any) => {
      if (typeof m === 'string') {
        const parts = m.split('|').map((s: string) => s.trim());
        const name = parts[0] || m; const dose = parts[1] || '12'; const freq = parts[2] || ''; const dur = parts[3] || '';
        return `\n<tr>\n<td style="border:1px solid #368bd6ff; padding:8px;">${escapeHtml(name)}</td>\n<td style="border:1px solid #368bd6ff; padding:8px;">${escapeHtml(dose)}</td>\n<td style="border:1px solid #0c78d7ff; padding:8px;">${escapeHtml(freq)}</td>\n<td style="border:1px solid #0c78d7ff; padding:8px;">${escapeHtml(dur)}</td>\n</tr>`;
      } else {
        const name = m.name || m.medicine || JSON.stringify(m);
        const dose = (m.dose || m.strength || '').toString(); const freq = (m.frequency || m.freq || '').toString(); const dur = (m.duration || m.days || '').toString();
        return `\n<tr>\n<td style="border:1px solid #368bd6ff; padding:8px;">${escapeHtml(name)}</td>\n<td style="border:1px solid #368bd6ff; padding:8px;">${escapeHtml(dose)}</td>\n<td style="border:1px solid #0c78d7ff; padding:8px;">${escapeHtml(freq)}</td>\n<td style="border:1px solid #0c78d7ff; padding:8px;">${escapeHtml(dur)}</td>\n</tr>`;
      }
    }).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:28px; border-top:1px dashed #c105b1ff; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:12px;color:#94a3b8">This is a digitally generated prescription from MedTech Clinic.</div>
          <div style="text-align:right"><div style="font-size:9px;color:#000">Authorized Signature</div></div>
        </div>
      </div>`;

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
      const safeDate = (prescription.date || new Date().toISOString()).toString().replace(/[^a-zA-Z0-9_\-]/g, '_');
      pdf.save(`prescription_${safeDate}.pdf`);
    } catch (e) { console.error(e); alert('Failed to create PDF'); } finally { temp.remove(); }
  };

  // Fetch latest prescriptions (tries a few endpoints)
  const handleOpenLatestPrescription = async () => {
    if (!userId) { alert('Login required'); return }
    setLoadingServerPrescriptions(true);
    try {
      const urls = [`https://medtech-hcmo.onrender.com/api/prescriptions/${userId}`, `https://medtech-hcmo.onrender.com/api/prescriptions/patient/${userId}`, `https://medtech-hcmo.onrender.com/api/prescriptions`];
      let list: any[] = [];
      for (const u of urls) { try { const r = await fetch(u); if (!r.ok) continue; const d = await r.json(); if (Array.isArray(d)) list = d; else if (d) list = [d]; if (list.length) break } catch (e) { } }
      setServerPrescriptions(list);
      if (list.length) { const latest = list.slice().sort((a: any, b: any) => (new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime()))[0]; setSelectedPrescription(latest); setShowPrescriptionModal(true); }
      else alert('No prescriptions');
    } catch (e) { console.error(e); alert('Error fetching prescriptions') } finally { setLoadingServerPrescriptions(false); }
  };

  // Simulated vitals updater
  useEffect(() => { let mounted = true; const tick = () => { if (!mounted) return; setLiveHeartRate((h: number) => Math.max(55, Math.min(110, h + Math.round((Math.random() * 2 - 1) * 3)))); setLiveTemperature((t: number) => Math.round((t + ((Math.random() * 2 - 1) * 0.2)) * 10) / 10); setLiveOxygen((o: number) => Math.max(90, Math.min(100, o + Math.round((Math.random() * 2 - 1) * 1)))); setTimeout(tick, 3000 + Math.floor(Math.random() * 1000)); }; const id = window.setTimeout(tick, 1000); return () => { mounted = false; clearTimeout(id); } }, []);

  // Create consultation in backend database
  const createConsultationInBackend = async () => {
    try {
      const pendingConsultationStr = localStorage.getItem('pendingConsultation');
      if (!pendingConsultationStr) {
        console.log('No pending consultation found');
        return;
      }

      const consultationData = JSON.parse(pendingConsultationStr);
      
      // Get patient ID from stored user profile
      const patientId = profile?.id;
      if (!patientId) {
        console.error('Patient ID not found');
        alert('Error: Patient ID not found');
        return;
      }

      // Send to backend API
      const response = await fetch(buildApiUrl('/api/consultations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          patient_id: patientId,
          disease: consultationData.disease,
          symptoms: consultationData.symptoms,
          duration: consultationData.duration,
          appointment_time: new Date().toLocaleTimeString()
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Consultation created:', result);
        // Store consultation ID for reference
        localStorage.setItem('currentConsultationId', result.id?.toString() || '');
        return true;
      } else {
        const error = await response.json();
        console.error('Failed to create consultation:', error);
        alert(`Failed to create consultation: ${error.detail || 'Unknown error'}`);
        return false;
      }
    } catch (err) {
      console.error('Error creating consultation:', err);
      alert('Error submitting consultation to backend');
      return false;
    }
  };

  // Start live as sender (patient)
  const startLiveSender = async () => {
    // First, ensure consultation is created in backend
    const consultationCreated = await createConsultationInBackend();
    if (!consultationCreated) {
      console.log('Consultation not created, but proceeding with WebRTC...');
    }
    try {
      // open signaling websocket
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${window.location.host}/ws/live-consultation/sender`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      // flush any queued messages when socket opens
      const flushPending = () => {
        while (pendingSends.current.length && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const m = pendingSends.current.shift();
          if (m) wsRef.current.send(m);
        }
      };

      ws.onopen = () => {
        // send a ready message if needed
        flushPending();
      };

      ws.onmessage = async (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'answer' && data.sdp) {
            await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
          } else if (data.type === 'ice' && data.candidate) {
            try { await pcRef.current?.addIceCandidate(data.candidate); } catch { /* ignore */ }
          }
        } catch (err) {
          console.error('WS msg parse error', err);
        }
      };

      ws.onclose = () => { /* noop */ };
      ws.onerror = (e) => console.warn('WS error', e);

      // send ICE candidates over websocket
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const msg = JSON.stringify({ type: 'ice', candidate: e.candidate });
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(msg);
          else pendingSends.current.push(msg);
        }
      };

      // when remote track arrives, show doctor's stream
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
          remoteVideoRef.current.play().catch(() => { });
        }
      };

      // capture local media and add tracks
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => { });
      }
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      // create offer and send
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const offerMsg = JSON.stringify({ type: 'offer', sdp: pc.localDescription });
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(offerMsg);
      else pendingSends.current.push(offerMsg);

      // update UI
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
   if (abhaId && !/^\d{14}$/.test(abhaId)) {
      window.alert("ABHA ID must be exactly 14 digits");
      return;
    }
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

  const fetchPatientPrescriptions = async () => {
    if (!userId) return;
    setLoadingServerPrescriptions(true);
    try {
      const response = await fetch(buildApiUrl(`/api/prescriptions/patient/${userId}`), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        console.warn('Prescription fetch failed', response.status);
        setServerPrescriptions([]);
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        const sorted = data.slice().sort((a: any, b: any) => new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime());
        setServerPrescriptions(sorted);
      } else {
        setServerPrescriptions([]);
      }
    } catch (error) {
      console.error('Failed to fetch prescriptions', error);
      setServerPrescriptions([]);
    } finally {
      setLoadingServerPrescriptions(false);
    }
  };

  const fetchNotifications = async () => {
    if (!userId) return;
    setLoadingNotifications(true);
    try {
      const response = await fetch(buildApiUrl(`/api/notifications/${userId}`), {
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
    const interval = window.setInterval(() => {
      fetchPatientPrescriptions();
      fetchNotifications();
    }, 10000);
    return () => {
      window.clearInterval(interval);
    };
  }, [userId]);

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

  const deleteNotification = async (notificationId: number, index: number) => {
    try {
      const response = await fetch(buildApiUrl(`/api/notifications/${notificationId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        // Remove from local state immediately
        setNotifications(prev => prev.filter((_, i) => i !== index));
      } else {
        console.warn('Failed to delete notification from backend', response.status);
        // Still remove from local state for UX
        setNotifications(prev => prev.filter((_, i) => i !== index));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Still remove from local state for UX
      setNotifications(prev => prev.filter((_, i) => i !== index));
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

        const data = await res.json();
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
    const abha = profile.abha_id || profile.abhaId;

    if (abha) {
  if (!/^\d{14}$/.test(abha)) {
    window.alert("ABHA ID must be exactly 14 digits");
  } else {
    setAbhaId(abha);
  }
}
  }, [profile]);




  // Recent consultations sample (was referenced but not defined)
  const recentConsultations = [
    { doctor: 'Dr Paarth Lalit', date: 'Dec 15, 2024', rating: 5, status: 'Completed' },
    { doctor: 'Dr. Vishal Buttler', date: 'Dec 10, 2024', rating: 4, status: 'Completed' },
  ];


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
    <div className="grid md:grid-cols-2 gap-8 items-start">
      {/* LEFT HALF - Info */}
      <div className="space-y-6 md:col-start-1 md:col-span-1">

        {/* Existing Profile Card */}
        <div className="bg-emerald-50 rounded-xl shadow-md p-5">
          {/* Compact Modern Profile Card */}
          <div className="flex justify-center mt-6">
<div className="relative bg-gradient-to-br from-blue-50 via-blue-100 to-white rounded-3xl shadow-xl p-5 w-full max-w-full transform transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl">

              {/* Header - Profile Image + Name */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-14 h-14 rounded-full overflow-hidden border-4 border-emerald-300 shadow-lg transform transition-transform duration-300 hover:scale-105">
                  <img
                    src={profile?.picture || profile?.profile_picture_url || sessionUser?.picture || sessionUser?.profile_picture_url || '/default-avatar.png'}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-10xl font-extrabold text-emerald-900">
                    <p className="text-sm opacity-500">{profile?.name || sessionUser?.name || 'Patient'}</p>
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">{email || 'No email provided'}</p>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">Your Health Summary</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5 text-sm">
                {/* Age */}
                <div className="bg-white rounded-xl p-2.5 shadow hover:shadow-lg flex items-center gap-2.5 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold">
                    🎂
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">Age</div>
                    <div className="text-gray-500 font-medium">
                      {dob ? Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : '—'}
                    </div>
                  </div>
                </div>

                {/* Gender (dynamic from signedUser/localStorage) */}
                <div className="bg-white rounded-xl p-2.5 shadow hover:shadow-lg flex items-center gap-2.5 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold">
                    ⚥
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">Gender</div>
                    <div className="text-gray-500 font-medium">
                      <div className="text-gray-500 font-medium">{Gender || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Blood Group */}
                <div className="bg-white rounded-xl p-2.5 shadow hover:shadow-lg flex items-center gap-2.5 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold">
                    🩸
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">Blood Group</div>
                    <div className="text-gray-500 font-medium">{bloodGroup || '—'}</div>
                  </div>
                </div>

                {/* DOB */}
                <div className="bg-white rounded-xl p-2.5 shadow hover:shadow-lg flex items-center gap-2.5 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold">
                    📅
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">Date of Birth</div>
                    <div className="text-gray-500 font-medium">{dob || '—'}</div>
                  </div>
                </div>

                {/* Phone */}
                <div className="bg-white rounded-xl p-2.5 shadow hover:shadow-lg flex items-center gap-2.5 cursor-pointer col-span-1 md:col-span-2">
                  <div className="bg-emerald-100 text-emerald-700 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold">
                    📞
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">Phone</div>
                    <div className="text-gray-500 font-medium">{phone || '—'}</div>
                  </div>
                </div>
              </div>

              {/* ABHA ID */}
            <div className="bg-white rounded-xl p-2.5 shadow hover:shadow-lg flex items-center gap-2.5 cursor-pointer col-span-1 md:col-span-2">
            <div className="bg-emerald-100 text-emerald-700 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold">
             🏥
             </div>
 
             <div>
             <div className="text-sm font-bold text-gray-800">ABHA ID</div>
             <div className="text-gray-500 font-medium">
             {abhaId || '—'}
            </div>
           </div>
           </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transform hover:-translate-y-0.5 transition-all"
                >
                  View Profile
                </button>
                <button
                  onClick={() => window.open('https://chatgpt.com/g/g-PFQijmS57-medical-ai', '_blank')}
                  className="px-4 py-2 bg-white text-emerald-700 rounded-lg font-semibold border border-emerald-300 shadow hover:bg-gray-50 transform hover:-translate-y-0.5 transition-all"
                >
                  Chat
                </button>

              </div>

            </div>
          </div>
        </div>

      </div>
      {/* RIGHT HALF - Form */}
<div className="bg-gray-50 rounded-xl shadow-md p-6 md:col-start-2 md:col-span-1 self-start">
  <h3 className="text-xl font-semibold text-gray-900 mb-6">
    Consultation Form
  </h3>

  <div className="space-y-5">
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Disease
      </label>

      <input
  id="diseaseSelect"
  type="text"
  list="diseaseList"
  placeholder="Search or select disease"
  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-black"
/>

      <datalist id="diseaseList">
        <option value="Allergies"/>
        <option value="Alzheimer's Disease"/>
        <option value="Anemia"/>
        <option value="Arthritis"/>
        <option value="Asthma"/>
        <option value="Back Pain"/>
        <option value="Bronchitis"/>
        <option value="Cancer"/>
        <option value="Cardiac Arrest"/>
        <option value="Cold & Cough"/>
        <option value="COVID-19"/>
        <option value="Depression"/>
        <option value="Diabetes"/>
        <option value="Diarrhea"/>
        <option value="Dizziness"/>
        <option value="Epilepsy"/>
        <option value="Eye Infection"/>
        <option value="Fatigue"/>
        <option value="Fever"/>
        <option value="Food Poisoning"/>
        <option value="Fracture"/>
        <option value="Gastritis"/>
        <option value="GERD / Acid Reflux"/>
        <option value="Headache / Migraine"/>
        <option value="Heart Disease"/>
        <option value="Hepatitis"/>
        <option value="Hypertension"/>
        <option value="Influenza"/>
        <option value="Insomnia"/>
        <option value="Kidney Problems"/>
        <option value="Liver Issues"/>
        <option value="Lung Infection"/>
        <option value="Mental Health"/>
        <option value="Neurological Problems"/>
        <option value="Obesity"/>
        <option value="Osteoporosis"/>
        <option value="Pneumonia"/>
        <option value="Skin Disorders"/>
        <option value="Stomach Pain"/>
        <option value="Stroke"/>
        <option value="Thyroid Disorder"/>
        <option value="Tuberculosis"/>
        <option value="Urinary Tract Infection"/>
        <option value="Vertigo"/>
        <option value="Viral Infection"/>
        <option value="Vomiting"/>
        <option value="Weakness"/>
        <option value="Other"/>
      </datalist>
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
        placeholder=" in Days"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
      />
    </div>


    <button
      type="button"
      onClick={() => {

        const diseaseInput = document.getElementById('diseaseSelect') as HTMLInputElement;
        const symptomsTextarea = document.getElementById('symptomsTextarea') as HTMLTextAreaElement;
        const durationInput = document.getElementById('durationInput') as HTMLInputElement;

        if (!diseaseInput.value) {
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

        const consultationData = {
          disease: diseaseInput.value,
          symptoms: symptomsTextarea.value,
          duration: durationInput.value,
          timestamp: new Date().toISOString()
        };

        localStorage.setItem('pendingConsultation', JSON.stringify(consultationData));

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
    <div className="bg-slate-950 rounded-3xl shadow-sm overflow-hidden p-4">
      <div className="grid lg:grid-cols-2 gap-4">
        {/* LEFT: Doctor's video / placeholder */}
        <div className="p-4 bg-white rounded-3xl shadow-xl border border-gray-200">
          <div className="bg-gray-50 rounded-2xl relative flex items-center justify-center overflow-hidden h-[430px]">
            {inConsultation ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-xl bg-gray-200"
                />
                {/* floating self-preview when in consultation */}
                <div className="absolute bottom-2 right-4 w-40 h-30 bg-gray-200 rounded-lg overflow-hidden border border-gray-300">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 px-6">
                {(() => {
                  // Get pending consultation data
                  const pendingConsultationStr = localStorage.getItem('pendingConsultation');
                  const pendingConsultation = pendingConsultationStr ? JSON.parse(pendingConsultationStr) : null;

                  return pendingConsultation ? (
<div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-200 w-full max-w-md">
                      <h3 className="text-xl font-semibold mb-4 text-gray-900">Your Consultation Request</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm text-gray-600">Condition</div>
                          <div className="text-gray-900 font-medium">{pendingConsultation.disease}</div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600">Symptoms</div>
                          <div className="text-gray-900 font-medium">{pendingConsultation.symptoms}</div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600">Duration</div>
                          <div className="text-gray-900 font-medium">{pendingConsultation.duration}</div>
                        </div>

                        <div className="text-sm text-gray-600 pt-2">
                          Submitted on: {new Date(pendingConsultation.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-6 text-center text-sm text-gray-600">
                        Waiting for doctor to connect...
                        <div className="mt-2">
                          <div className="animate-pulse inline-block w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                          <div className="animate-pulse inline-block w-2 h-2 bg-green-400 rounded-full mr-1" style={{animationDelay: '0.2s'}}></div>
                          <div className="animate-pulse inline-block w-2 h-2 bg-green-400 rounded-full" style={{animationDelay: '0.4s'}}></div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <button
                          onClick={startLiveSender}
                          className="inline-flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-lg text-sm font-semibold shadow hover:bg-emerald-700 transition-all w-full justify-center"
                        >
                          <Video className="h-5 w-5" />
                          Start Video Consultation
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <svg
                        className="h-24 w-24 text-gray-400 animate-spin mb-4"
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
                      <div className="text-xl font-semibold mb-2 text-gray-900">
                        No Active Consultation
                      </div>
                      <div className="text-sm opacity-80 mb-6 text-center">
                        Please fill out the consultation form on the home page
                      </div>
                      <button
                        onClick={() => setActiveTab('home')}
                        className="inline-flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-lg text-sm font-semibold shadow hover:bg-emerald-700 transition-all"
                      >
                        <Home className="h-5 w-5" />
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
        <div className="p-2">
          <div className="bg-white p-6 rounded-3xl min-h-[420px] flex flex-col justify-between shadow-lg border border-gray-200">
            <div className="flex-1">
              {!inConsultation ? (
                <>
                  <h3 className="font-bold text-gray-900 mb-6 text-2xl">Doctor Information</h3>
                  <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-md">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl font-semibold shadow-lg">
                        <span>DR</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">Dr. Rajesh Kumar</h3>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                            General Physician
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                          MedTech Clinic
                        </div>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                          Expert in family medicine and teleconsultations
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-bold text-gray-800 mb-6 text-2xl text-center bg-white/90 py-3 rounded-lg shadow-sm">Live Vitals Monitor</h3>
                  <div className="grid grid-cols-2 gap-6 px-4">
                    {/* Heart Rate Card */}
                    <div className="bg-white p-5 rounded-xl border-2 border-red-500 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="p-2 bg-red-500 rounded-full">
                            <Heart className="h-5 w-5 text-white" />
                          </span>
                          <span className="text-base font-semibold text-gray-900">Heart Rate</span>
                        </div>
                        <span className="text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-full">BPM</span>
                      </div>
                      <div className="text-4xl font-bold text-gray-900 ml-2 flex items-baseline gap-2">
                        {liveHeartRate}
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse delay-100"></div>
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse delay-200"></div>
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse delay-300"></div>
                        </div>
                      </div>
                    </div>

                    {/* Blood Pressure Card */}
                    <div className="bg-white p-5 rounded-xl border-2 border-blue-500 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="p-2 bg-blue-500 rounded-full">
                            <Activity className="h-5 w-5 text-white" />
                          </span>
                          <span className="text-base font-semibold text-gray-900">Blood Pressure</span>
                        </div>
                        <span className="text-xs font-bold bg-blue-500 text-white px-3 py-1 rounded-full">mmHg</span>
                      </div>
                      <div className="text-4xl font-bold text-gray-900 ml-2 flex items-baseline gap-2">
                        {liveBP.sys}/{liveBP.dia}
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse delay-100"></div>
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse delay-200"></div>
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse delay-300"></div>
                        </div>
                      </div>
                    </div>

                    {/* Temperature Card */}
                    <div className="bg-white p-5 rounded-xl border-2 border-amber-500 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
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
                  className="bg-emerald-600 text-white px-6 py-3 rounded-lg text-sm font-semibold shadow-lg hover:bg-emerald-700 transition-all inline-flex items-center gap-2"
                >
                  <Video className="h-5 w-5" />
                  Start Consultation
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
        <div className="grid md:grid-cols-2 gap-6 text-gray-700">
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
  onChange={(e) => {
    const value = e.target.value.replace(/\D/g, ""); // allow only digits
    if (value.length <= 14) {
      setAbhaId(value);
    }
  }}
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
          <button
            type="button"
            onClick={fetchPatientPrescriptions}
           className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transform hover:-translate-y-0.5 transition-all"
          >
            Refresh
          </button>
        </div>

        {loadingServerPrescriptions ? (
          <div className="text-gray-600">Loading prescriptions...</div>
        ) : serverPrescriptions.length === 0 ? (
          <div className="text-gray-600">No prescriptions found yet. Check back after your next consultation.</div>
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
                    {(prescription.medications || []).map((medicine: any, i: number) => (
                      <li key={i} className="text-gray-600">
                        {typeof medicine === 'string' ? medicine : `${medicine.name || medicine.medicine || ''} ${medicine.dosage || medicine.dose || ''} ${medicine.duration || medicine.days || ''}`.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedPrescription(prescription); setShowPrescriptionModal(true); }}
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
            <p className="text-sm text-gray-500">Check Notifications Regularly</p>
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
          <div className="text-gray-600">No notifications yet.</div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{notification.message}</p>
                    <p className="text-sm text-gray-500 mt-2">{new Date(notification.created_at || Date.now()).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-3 flex-shrink-0">
                    <button
                      onClick={() => handleViewNotification(notification)}
                      className="text-sm text-emerald-600 hover:text-emerald-800 font-semibold whitespace-nowrap"
                    >
                      View
                    </button>
                    <button
                      onClick={() => deleteNotification(notification.id || index, index)}
                      className="text-sm text-red-600 hover:text-red-800 font-semibold whitespace-nowrap"
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
              <p className="text-xs text-gray-500 mt-1">Prescription Date: {new Date(serverPrescriptions[0].created_at || Date.now()).toLocaleDateString()}</p>
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
                  src={profile?.picture || profile?.profile_picture_url || sessionUser?.picture || sessionUser?.profile_picture_url || '/default-avatar.png'}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
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
              <div className="text-sm">
                <span className="font-semibold">Prescribed by:  Dr </span> <span className="text-gray-800">{selectedPrescription.doctor_name || selectedPrescription.doctor?.name || selectedPrescription.doctor || 'Dr. Unknown'}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Date:</span> <span className="text-gray-800">{new Date(selectedPrescription.created_at || selectedPrescription.date || Date.now()).toLocaleString()}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Diagnosis / Notes:</span>
                <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-gray-800 whitespace-pre-wrap">{selectedPrescription.diagnosis || selectedPrescription.reason || 'No notes provided.'}</div>
              </div>
              <div className="text-sm">
                <span className="font-semibold mb-2 block">Medicines</span>
                <ul className="list-disc list-inside space-y-1 text-gray-800">
                  {(selectedPrescription.medicines || []).length > 0 ? (
                    (selectedPrescription.medicines || []).map((m: any, i: number) => (
                      <li key={i}>{typeof m === 'string' ? m : (m.name || JSON.stringify(m))}</li>
                    ))
                  ) : (
                    <li>No medicines prescribed</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default PatientDashboard;

