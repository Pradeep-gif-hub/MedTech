// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useStoredUser } from '../hooks/useStoredUser';
import { useBackendProfile, getAuthHeaders } from '../hooks/useBackendProfile';
import { buildApiUrl } from '../config/api';

// Initialize EmailJS
try {
  emailjs.init('ChNx9vs8ZLde4sGrm');
  console.log('EmailJS initialized successfully');
} catch (error) {
  console.error('Failed to initialize EmailJS:', error);
}
import profileImage from '../assets/doctor.png';
import doctorImg from "../assets/qr1.jpeg";
import {
  Users,
  Clock,
  FileText,
  BarChart3,
  Video,
  User,
  Phone,
  MessageCircle,
  Activity,
} from 'lucide-react';

interface DoctorDashboardProps {
  onLogout: () => void;
}

/**
 * DoctorDashboard.tsx
 *
 * Restyled and expanded verbose version (vibrant theme, Tailwind-only animations and transitions).
 * This file preserves the original app sections: Queue, Consultation, Prescriptions, Analytics.
 * The markup is intentionally verbose/expanded so the file line count is similar to a longer original.
 *
 * No framer-motion required. All transitions done via Tailwind utility classes.
 */

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ onLogout }: DoctorDashboardProps) => {
  const sessionUser = useStoredUser();
  const { profile } = useBackendProfile();

  const [activeTab, setActiveTab] = useState<
    'home' | 'queue' | 'consultation' | 'prescriptions' | 'analytics'
  >('home');

  const [inConsultation, setInConsultation] = useState<boolean>(false);
  const [currentPatient, setCurrentPatient] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchAnalyticsData = async () => {
    if (!profile?.id) return;
    setAnalyticsLoading(true);
    try {
      const response = await fetch(
        buildApiUrl(`/api/analytics/doctor/${profile.id}?t=${Date.now()}`),
        { headers: getAuthHeaders(), cache: 'no-store' }
      );
      if (response.ok) {
        const data = await response.json();
        console.log('[DoctorDashboard Analytics] Fetched real data:', data);
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('[DoctorDashboard Analytics] Error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.id) return;
    fetchAnalyticsData();
    const interval = setInterval(fetchAnalyticsData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [profile?.id]);

  const signedUser = {
    name: profile?.name || sessionUser?.name || 'Doctor',
    email: profile?.email || sessionUser?.email || '',
    role: profile?.role || sessionUser?.role || 'doctor',
    age: profile?.age || sessionUser?.age,
    bloodgroup: profile?.bloodgroup || sessionUser?.bloodgroup,
    phone: profile?.phone || sessionUser?.phone,
    picture: profile?.picture || profile?.profile_picture_url || sessionUser?.picture || sessionUser?.profile_picture_url,
  } as any;

  // Cross-browser-safe avatar fallback.
  const [avatarSrc, setAvatarSrc] = useState('/default-avatar.png');
  useEffect(() => {
    setAvatarSrc((signedUser?.picture as string) || '/default-avatar.png');
  }, [signedUser?.picture]);

  const handleAvatarError = (e: any) => {
    const el = e.currentTarget as HTMLImageElement;
    if (!el.src.includes('/default-avatar.png')) {
      el.src = '/default-avatar.png';
    }
  };

  // --- Derived doctor info (source of truth: backend profile/session) ---
  const doctorName = signedUser?.name || 'Doctor';
  const doctorImage = avatarSrc || '/default-avatar.png';
  const email = signedUser?.email || '';

  // Use consistent defaults for fields not yet present in backend schema.
  const specialization = (profile as any)?.specialization || 'General Physician';
  const experience = (profile as any)?.experience || '15 years';
  const doctorId = String(profile?.id || sessionUser?.user_id || '');
  const phone = signedUser?.phone || '-';
  const bloodGroup = signedUser?.bloodgroup || '-';
  const licenseNumber = (profile as any)?.license_number || 'RCXS-24103948';
  const registrationNumber = (profile as any)?.registration_no || 'RG-932183';
  const hospitalAffiliation = (profile as any)?.hospital || 'PGI-Chandigarh';
  const qualifications = (profile as any)?.qualifications || 'MBBS-MD AIIMS';
  const yearsPracticing = (profile as any)?.years_practicing || '15 years';
  const languages = (profile as any)?.languages || 'English, Hindi, Punjabi';
  const clinicAddress = (profile as any)?.clinic_address || 'Shashtri Nagar, Mandi Govindgarh';
  const consultationFee = (profile as any)?.consultation_fee || 'INR-300';

  const effectiveDoctorName = doctorName;
  const effectiveDoctorEmail = email;
  const effectiveDoctorImage = doctorImage;
  const effectiveDoctorPhone = phone;
  const effectiveDoctorBloodGroup = bloodGroup;
  const effectiveDoctorAge = String(signedUser?.age || '-');

  // --- Camera feed and WebRTC state  
  const localVideoRef = useRef<HTMLVideoElement>(null); // Doctor's own camera
  const remoteVideoRef = useRef<HTMLVideoElement>(null); // Patient's video (remote)
  const [cameraError, setCameraError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingSends = useRef<string[]>([]);
  const [liveLog, setLiveLog] = useState<string>("");
  const [inLiveConsult, setInLiveConsult] = useState(false);

  // Helper to log messages
  const logLive = (msg: string) => setLiveLog((l: string) => `[${new Date().toLocaleTimeString()}] ${msg}\n` + l);

  // --- WebRTC config ---
  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // --- Start as Receiver (Doctor) ---
  const startLiveReceiver = async () => {
    setInLiveConsult(true);
    logLive('Starting as receiver (doctor)...');

    // Create peer connection first so incoming offers can be handled immediately
    try {
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      pc.onicecandidate = e => {
        if (e.candidate) {
          const msg = JSON.stringify({ type: 'ice', candidate: e.candidate });
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(msg);
          } else {
            pendingSends.current.push(msg);
          }
          logLive('Queued/sent ICE candidate (receiver)');
        }
      };

      pc.ontrack = e => {
        if (remoteVideoRef.current && e.streams && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          try { remoteVideoRef.current.play().catch(()=>{}); } catch {}
          logLive('remoteVideo.srcObject set');
        }
      };
    } catch (err) {
      console.error('Failed to create RTCPeerConnection', err);
      logLive('PC create error: ' + String(err));
      return;
    }

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/live-consultation/receiver`;
    const ws = new window.WebSocket(wsUrl);
    wsRef.current = ws;

    const flushPending = () => {
      while (pendingSends.current.length && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const m = pendingSends.current.shift();
        if (m) wsRef.current.send(m);
      }
    };

    ws.onopen = () => { logLive('WebSocket open (receiver)'); flushPending(); };
    ws.onerror = (e) => { console.error('WebSocket error', e); logLive('WebSocket error'); };
    ws.onclose = () => { logLive('WebSocket closed'); };

    ws.onmessage = async ev => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'offer' && data.sdp) {
          logLive('Received offer, creating answer...');
          try {
            // set remote description
            await pcRef.current?.setRemoteDescription(data.sdp);
          } catch (err) {
            console.error('setRemoteDescription error', err);
            logLive('setRemoteDescription error: ' + String(err));
            return;
          }

          // ensure doctor's local camera stream is captured and added to pc so patient sees it
          try {
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStream;
              try { localVideoRef.current.play().catch(()=>{}); } catch {}
            }
            localStream.getTracks().forEach(t => pcRef.current?.addTrack(t, localStream));
            logLive('Doctor local stream added to pc');
          } catch (err) {
            console.error('getUserMedia error', err);
            logLive('Doctor getUserMedia error: ' + String(err));
          }

          try {
            const answer = await pcRef.current?.createAnswer();
            if (!answer) throw new Error('createAnswer returned empty');
            await pcRef.current?.setLocalDescription(answer);
            const ansMsg = JSON.stringify({ type: 'answer', sdp: pcRef.current?.localDescription });
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(ansMsg);
            } else {
              pendingSends.current.push(ansMsg);
            }
            logLive('Queued/sent answer');
          } catch (err) {
            console.error('Answer creation/sending error', err);
            logLive('Answer error: ' + String(err));
          }
        } else if (data.type === 'ice' && data.candidate) {
          try {
            const candidate = new RTCIceCandidate(data.candidate);
            await pcRef.current?.addIceCandidate(candidate);
            logLive('Added ICE candidate (receiver)');
          } catch (err) {
            console.error('addIceCandidate error', err);
            logLive('addIceCandidate error: ' + String(err));
          }
        }
      } catch (err) {
        console.error('WS parse/handler error', err);
        logLive('WS parse error: ' + String(err));
      }
    };
  };

  // --- End live consultation ---
  const endLiveConsultationFull = () => {
    setInLiveConsult(false);

    // stop any local media tracks
    try {
      const localStream = localVideoRef.current?.srcObject as MediaStream | null;
      if (localStream) {
        localStream.getTracks().forEach(t => {
          try { t.stop(); } catch {}
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn('Error stopping local media tracks', err);
    }

    // stop remote video element stream
    try {
      const remoteStream = remoteVideoRef.current?.srcObject as MediaStream | null;
      if (remoteStream) {
        remoteStream.getTracks().forEach(t => {
          try { t.stop(); } catch {}
        });
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn('Error stopping remote media tracks', err);
    }

    try { wsRef.current?.close(); } catch (e) { console.warn(e); }
    try { pcRef.current?.close(); } catch (e) { console.warn(e); }

    wsRef.current = null;
    pcRef.current = null;
    setLiveLog("");
    setInConsultation(false);
    setCurrentPatient(null);
    setActiveTab('queue');
  };

  // Camera preview for waiting state
  useEffect(() => {
    if (activeTab === 'consultation' && !inLiveConsult) {
      let stream: MediaStream | null = null;
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((mediaStream) => {
          stream = mediaStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = mediaStream;
          }
          setCameraError(null);
        })
        .catch((err) => {
          setCameraError('Unable to access camera: ' + err.message);
        });
      return () => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      };
    }
  }, [activeTab, inLiveConsult]);

  // For demo: stub remote stream with a placeholder color or video
  useEffect(() => {
    if (activeTab === 'consultation' && remoteVideoRef.current) {
      // For demo, leave remote video blank or set a test stream if available
      // In real use, assign remote stream from WebRTC here
    }
  }, [activeTab]);

  // --- Sample patient data (replace with API data) -----------------------
  const patients = [
    {
      id: 1,
      name: 'Pradeep Awasthi',
      time: '3:00 PM',
      status: 'waiting',
      urgency: 'normal',
      age: 34,
      bloodGroup: 'A+',
      allergies: 'None',
      lastVisit: 'Dec 1, 2024',
      meds: ['Vitamin D3', 'Calcium'],
    },
    {
      id: 2,
      name: 'Rahul Tewatiya',
      time: '3:15 PM',
      status: 'in-progress',
      urgency: 'urgent',
      age: 45,
      bloodGroup: 'B+',
      allergies: 'Penicillin',
      lastVisit: 'Nov 28, 2024',
      meds: ['Metformin'],
    },
    {
      id: 3,
      name: 'Meera Singh',
      time: '3:30 PM',
      status: 'scheduled',
      urgency: 'normal',
      age: 28,
      bloodGroup: 'O+',
      allergies: 'None',
      lastVisit: 'Oct 12, 2024',
      meds: [],
    },
    {
      id: 4,
      name: 'Amit Kumar',
      time: '3:45 PM',
      status: 'scheduled',
      urgency: 'high',
      age: 52,
      bloodGroup: 'AB+',
      allergies: 'Aspirin',
      lastVisit: 'Sep 20, 2024',
      meds: ['Atorvastatin'],
    },
  ];

  // --- Dummy live vitals (match PatientDashboard) -----------------------
  const vitalSigns = {
    heartRate: 72,
    bloodPressure: '120/80',
    temperature: 98.6,
    oxygenLevel: 98,
  };
  
  // parse systolic/diastolic
  const parseBP = (bp: string) => {
    const m = String(bp).match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return { sys: 120, dia: 80 };
    return { sys: Number(m[1]), dia: Number(m[2]) };
  };
  const initialBP = parseBP(vitalSigns.bloodPressure);
  
  const [liveHeartRate, setLiveHeartRate] = useState<number>(vitalSigns.heartRate);
  const [liveTemperature, setLiveTemperature] = useState<number>(vitalSigns.temperature);
  const [liveOxygen, setLiveOxygen] = useState<number>(vitalSigns.oxygenLevel);
  const [liveBP, setLiveBP] = useState<{ sys: number; dia: number }>(initialBP);
  const [liveLDR, setLiveLDR] = useState<number | null>(null);
  
  // helper to smoothly vary values
  function nextValue(prev: number, min: number, max: number, variance = 2) {
    const change = (Math.random() * 2 - 1) * variance;
    let next = Math.round(prev + change);
    if (next < min) next = min;
    if (next > max) next = max;
    return next;
  }

  // periodic updater (~3-4s) to simulate real measurements
  useEffect(() => {
    let mounted = true;
    let timer: number | null = null;
    const scheduleNext = () => {
      const ms = 3000 + Math.floor(Math.random() * 1000);
      timer = window.setTimeout(() => {
        if (!mounted) return;

  setLiveHeartRate((prev: number) => nextValue(prev, 55, 110, 3));

        setLiveTemperature((prev: number) => {
          const raw = nextValue(Math.round(prev * 10), Math.round(97.0 * 10), Math.round(100.5 * 10), 4);
          return Math.round(raw) / 10;
        });

  setLiveOxygen((prev: number) => nextValue(prev, 90, 100, 1));

        setLiveBP((prev: { sys: number; dia: number }) => {
          const sys = Math.max(90, Math.min(140, prev.sys + Math.floor((Math.random() * 2 - 1) * 4)));
          const dia = Math.max(55, Math.min(95, prev.dia + Math.floor((Math.random() * 2 - 1) * 3)));
          return { sys, dia };
        });

        setLiveLDR((prev: number | null) => {
          const base = prev ?? Math.floor(Math.random() * 4096);
          const v = Math.max(0, Math.min(4095, base + Math.floor((Math.random() * 2 - 1) * 300)));
          return v;
        });

        scheduleNext();
      }, ms);
    };
    scheduleNext();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // --- Interaction helpers -----------------------------------------------
  const startConsultation = (patient: any) => {
    // Mark the chosen patient as current and toggle consultation UI
    setCurrentPatient(patient);
    setInConsultation(true);
    setActiveTab('consultation');
    // Start WebRTC as receiver (doctor)
    setTimeout(() => startLiveReceiver(), 300); // slight delay to allow UI to update
  };

  const endConsultation = () => {
    endLiveConsultationFull();
  };

  // --- Render helpers ----------------------------------------------------
  const renderHome = () => {
    try {
      const doctorDetails = {
        name: effectiveDoctorName,
        image: effectiveDoctorImage,
        email: effectiveDoctorEmail,
        specialization: specialization,
        experience: experience,
        doctorId: doctorId,
        phone: effectiveDoctorPhone,
        bloodGroup: effectiveDoctorBloodGroup,
        age: effectiveDoctorAge,
        licenseNumber: licenseNumber,
        registrationNumber: registrationNumber,
        hospital: hospitalAffiliation,
        qualifications: qualifications,
        languages: languages,
        clinicAddress: clinicAddress,
        consultationFee: consultationFee
      };

      return (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left side - Details */}
          <div className="space-y-6">
            {/* Details table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header with Photo */}
              <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-gray-50 to-white border-b">
                <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-lg">
                  <img src={doctorDetails.image} alt="Doctor" className="w-full h-full object-cover" onError={handleAvatarError} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Dr. {doctorDetails.name}</h2>
                  <p className="text-sm text-emerald-600 font-medium">{doctorDetails.specialization}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600">
                      ID: {doctorDetails.doctorId}
                    </span>
                    <span className="px-2 py-1 bg-emerald-50 rounded-md text-xs font-medium text-emerald-600">
                      {doctorDetails.experience}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="divide-y divide-gray-100">
                {/* Personal Info Section */}
                <div className="p-4 bg-gray-50">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Personal Information</h3>
                  <div className="grid grid-cols-2 border rounded-lg bg-white overflow-hidden">
                    <DetailRow label="Languages" value={doctorDetails.languages} />
                    <DetailRow label="Blood Group" value={doctorDetails.bloodGroup} />
                  </div>
                </div>

                {/* Professional Info Section */}
                <div className="p-4 bg-gray-50">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Professional Details</h3>
                  <div className="grid grid-cols-2 border rounded-lg bg-white overflow-hidden">
                    <DetailRow label="License No." value={doctorDetails.licenseNumber} />
                    <DetailRow label="Registration" value={doctorDetails.registrationNumber} />
                    <DetailRow label="Hospital" value={doctorDetails.hospital} />
                    <DetailRow label="Experience" value={doctorDetails.experience} />
                  </div>
                </div>

                {/* Contact Info Section */}
                <div className="p-4 bg-gray-50">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contact & Practice</h3>
                  <div className="grid grid-cols-1 border rounded-lg bg-white overflow-hidden">
                    <DetailRow label="Phone" value={doctorDetails.phone} />
                    <DetailRow label="Consultation Fee" value={doctorDetails.consultationFee} />
                    <DetailRow 
                      label="Qualifications" 
                      value={doctorDetails.qualifications}
                      fullWidth
                    />
                    <DetailRow 
                      label="Clinic Address" 
                      value={doctorDetails.clinicAddress}
                      fullWidth
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="space-y-6">
            {/* Digital Card moved up */}
            <div className="flex justify-center -mt-4 mb-6">
              <div className="w-[340px] h-[200px] perspective-1000 animate-float">
                <div className="relative w-full h-full transition-transform duration-500 transform hover:scale-105 hover:rotate-1">
                  <div className="absolute w-full h-full bg-gradient-to-br from-indigo-600 via-blue-700 to-blue-800 rounded-2xl p-5 shadow-2xl border border-white/20">
                    {/* Medical Pattern Background */}
                    <div className="absolute inset-0 opacity-5">
                      <div className="w-full h-full grid grid-cols-8 gap-4">
                        {Array.from({ length: 32 }).map((_, i) => (
                          <div key={i} className="text-white text-2xl font-bold">+</div>
                        ))}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="relative h-full flex flex-col justify-between z-10">
                      {/* Card Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-white font-extrabold text-lg tracking-widest drop-shadow-md">
                            MEDTECH<span className="text-cyan-400">+</span>
                          </h3>
                          <p className="text-cyan-100 text-[10px] uppercase tracking-[0.2em]">Digital Health ID</p>
                        </div>
                        <div className="w-10 h-10 bg-white/10 rounded-lg p-1.5 shadow-lg backdrop-blur-sm">
                          <img src={profileImage} alt="logo" className="w-full h-full object-contain opacity-90" />
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="flex items-center gap-4 my-2">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg">
                          <img src={doctorDetails.image} alt="Doctor" className="w-full h-full object-cover" onError={handleAvatarError} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white text-sm font-semibold leading-tight tracking-wide">{doctorDetails.name}</h4>
                          <p className="text-[11px] text-cyan-200 leading-tight">{doctorDetails.specialization}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-blue-200 opacity-90">ID: {doctorDetails.doctorId}</span>
                            <span className="h-1 w-1 bg-blue-300 rounded-full opacity-50"></span>
                            <span className="text-[10px] text-blue-200 opacity-90">Valid Till: 07/31</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="flex justify-between items-end">
                        <div className="flex items-end gap-3">
                          <div className="space-y-[2px]">
                            <div className="w-8 h-[2px] bg-white/40 rounded"></div>
                            <div className="w-12 h-[2px] bg-white/40 rounded"></div>
                            <div className="w-6 h-[2px] bg-white/40 rounded"></div>
                          </div>
                          <div className="text-[8px] text-cyan-200 opacity-80 leading-tight">
                            <div>Verified Medical</div>
                            <div>Professional ID- 9354 9238 7416</div>
                          </div>
                        </div>

                        {/* QR Code */}
                        <div className="h-12 w-12 bg-white rounded-lg p-1 shadow-lg overflow-hidden flex items-center justify-center">
  <img 
    src={doctorImg} 
    alt="Doctor" 
    className="w-full h-full object-contain" 
  />
</div>
                      </div>

                      {/* Decorative Elements */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-8 -mt-8"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -ml-6 -mb-6"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* New Credentials Display */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-2 rounded-lg mr-3">
                  <FileText className="w-5 h-5" />
                </span>
                Professional Credentials
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Animated Credential Cards */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                  <div className="text-xs text-indigo-500 font-semibold mb-1">License Status</div>
                  <div className="text-sm text-gray-800">Active & Verified</div>
                  <div className="mt-2 flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                    <span className="text-xs text-gray-500">Valid till 2031</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                  <div className="text-xs text-emerald-500 font-semibold mb-1">Experience Level</div>
                  <div className="text-sm text-gray-800">{doctorDetails.experience}</div>
                  <div className="mt-2 text-xs text-gray-500">Specialist Verified</div>
                </div>
              </div>

              {/* Achievement Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-800">467</div>
                  <div className="text-xs text-gray-500">Patients Treated</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-800">4.6</div>
                  <div className="text-xs text-gray-500">Rating</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-800">15+</div>
                  <div className="text-xs text-gray-500">Years Practice</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
<div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl p-6">
  <h4 className="text-sm font-semibold text-gray-800 mb-4">Quick Actions</h4>
  <div className="grid grid-cols-2 gap-3">
    <button 
      onClick={() => setActiveTab('consultation')}
      className="flex items-center justify-center gap-2 bg-white/80 hover:bg-white p-3 rounded-lg text-sm font-medium text-gray-700 transition-all hover:shadow-md"
    >
      <Video className="w-4 h-4 text-purple-600" />
      Start Consultation
    </button>
    <button 
      onClick={() => setActiveTab('prescriptions')}
      className="flex items-center justify-center gap-2 bg-white/80 hover:bg-white p-3 rounded-lg text-sm font-medium text-gray-700 transition-all hover:shadow-md"
    >
      <FileText className="w-4 h-4 text-purple-600" />
      Write Prescription
    </button>
  </div>
</div>
          </div>
        </div>
      );
    } catch (err) {
      console.error('Error rendering home:', err);
      return (
        <div className="text-center py-12">
          <div className="inline-block p-6 bg-white rounded-lg shadow-lg">
            <p className="text-red-500 font-medium mb-4">Unable to load doctor details</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Retry Loading
            </button>
          </div>
        </div>
      );
    }
  };

  const renderOverviewCards = () => {
    return (
      <div className="grid md:grid-cols-4 gap-6 mb-6">
        {/* Card 1 */}
        <div className="bg-gradient-to-r from-[#ff7ab6] to-[#ff6a88] rounded-2xl p-6 shadow-xl text-white transition-transform transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Today's Patients</p>
              <p className="text-2xl font-bold">34</p>
            </div>
            <Users className="h-8 w-8 opacity-90" />
          </div>
          <p className="mt-3 text-sm opacity-80">Updated just now</p>
        </div>

        {/* Card 2 */}
        <div className="bg-gradient-to-r from-[#34d399] to-[#10b981] rounded-2xl p-6 shadow-xl text-white transition-transform transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Consultations Done</p>
              <p className="text-2xl font-bold">28</p>
            </div>
            <Video className="h-8 w-8 opacity-90" />
          </div>
          <p className="mt-3 text-sm opacity-80">This session</p>
        </div>

        {/* Card 3 */}
        <div className="bg-gradient-to-r from-[#fb923c] to-[#fb7185] rounded-2xl p-6 shadow-xl text-white transition-transform transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">In Queue</p>
              <p className="text-2xl font-bold">4</p>
            </div>
            <Clock className="h-8 w-8 opacity-90" />
          </div>
          <p className="mt-3 text-sm opacity-80">Average wait time: 8m</p>
        </div>

        {/* Card 4 */}
        <div className="bg-gradient-to-r from-[#7c3aed] to-[#4f46e5] rounded-2xl p-6 shadow-xl text-white transition-transform transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Avg. Time</p>
              <p className="text-2xl font-bold">15m</p>
            </div>
            <BarChart3 className="h-8 w-8 opacity-90" />
          </div>
          <p className="mt-3 text-sm opacity-80">Per consultation</p>
        </div>
      </div>
    );
  };

  const renderQueueList = () => {
    return (
      <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-6">Patient Queue</h2>

        <div className="space-y-4">
          {patients.map((patient) => {
            const urgencyColor =
              patient.urgency === 'urgent'
                ? 'bg-red-500'
                : patient.urgency === 'high'
                ? 'bg-orange-500'
                : 'bg-green-500';

            const statusBadge =
              patient.status === 'waiting'
                ? 'bg-yellow-100 text-yellow-800'
                : patient.status === 'in-progress'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800';

            return (
              <div
                key={patient.id}
                className="border border-white/8 rounded-lg p-4 hover:shadow-2xl transition-shadow bg-white/4"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-white/80" />
                    </div>

                    <div>
                      <h3 className="font-semibold">{patient.name}</h3>
                      <p className="text-sm opacity-80">
                        Age: {patient.age} &nbsp;|&nbsp; Scheduled: {patient.time}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${urgencyColor}`} />
                      <span className="text-sm opacity-90 capitalize">{patient.urgency}</span>
                    </div>

                    <span className={`text-xs font-medium px-2 py-1 rounded ${statusBadge}`}>
                      {patient.status}
                    </span>

                    <div>
                      <button
                        onClick={() => startConsultation(patient)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                        disabled={patient.status === 'in-progress' || inConsultation}
                      >
                        {patient.status === 'in-progress' || inConsultation ? 'In Progress' : 'Start'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQueue = () => {
    return (
      <div className="space-y-6">
        {renderOverviewCards()}

        {renderQueueList()}

        {/* Extra explanatory section */}
        <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
          <h3 className="font-semibold mb-2">How the queue works</h3>
          <p className="text-sm opacity-80">
            Patients are ordered by scheduled time. You can start a consultation which will mark the patient
            as in-progress. Ending a consultation will return you to the Queue view.
          </p>
        </div>
      </div>
    );
  };

  // ---------------- Consultation view -------------------------------------

  const ConsultationHeader = ({ patient }: { patient: any }) => {
    return (
      <div className="bg-emerald-600 text-white p-4 rounded-t-xl">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Consultation with {patient?.name}</h2>
            <p className="text-sm opacity-90">Age: {patient?.age} • Last visit: {patient?.lastVisit}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
              <span className="text-sm">Live</span>
            </div>

            <div className="text-sm opacity-90">ID: {patient?.id}</div>
          </div>
        </div>
      </div>
    );
  };

  // Show the remote (patient) video fullscreen, and doctor's own video as floating window
  const renderConsultationLeft = (_patient: any) => {
    return (
      <div className="lg:col-span-2 bg-gray-900 relative flex items-center justify-center rounded-b-xl overflow-hidden py-8">
        {/* Remote video (patient) fullscreen, match PatientDashboard size */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-[350px] md:h-[400px] object-cover rounded-xl bg-black border-4 border-emerald-500 shadow-lg"
          style={{ background: '#111' }}
        />
        {/* Doctor's own video as floating window, match PatientDashboard size */}
        <div className="absolute bottom-10 right-2 w-40 h-28 bg-black rounded-lg overflow-hidden border-2 border-white shadow-xl flex items-center justify-center">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover rounded-lg"
            style={{ background: '#222' }}
          />
        </div>
        {/* Camera error message */}
        {cameraError && <p className="absolute bottom-2 left-2 text-xs text-red-400">{cameraError}</p>}
      </div>
    );
  };

  const renderConsultationRightTop = (_patient: any) => {
    return (
      <div className="bg-white p-4">
        <h3 className="font-bold text-gray-900 mb-4">Patient Information</h3>

        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-gray-700">Blood Group:</span>
            <span className="ml-2 text-gray-600">{_patient?.bloodGroup || 'N/A'}</span>
          </div>

          <div>
            <span className="font-medium text-gray-700">Allergies:</span>
            <span className="ml-2 text-gray-600">{_patient?.allergies || 'None reported'}</span>
          </div>

          <div>
            <span className="font-medium text-gray-700">Last Visit:</span>
            <span className="ml-2 text-gray-600">{_patient?.lastVisit || '—'}</span>
          </div>

          <div>
            <span className="font-medium text-gray-700">Current Medications:</span>
            <div className="ml-2 text-gray-600">
              {_patient?.meds?.length ? (
                _patient.meds.map((m: string, idx: number) => <div key={idx}>• {m}</div>)
              ) : (
                <div>• None</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderVitalCard = (label: string, value: string, hint: string, colorClass: string) => {
    return (
      <div className="bg-white p-3 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{label}</span>
          <span className={`font-bold ${colorClass}`}>{value}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">{hint}</div>
      </div>
    );
  };

  const renderConsultationRightBottom = (_patient: any) => {
    return (
      <div className="bg-white p-4 border-l">
        <h3 className="font-bold text-gray-900 mb-4">Live Vitals</h3>

        <div className="space-y-4">
          {renderVitalCard('Heart Rate', `${liveHeartRate} BPM`, 'Dummy (simulated)', 'text-red-600')}
          {renderVitalCard('Blood Pressure', `${liveBP.sys}/${liveBP.dia}`, 'Dummy (simulated)', 'text-blue-600')}
          {renderVitalCard('Temperature', `${liveTemperature.toFixed(1)}°F`, 'Dummy (simulated)', 'text-orange-600')}
          {renderVitalCard('SpO2', `${liveOxygen}%`, 'Dummy (simulated)', 'text-green-600')}
          {renderVitalCard('Ambient Light (LDR)', liveLDR !== null ? String(liveLDR) : 'N/A', liveLDR !== null ? 'Dummy (simulated)' : 'No data', 'text-yellow-600')}
        </div>
      </div>
    );
  };

  const renderConsultation = () => {
    return (
      <div className="space-y-6">
        {inConsultation && currentPatient ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <ConsultationHeader patient={currentPatient} />

            <div className="grid lg:grid-cols-4 h-86">
              {/* Left: Video (remote fullscreen, local floating) */}
              {renderConsultationLeft(currentPatient)}

              {/* Middle-left: Patient Info */}
              <div className="bg-white p-4 border-l">{renderConsultationRightTop(currentPatient)}</div>

              {/* Right column: Vitals */}
              <div className="bg-white p-4 border-l">{renderConsultationRightBottom(currentPatient)}</div>
            </div>

            {/* Controls */}
            <div className="bg-gray-100 p-4">
              <div className="flex justify-between items-center">
                <div className="flex space-x-4">
                  <button className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors">
                    <Phone className="h-6 w-6" />
                  </button>

                  <button className="bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition-colors">
                    <MessageCircle className="h-6 w-6" />
                  </button>

                  <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                    Create Prescription
                  </button>
                </div>

                <div>
                  <button
                    onClick={() => endConsultation()}
                    className="bg-red-600 text-white px-8 py-4 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                  >
                    End Consultation
                  </button>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="p-4 border-t bg-white">
              <h3 className="font-bold text-gray-900 mb-2">Consultation Notes</h3>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24"
                placeholder="Enter consultation notes, diagnosis, and treatment plan..."
              />
            </div>
            {/* Debug log for live consultation */}
            <div className="p-2 bg-gray-100 text-xs text-gray-700 max-h-32 overflow-y-auto mt-2 rounded">
              <strong>Live Log:</strong>
              <pre>{liveLog}</pre>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center">
            {/* For demo, show only local video preview in the waiting state */}
            <div className="w-64 h-48 bg-black rounded-xl flex items-center justify-center mx-auto mb-4 overflow-hidden border-4 border-emerald-500 shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-xl"
                style={{ background: '#222' }}
              />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Active Consultation</h2>
            <p className="text-gray-600">Select a patient from the queue to start consultation</p>
            {cameraError && <p className="text-xs text-red-400 mt-2">{cameraError}</p>}
            <p className="text-xs opacity-60 mt-2">Your camera feed is always visible here for preview.</p>
          </div>
        )}
      </div>
    );
  };

  // ---------------- Prescriptions view -----------------------------------
  // Prescription form state (email-based, no IDs needed)
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [prescriptionForm, setPrescriptionForm] = useState({
    patientEmail: '',
    doctorEmail: email || '',
    date: new Date().toISOString().split('T')[0],
    diagnosis: '',
    medicines: [{ name: '', dosage: '', duration: '' }],
    instructions: ''
  });

  // Test function for button click
  const testButtonClick = () => {
    console.log('Button clicked!');
    alert('Share Prescription button was clicked!');
  };

  const handlePrescriptionChange = (field: string, value: string) => {
    setPrescriptionForm(prev => ({ ...prev, [field]: value }));
  };

  const handleMedicineChange = (index: number, field: string, value: string) => {
    setPrescriptionForm(prev => {
      const newMedicines = [...prev.medicines];
      newMedicines[index] = { ...newMedicines[index], [field]: value };
      return { ...prev, medicines: newMedicines };
    });
  };

  const addMedicine = () => {
    setPrescriptionForm(prev => ({
      ...prev,
      medicines: [...prev.medicines, { name: '', dosage: '', duration: '' }]
    }));
  };

  useEffect(() => {
    if (!prescriptionForm.doctorEmail && email) {
      setPrescriptionForm(prev => ({
        ...prev,
        doctorEmail: email,
      }));
    }
  }, [email]);

  const generateAndEmailPrescription = async () => {
    if (!prescriptionForm.patientEmail) {
      alert('Please enter patient email address');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');

    try {
      console.log('Creating prescription...');

      const payload = {
        patient_email: prescriptionForm.patientEmail,
        doctor_email: prescriptionForm.doctorEmail,
        date: prescriptionForm.date,
        diagnosis: prescriptionForm.diagnosis,
        instruction: prescriptionForm.instructions,
        medications: prescriptionForm.medicines.filter(m => m.name), // Filter out empty medicines
      };

      if (!payload.patient_email) {
        throw new Error('Patient email is required');
      }
      if (!payload.doctor_email) {
        throw new Error('Doctor email is required');
      }
      if (!payload.diagnosis) {
        throw new Error('Diagnosis is required');
      }

      const response = await fetch(buildApiUrl('/api/prescriptions/create'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create prescription');
      }

      const result = await response.json();
      console.log('Prescription created:', result);
      
      setErrorMessage('');
      alert('Prescription created and patient notified successfully!');
      
      // Reset form
      setPrescriptionForm({
        patientEmail: '',
        doctorEmail: email,
        date: new Date().toISOString().split('T')[0],
        diagnosis: '',
        medicines: [{ name: '', dosage: '', duration: '' }],
        instructions: ''
      });

    } catch (error) {
      console.error('Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(`Failed to send prescription: ${errorMsg}`);
      alert(`Failed: ${errorMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderPrescriptionsForm = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Prescription</h2>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                console.log('Share button clicked');
                generateAndEmailPrescription();
              }}
              className={`${isGenerating ? 'bg-gray-500' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-4 py-3 rounded-lg`}
              disabled={isGenerating}
            >
              {isGenerating ? 'Sending...' : 'Share Prescription'}
            </button>

            {errorMessage && (
              <div className="mt-2 text-red-500 text-sm">{errorMessage}</div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Email (Doctor)</label>
            <input
              type="email"
              className="w-full px-4 py-2 border text-gray-700 border-gray-300 rounded-lg bg-gray-50"
              placeholder="Auto-filled from profile"
              value={prescriptionForm.doctorEmail}
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Auto-filled from your profile</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patient Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border text-gray-700 border-gray-300 rounded-lg"
              placeholder="e.g., patient@example.com"
              value={prescriptionForm.patientEmail}
              onChange={(e) => handlePrescriptionChange('patientEmail', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input 
              type="date" 
              className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg"
              value={prescriptionForm.date}
              onChange={(e) => handlePrescriptionChange('date', e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
          <textarea
            className="w-full px-4 py-2 border text-gray-700 border-gray-300 rounded-lg h-20"
            placeholder="Enter diagnosis..."
            value={prescriptionForm.diagnosis}
            onChange={(e) => handlePrescriptionChange('diagnosis', e.target.value)}
          />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Medications</label>

          <div className="space-y-3">
            {prescriptionForm.medicines.map((medicine, index) => (
              <div key={index} className="grid md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Medicine name"
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg"
                  value={medicine.name}
                  onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Dosage"
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg"
                  value={medicine.dosage}
                  onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Duration"
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg"
                  value={medicine.duration}
                  onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                />
              </div>
            ))}

            <button 
              type="button"
              onClick={addMedicine}
              className="text-emerald-600 hover:text-emerald-800 text-sm"
            >
              + Add Another Medicine
            </button>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
          <textarea
            className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg h-20"
            placeholder="Special instructions for patient..."
            value={prescriptionForm.instructions}
            onChange={(e) => handlePrescriptionChange('instructions', e.target.value)}
          />
        </div>

        <div className="mt-6 flex space-x-4">
          <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
            Generate Prescription
          </button>

          <button className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Save as Draft
          </button>
        </div>
      </div>
    );
  };

  const renderRecentPrescriptions = () => {
    const recent = [
      { patient: 'Pradeep Awasthi', date: 'Dec 15, 2024', medicines: 2, status: 'Sent to Pharmacy' },
      { patient: 'Rahul Tewatia', date: 'Dec 15, 2024', medicines: 3, status: 'Dispensed' },
      { patient: 'Gunjan Saxena', date: 'Dec 14, 2024', medicines: 1, status: 'Dispensed' },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Prescriptions</h2>

        <div className="space-y-4">
          {recent.map((prescription, index) => {
            const badgeClass =
              prescription.status === 'Sent to Pharmacy' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';

            return (
              <div key={index} className="border border-white/8 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-900">{prescription.patient}</h3>
                    <p className="text-sm text-gray-600">
                      {prescription.date} • {prescription.medicines} medicines
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${badgeClass}`}>{prescription.status}</span>

                    <button className="text-emerald-600 hover:text-emerald-800 text-sm">View</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPrescriptions = () => {
    return (
      <div className="space-y-6">
        {renderPrescriptionsForm()}

        {renderRecentPrescriptions()}
      </div>
    );
  };

  // ---------------- Analytics view ---------------------------------------
  const renderAnalyticsOverview = () => {
    if (!analyticsData) {
      return (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-10 bg-gray-300 rounded"></div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-10 bg-gray-300 rounded"></div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-10 bg-gray-300 rounded"></div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-10 bg-gray-300 rounded"></div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Total Patients This Month</h3>
          <p className="text-3xl font-bold text-gray-900">{analyticsData.total_patients_this_month}</p>
          <p className={`text-sm mt-1 ${analyticsData.patient_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {analyticsData.patient_change_percent >= 0 ? '+' : ''}{analyticsData.patient_change_percent}% from last month
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Avg Consultation Time</h3>
          <p className="text-3xl font-bold text-gray-900">{analyticsData.avg_consultation_time}</p>
          <p className="text-sm text-red-600">{analyticsData.consultation_time_change}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Patient Satisfaction</h3>
          <p className="text-3xl font-bold text-gray-900">{analyticsData.patient_satisfaction}</p>
          <p className={`text-sm mt-1 ${analyticsData.satisfaction_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {analyticsData.satisfaction_change >= 0 ? '+' : ''}{analyticsData.satisfaction_change} from last month
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Prescriptions Issued</h3>
          <p className="text-3xl font-bold text-gray-900">{analyticsData.prescriptions_issued}</p>
          <p className={`text-sm mt-1 ${analyticsData.prescription_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {analyticsData.prescription_change_percent >= 0 ? '+' : ''}{analyticsData.prescription_change_percent}% from last month
          </p>
        </div>
      </div>
    );
  };

  const renderPatientFeedback = () => {
    if (!analyticsData?.patient_feedback) {
      return (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Patient Feedback</h3>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="h-5 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const feedback = analyticsData.patient_feedback;

    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Patient Feedback {feedback.length > 0 && `(${feedback.length})`}</h3>

        <div className="space-y-4">
          {feedback.length > 0 ? (
            feedback.map((f: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900">{f.patient_name}</h4>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= f.rating ? 'text-yellow-400' : 'text-gray-300'}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                {f.feedback_text && (
                  <p className="text-gray-700 text-sm italic">"{f.feedback_text}"</p>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No patient feedback yet</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCommonDiagnoses = () => {
    if (!analyticsData?.common_diagnoses) {
      return (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Common Diagnoses</h3>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between items-center animate-pulse">
                <div className="h-4 bg-gray-300 rounded w-24"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const items = analyticsData.common_diagnoses;

    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Common Diagnoses {items.length > 0 && `(${items.length})`}</h3>

        <div className="space-y-3">
          {items.length > 0 ? (
            items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{item.diagnosis}</p>
                  <p className="text-sm text-gray-600">{item.cases} case{item.cases !== 1 ? 's' : ''}</p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-emerald-600">{item.percentage}%</p>

                  <div className="w-36 bg-gray-200 rounded-full h-2 mt-1 overflow-hidden">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No diagnosis data yet</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    return (
      <div className="space-y-6">
        {renderAnalyticsOverview()}

        <div className="grid lg:grid-cols-2 gap-6">
          {renderPatientFeedback()}

          {renderCommonDiagnoses()}
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <div className="bg-white/6 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="font-semibold">Weekly Traffic</div>
                <div className="text-sm opacity-80">12.4k</div>
              </div>

              <svg width="80" height="36" viewBox="0 0 80 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2 28 C14 8 28 20 56 6 68 0 78 10 80 14"
                  stroke="#0f172a"
                  strokeOpacity="0.9"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="text-xs opacity-70">Medtech is getting popular...</div>
          </div>

          <div className="bg-white/6 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="font-semibold">Conversion Rate</div>
                <div className="text-sm opacity-80">4.1%</div>
              </div>

              <svg width="80" height="36" viewBox="0 0 80 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2 26 C14 16 30 8 56 18 68 22 78 14 80 16"
                  stroke="#0f172a"
                  strokeOpacity="0.9"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="text-xs opacity-70">Shows how many bookings convert</div>
          </div>

          <div className="bg-white/6 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="font-semibold">Avg Response Time</div>
                <div className="text-sm opacity-80">320ms</div>
              </div>

              <svg width="80" height="36" viewBox="0 0 80 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2 20 C14 16 28 26 56 12 68 6 78 12 80 14"
                  stroke="#0f172a"
                  strokeOpacity="0.9"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="text-xs opacity-70">API & system response time</div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------- Main render ------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1220] to-[#0b2537] text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#7c3aed] to-[#ec4899] shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/10 rounded-full drop-shadow-lg">
              <Activity className="h-8 w-8 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight">Doctor Dashboard</h1>
              <p className="text-sm opacity-80">
                {sessionUser || signedUser ? (
                  <>
                    Welcome back,{' '}
                    {(sessionUser?.role || signedUser?.role) === 'doctor' ? `Dr ${sessionUser?.name || signedUser?.name || 'Doctor'}` : sessionUser?.name || signedUser?.name || 'User'} !
                  </>
                ) : (
                  'Welcome back!'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm opacity-90 text-right">
              <div>Signed in as <span className="font-semibold">{profile?.email || sessionUser?.email || signedUser?.email || 'Not signed in'}</span></div>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20">
              <img
                src={avatarSrc}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={handleAvatarError}
              />
            </div>

            <button
              onClick={() => {
                try { localStorage.removeItem('token'); localStorage.removeItem('auth_token'); } catch {}
                try { localStorage.removeItem('role'); localStorage.removeItem('user_id'); } catch {}
                try { window.dispatchEvent(new CustomEvent('user-updated', { detail: null })); } catch {}
                if (onLogout) onLogout();
              }}
              className="bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white px-4 py-2 rounded-lg font-medium shadow hover:scale-[1.02] transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-6 py-3">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${
                activeTab === 'home'
                  ? 'bg-white/6 ring-1 ring-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/3'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span>Home</span>
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${
                activeTab === 'queue'
                  ? 'bg-white/6 ring-1 ring-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/3'
              }`}
            >
              <Users className="h-5 w-5" />
              <span>Patient Queue</span>
            </button>

            <button
              onClick={() => setActiveTab('consultation')}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${
                activeTab === 'consultation'
                  ? 'bg-white/6 ring-1 ring-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/3'
              }`}
            >
              <Video className="h-5 w-5" />
              <span>Consultation</span>
            </button>

            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${
                activeTab === 'prescriptions'
                  ? 'bg-white/6 ring-1 ring-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/3'
              }`}
            >
              <FileText className="h-5 w-5" />
              <span>Prescriptions</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white/6 ring-1 ring-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/3'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span>Analytics</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Render based on active tab */}
        {activeTab === 'home' && renderHome()}
        {activeTab === 'queue' && renderQueue()}
        {activeTab === 'consultation' && renderConsultation()}
        {activeTab === 'prescriptions' && renderPrescriptions()}
        {activeTab === 'analytics' && renderAnalytics()}
      </main>
    </div>
  );
};

export default DoctorDashboard;

// Add this helper component for consistent detail rows
const DetailRow = ({ label, value, fullWidth = false }: { 
  label: string; 
  value: string; 
  fullWidth?: boolean;
}) => (
  <div className={`${fullWidth ? 'col-span-2' : ''} border-b border-gray-100 p-3 group`}>
    <div className="text-sm font-semibold text-gray-800">{label}</div>
    <div className="text-sm text-gray-500 mt-1">{value}</div>
  </div>
);

// Add new animation class to your global CSS or inline styles
const styles = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
`;

// Add style tag to head
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
document.head.appendChild(styleSheet);
