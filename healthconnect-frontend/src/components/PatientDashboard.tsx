import React, { useEffect, useState, useRef } from 'react';
import jsPDF from 'jspdf';
import { Home } from "lucide-react";
import html2canvas from 'html2canvas';
import { Video, User, FileText, Bell, Heart, Activity, Download, Phone, Star, MessageCircle, Camera, Clock } from 'lucide-react';
import profileImage from '../assets/profile.png';

interface PatientDashboardProps { onLogout: () => void }
// sample vitals and data (replace with real API data)
const vitalSigns = {
  heartRate: 78,
  bloodPressure: '120/80',
  temperature: 98.6,
  oxygenLevel: 96,
};

const PatientDashboard: React.FC<PatientDashboardProps> = ({ onLogout }) => {
  // normalize tab keys to lowercase ('home') because the rest of the file uses 'home'
  const [activeTab, setActiveTab] = useState('home' as 'home' | 'consultation' | 'profile' | 'prescriptions' | 'notifications');
  const [inConsultation, setInConsultation] = useState(false);

  // Prescriptions / PDF state
  const [serverPrescriptions, setServerPrescriptions] = useState([] as any[]);
  const [loadingServerPrescriptions, setLoadingServerPrescriptions] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null as any);
  const [hrHistory, setHrHistory] = useState([vitalSigns.heartRate] as number[]);


  const [tempHistory, setTempHistory] = useState([vitalSigns.temperature] as number[]);

  const [oxHistory, setOxHistory] = useState([vitalSigns.oxygenLevel] as number[]);

  // Simulated live vitals
  const [liveHeartRate, setLiveHeartRate] = useState(72 as number);
  const [liveTemperature, setLiveTemperature] = useState(98.6 as number);
  const [liveOxygen, setLiveOxygen] = useState(98 as number);

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
      const urls = [`/api/prescriptions/${userId}`, `/api/prescriptions/patient/${userId}`, `/api/prescriptions`];
      let list: any[] = [];
      for (const u of urls) { try { const r = await fetch(u); if (!r.ok) continue; const d = await r.json(); if (Array.isArray(d)) list = d; else if (d) list = [d]; if (list.length) break } catch (e) { } }
      setServerPrescriptions(list);
      if (list.length) { const latest = list.slice().sort((a: any, b: any) => (new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime()))[0]; setSelectedPrescription(latest); setShowPrescriptionModal(true); }
      else alert('No prescriptions');
    } catch (e) { console.error(e); alert('Error fetching prescriptions') } finally { setLoadingServerPrescriptions(false); }
  };

  // Simulated vitals updater
  useEffect(() => { let mounted = true; const tick = () => { if (!mounted) return; setLiveHeartRate(h => Math.max(55, Math.min(110, h + Math.round((Math.random() * 2 - 1) * 3)))); setLiveTemperature(t => Math.round((t + ((Math.random() * 2 - 1) * 0.2)) * 10) / 10); setLiveOxygen(o => Math.max(90, Math.min(100, o + Math.round((Math.random() * 2 - 1) * 1)))); setTimeout(tick, 3000 + Math.floor(Math.random() * 1000)); }; const id = window.setTimeout(tick, 1000); return () => { mounted = false; clearTimeout(id); } }, []);

  // Start live as sender (patient)
  const startLiveSender = async () => {
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
    // after ending the call, redirect patient to Prescriptions tab
    setActiveTab('prescriptions');
  };

  // Minimal profile save handler (was referenced from UI)
  const updateProfile = () => {
    try {
      if (fullName) localStorage.setItem('name', fullName);
      if (email) localStorage.setItem('email', email);
      if (phone) localStorage.setItem('phone', phone);
      alert('Profile saved locally.');
    } catch (e) {
      console.error('updateProfile error', e);
      alert('Failed to save profile.');
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
  const [fullName, setFullName] = useState(() => localStorage.getItem('name') || "");
  const [dob, setDob] = useState("08-08-2005");
  const [Gender, setGender] = useState("Male");
  const [phone, setPhone] = useState("+91 8127136711");
  // Try to get email from localStorage, fallback to empty string
  const [email, setEmail] = useState(() => {
    const stored = localStorage.getItem('email');
    if (stored && stored !== 'undefined' && stored !== 'null') return stored;
    // fallback: try to get from user info (if available in localStorage)
    try {
      const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
      if (userInfo.email) return userInfo.email;
    } catch { }
    return "";
  });

  // Keep email in sync with localStorage if it changes (e.g., after login)
  useEffect(() => {
    const storedEmail = localStorage.getItem('email');
    if (storedEmail && storedEmail !== 'undefined' && storedEmail !== 'null') {
      if (email !== storedEmail) setEmail(storedEmail);
    }
  }, [email]);
  const [bloodGroup, setBloodGroup] = useState("A+");
  const [emergencyContact, setEmergencyContact] = useState("+91 8127136711");
  // Medical history state
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [surgeries, setSurgeries] = useState("");

  // Get user_id from localStorage (set at login)
  const userId = localStorage.getItem('user_id');

  // Logged-in user state (fetched from backend)
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('name') || '');

  // NEW: signed-in user info read from localStorage and event listeners
  const [signedUser, setSignedUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);

  // Keep profile state in sync with signedUser (from localStorage / login)
  useEffect(() => {
    if (!signedUser) return;
    try {
      // Map commonly used fields from signedUser into component state if present
      const s: any = signedUser;
      if (s.name || s.fullname || s.displayName) setFullName(s.name || s.fullname || s.displayName);
      if (s.email) setEmail(s.email);
      if (s.phone) setPhone(s.phone);
      if (s.dob || s.birthdate) setDob(s.dob || s.birthdate);
      if (s.bloodGroup) setBloodGroup(s.bloodGroup);
      if (s.emergencyContact) setEmergencyContact(s.emergencyContact);
      if (typeof s.allergies === 'string' && s.allergies) setAllergies(s.allergies);
      if (typeof s.medications === 'string' && s.medications) setMedications(s.medications);
      // persist name/email to localStorage same as earlier behavior
      try { if (s.name) localStorage.setItem('name', s.name); if (s.email) localStorage.setItem('email', s.email); } catch { }
    } catch (err) {
      // ignore mapping errors
    }
  }, [signedUser]);

  useEffect(() => {
    const loadUser = () => {
      try {
        const raw = localStorage.getItem('user');
        if (raw) setSignedUser(JSON.parse(raw));
        else setSignedUser(null);
      } catch {
        setSignedUser(null);
      }
    };
    loadUser();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'user') loadUser();
    };
    const onUserUpdated = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail) setSignedUser(detail);
        else loadUser();
      } catch {
        loadUser();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('user-updated', onUserUpdated as EventListener);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('user-updated', onUserUpdated as EventListener);
    };
  }, []);

  // Try to fetch user info from backend on mount (graceful fallback to localStorage)
  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        // Prefer a /api/users/me endpoint if available, otherwise use userId
        const urls = [] as string[];
        if (userId) urls.push(`/api/users/${userId}`);
        urls.unshift('/api/users/me');

        for (const u of urls) {
          try {
            const res = await fetch(u, { credentials: 'include' });
            if (!res.ok) continue;
            const data = await res.json();
            if (!data) continue;
            const name = data.name || data.fullname || data.full_name || data.username || data.email || '';
            if (mounted) {
              if (name) {
                setUserName(name);
                try { localStorage.setItem('name', name); } catch { }
              }
              // populate profile fields if available
              if (data.name) setFullName(data.name);
              if (data.email) setEmail(data.email);
              if (typeof data.allergies === 'string') setAllergies(data.allergies || '');
              if (typeof data.medications === 'string') setMedications(data.medications || '');
              if (typeof data.surgeries === 'string') setSurgeries(data.surgeries || '');
              if (data.phone) setPhone(data.phone);
              if (data.emergencyContact) setEmergencyContact(data.emergencyContact);
            }
            break;
          } catch (e) {
            // ignore and try next
          }
        }
      } catch (e) {
        // ignore - keep localStorage fallback
      }
    };
    fetchUser();
    return () => { mounted = false; };
  }, [userId]);




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
  const [liveBP, setLiveBP] = useState<{ sys: number; dia: number }>(initialBP);
  const [bpHistory, setBpHistory] = useState<string[]>([`${initialBP.sys}/${initialBP.dia}`]);

  const [liveLDR, setLiveLDR] = useState<number | null>(null);
  const [ldrHistory, setLdrHistory] = useState<number[]>([]);

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
        <div className="bg-emerald-50 rounded-xl shadow-md p-6">
          {/* Compact Modern Profile Card */}
          <div className="flex justify-center mt-8">
            <div className="relative bg-gradient-to-br from-blue-50 via-blue-100 to-white rounded-3xl shadow-xl p-6 w-full max-w-full transform transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl">

              {/* Header - Profile Image + Name */}
              <div className="flex items-center gap-4 mb-12">
                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-emerald-300 shadow-lg transform transition-transform duration-300 hover:scale-105">
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-10xl font-extrabold text-emerald-900">
                    <p className="text-sm opacity-500">{signedUser ? `${signedUser.name || 'Patient'} ` : 'Welcome back !! '}</p>
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">{email || 'No email provided'}</p>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">Your Health Summary</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-sm">
                {/* Age */}
                <div className="bg-white rounded-xl p-3 shadow hover:shadow-lg flex items-center gap-3 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-full flex items-center justify-center text-base font-bold">
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
                <div className="bg-white rounded-xl p-3 shadow hover:shadow-lg flex items-center gap-3 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-full flex items-center justify-center text-base font-bold">
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
                <div className="bg-white rounded-xl p-3 shadow hover:shadow-lg flex items-center gap-3 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-full flex items-center justify-center text-base font-bold">
                    🩸
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">Blood Group</div>
                    <div className="text-gray-500 font-medium">{bloodGroup || '—'}</div>
                  </div>
                </div>

                {/* DOB */}
                <div className="bg-white rounded-xl p-3 shadow hover:shadow-lg flex items-center gap-3 cursor-pointer">
                  <div className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-full flex items-center justify-center text-base font-bold">
                    📅
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">Date of Birth</div>
                    <div className="text-gray-500 font-medium">{dob || '—'}</div>
                  </div>
                </div>

                {/* Phone */}
                <div className="bg-white rounded-xl p-3 shadow hover:shadow-lg flex items-center gap-3 cursor-pointer col-span-1 md:col-span-2">
                  <div className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-full flex items-center justify-center text-base font-bold">
                    📞
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">Phone</div>
                    <div className="text-gray-500 font-medium">{phone || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-3">
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
            <select
              id="diseaseSelect"  // added ID here
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
            >
              <option value="">-- Choose an option --</option>
              <option>Fever</option>
              <option>Cold & Cough</option>
              <option>Asthma</option>
              <option>Diabetes</option>
              <option>Hypertension</option>
              <option>Heart Disease</option>
              <option>Liver Issues</option>
              <option>Kidney Problems</option>
              <option>Arthritis</option>
              <option>Skin Disorders</option>
              <option>Neurological Problems</option>
              <option>Mental Health</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symptoms
            </label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-20 text-black"
              placeholder="Describe your symptoms..."
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration of Illness
            </label>
            <input
              type="text"
              placeholder="e.g. 2 weeks"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              const diseaseDropdown = document.getElementById('consulationForm') as HTMLSelectElement;
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
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-2">
        {/* LEFT: Doctor's video / placeholder */}
        <div className="p-2">
          <div className="bg-gray-900 rounded-xl relative flex items-center justify-center overflow-hidden h-[430px]">
            {inConsultation ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-xl bg-black"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/90 px-6">
                <svg
                  className="h-24 w-24 text-white/90 animate-spin mb-4"
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
                <div className="text-xl font-semibold mb-2 text-white">
                  Connecting to doctor...
                </div>
                <div className="text-sm opacity-80 mb-6 text-center">
                  Please wait while we establish connection
                </div>
                <button
                  onClick={startLiveSender}
                  className="inline-flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-lg text-sm font-semibold shadow hover:bg-emerald-700 transition-all"
                >
                  <Video className="h-5 w-5" />
                  Connect Now
                </button>
              </div>
            )}

            {/* floating self-preview */}
            <div className="absolute bottom-2 right-4 w-40 h-30 bg-black rounded-lg overflow-hidden border border-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  {/* RIGHT: Doctor Info / Live Vitals */ }
  <div className="p-4">
    <div className="bg-white p-6 rounded-lg border min-h-[420px] flex flex-col justify-between shadow-lg max-w-[600px] mx-auto">
      <div className="flex-1 flex flex-col justify-center">
        {!inConsultation ? (
          <>
            <h3 className="font-bold text-gray-900 mb-6 text-4xl text-center">Doctor Information</h3>
            <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-xl border border-emerald-100 shadow-md">
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
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    Expert in family medicine and teleconsultations
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          // Live vitals display when in consultation
          <>
            <h3 className="font-bold text-gray-900 mb-6 text-xl text-center">Live Vitals Monitor</h3>
            <div className="grid grid-cols-2 gap-6 px-4">
              {/* Heart Rate Card */}
              <div className="bg-gradient-to-br from-red-50 to-white p-5 rounded-xl border border-red-100 shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-red-600">BPM</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{liveHeartRate}</div>
                <div className="text-xs text-gray-500 mt-1">Heart Rate</div>
              </div>

              {/* Blood Pressure Card */}
              <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-xl border border-blue-100 shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-blue-600">mmHg</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{liveBP.sys}/{liveBP.dia}</div>
                <div className="text-xs text-gray-500 mt-1">Blood Pressure</div>
              </div>

              {/* Temperature Card */}
              <div className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-xl border border-orange-100 shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v7.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V3a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-orange-600">°F</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{liveTemperature.toFixed(1)}</div>
                <div className="text-xs text-gray-500 mt-1">Temperature</div>
              </div>

              {/* SpO₂ Card */}
              <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-xl border border-green-100 shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-green-600">%</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{liveOxygen}</div>
                <div className="text-xs text-gray-500 mt-1">Oxygen Saturation</div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 text-right">
        {!inConsultation ? (
          <button
            onClick={startLiveSender}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            Connect to Doctor
          </button>
        ) : (
          <button
            onClick={endLiveConsultation}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            End Consultation
          </button>
        )}
      </div>
    </div>
  </div>

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
              onChange={(e) => setPhone(e.target.value)}
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
        <h2 className="text-xl font-bold text-gray-900 mb-6">Digital Prescriptions</h2>
        <div className="space-y-4">
          {[
            {
              doctor: 'Dr. Rajesh Kumar',
              date: 'Dec 15, 2024',
              medicines: ['Paracetamol 500mg', 'Amoxicillin 250mg'],
              status: 'Available for pickup'
            },
            {
              doctor: 'Dr. Priya Sharma',
              date: 'Dec 10, 2024',
              medicines: ['Vitamin D3', 'Calcium tablets'],
              status: 'Completed'
            },
          ].map((prescription, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Prescribed by {prescription.doctor}</h3>
                  <p className="text-sm text-gray-500">{prescription.date}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${prescription.status === 'Available for pickup'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
                  }`}>
                  {prescription.status}
                </span>
              </div>
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Medicines:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {prescription.medicines.map((medicine, i) => (
                    <li key={i} className="text-gray-600">{medicine}</li>
                  ))}
                </ul>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleDownloadPDF(prescription)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
                <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Notifications</h2>
        <div className="space-y-4">
          {[
            {
              type: 'appointment',
              title: 'Appointment Reminder',
              urgent: true,
            },
            {
              type: 'prescription',
              title: 'Prescription Ready',
              message: 'Your prescription from Dec 15 is ready for pickup at MedPlus Pharmacy',
              time: '1 day ago',
              urgent: false,
            },
            {
              type: 'feedback',
              title: 'Feedback Request',
              message: 'Please rate your recent consultation with Dr. Priya Sharma',
              time: '2 days ago',
              urgent: false,
            },
          ].map((notification, index) => (
            <div key={index} className={`border rounded-lg p-4 ${notification.urgent ? 'border-red-200 bg-red-50' : 'border-gray-200'
              }`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className={`font-semibold ${notification.urgent ? 'text-red-800' : 'text-gray-900'
                    }`}>
                    {notification.title}
                  </h3>
                  <p className={`mt-1 ${notification.urgent ? 'text-red-700' : 'text-gray-600'
                    }`}>
                    {notification.message}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">{notification.time}</p>
                </div>
                {notification.urgent && (
                  <div className="ml-4">
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">Urgent</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Feedback & Ratings</h2>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Rate your recent consultation</h3>
            <p className="text-gray-600 mb-4">Dr. Priya Sharma - Dec 10, 2024</p>
            <div className="flex items-center space-x-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} className="text-yellow-400 hover:text-yellow-500">
                  <Star className="h-6 w-6 fill-current" />
                </button>
              ))}
            </div>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-20"
              placeholder="Share your feedback about the consultation..."
            ></textarea>
            <button className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
              Submit Feedback
            </button>
          </div>
        </div>
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
              <p className="text-sm opacity-80">{signedUser ? `Welcome back, ${signedUser.name || 'Patient'} !! ` : 'Welcome back !! '}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-sm opacity-90">Signed in as <span className="font-semibold">{signedUser?.email ?? 'Not signed in'}</span></div>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20">
                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <button onClick={onLogout} className="bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white px-4 py-2 rounded-lg font-medium shadow hover:scale-[1.02] transition">Logout</button>
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

      {/* Prescription modal — keep original modal markup/behavior */}
      {showPrescriptionModal && selectedPrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowPrescriptionModal(false)}></div>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full z-10 p-6 overflow-auto max-h-[80vh]">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Prescription Details</h3>
              <div className="flex items-center space-x-2">
                <button onClick={() => generatePrescriptionJsonPdf(selectedPrescription)} className="text-sm px-3 py-1 bg-gray-100 rounded">Export JSON</button>
                <button onClick={() => handleDownloadPDF(selectedPrescription)} className="text-sm px-3 py-1 bg-emerald-600 text-white rounded">Download PDF</button>
                <button onClick={() => setShowPrescriptionModal(false)} className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded">Close</button>
              </div>
            </div>
            <div>
              <div className="mb-2"><strong>Prescribed by:</strong> {selectedPrescription.doctor?.name || selectedPrescription.doctor || 'Dr. Unknown'}</div>
              <div className="mb-2"><strong>Date:</strong> {new Date(selectedPrescription.created_at || selectedPrescription.date || Date.now()).toLocaleString()}</div>
              <div className="mb-4"><strong>Diagnosis / Notes:</strong><div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{selectedPrescription.diagnosis || selectedPrescription.reason || 'No notes provided.'}</div></div>
              <div>
                <strong>Medicines</strong>
                <ul className="list-disc list-inside mt-2">{(selectedPrescription.medicines || []).map((m: any, i: number) => (<li key={i} className="text-gray-700">{typeof m === 'string' ? m : (m.name || JSON.stringify(m))}</li>))}</ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default PatientDashboard;

