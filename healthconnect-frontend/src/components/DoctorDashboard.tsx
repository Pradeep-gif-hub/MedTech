import React, { useState, useEffect, useRef } from 'react';
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
  Heart,
  Settings,
  UserCheck,
  UserX,
  Globe,
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

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ onLogout }) => {
  // --- Local UI state ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<
    'queue' | 'consultation' | 'prescriptions' | 'analytics'
  >('queue');

  const [inConsultation, setInConsultation] = useState<boolean>(false);

  const [currentPatient, setCurrentPatient] = useState<any>(null);

  // --- Camera feed and WebRTC state --------------------------------------
  const localVideoRef = useRef<HTMLVideoElement>(null); // Doctor's own camera
  const remoteVideoRef = useRef<HTMLVideoElement>(null); // Patient's video (remote)
  const [cameraError, setCameraError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingSends = useRef<string[]>([]);
  const [liveLog, setLiveLog] = useState<string>("");
  const [inLiveConsult, setInLiveConsult] = useState(false);

  // Helper to log messages
  const logLive = (msg: string) => setLiveLog(l => `[${new Date().toLocaleTimeString()}] ${msg}\n` + l);

  // --- WebRTC config ---
  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // --- Start as Receiver (Doctor) ---
  const startLiveReceiver = async () => {
    setInLiveConsult(true);
    logLive('Starting as receiver (doctor)...');
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
    ws.onerror = _e => logLive('WebSocket error');
    ws.onclose = () => logLive('WebSocket closed');
    ws.onmessage = async ev => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'offer') {
          logLive('Received offer, creating answer...');
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
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
            logLive('Doctor getUserMedia error: ' + err);
          }

          const answer = await pcRef.current?.createAnswer();
          await pcRef.current?.setLocalDescription(answer);
          const ansMsg = JSON.stringify({ type: 'answer', sdp: pcRef.current?.localDescription });
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(ansMsg);
          } else {
            pendingSends.current.push(ansMsg);
          }
          logLive('Queued/sent answer');
        } else if (data.type === 'ice' && data.candidate) {
          await pcRef.current?.addIceCandidate(data.candidate);
          logLive('Added ICE candidate (receiver)');
        }
      } catch (err) { logLive('WS parse error: ' + err); }
    };
    // Create peer connection
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
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
        logLive('remoteVideo.srcObject set');
      }
    };
  };

  // --- End live consultation ---
  const endLiveConsultationFull = () => {
    setInLiveConsult(false);
    try { wsRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
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

        setLiveHeartRate(prev => nextValue(prev, 55, 110, 3));

        setLiveTemperature(prev => {
          const raw = nextValue(Math.round(prev * 10), Math.round(97.0 * 10), Math.round(100.5 * 10), 4);
          return Math.round(raw) / 10;
        });

        setLiveOxygen(prev => nextValue(prev, 90, 100, 1));

        setLiveBP(prev => {
          const sys = Math.max(90, Math.min(140, prev.sys + Math.floor((Math.random() * 2 - 1) * 4)));
          const dia = Math.max(55, Math.min(95, prev.dia + Math.floor((Math.random() * 2 - 1) * 3)));
          return { sys, dia };
        });

        setLiveLDR(prev => {
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
                        disabled={patient.status === 'in-progress'}
                      >
                        {patient.status === 'in-progress' ? 'In Progress' : 'Start'}
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
  const renderPrescriptionsForm = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Create New Prescription</h2>

          <div>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
              Quick Templates
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patient ID</label>
            <input
              type="text"
              className="w-full px-4 py-2 border text-gray-700 border-gray-300 rounded-lg"
              placeholder="Search patient..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Doctor ID</label>
            <input
              type="text"
              className="w-full px-4 py-2 border text-gray-700 border-gray-300 rounded-lg"
              placeholder="Search Doctor..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input type="date" className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg" />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
          <textarea
            className="w-full px-4 py-2 border text-gray-700 border-gray-300 rounded-lg h-20"
            placeholder="Enter diagnosis..."
          />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Medications</label>

          <div className="space-y-3">
            <div className="grid md:grid-cols-3 gap-4">
              <input type="text" placeholder="Medicine name" className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg" />
              <input type="text" placeholder="Dosage" className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg" />
              <input type="text" placeholder="Duration" className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg" />
            </div>

            <button className="text-emerald-600 hover:text-emerald-800 text-sm">+ Add Another Medicine</button>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
          <textarea
            className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg h-20"
            placeholder="Special instructions for patient..."
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
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Total Patients This Month</h3>
          <p className="text-3xl font-bold text-gray-900">342</p>
          <p className="text-sm text-green-600">+12% from last month</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Avg Consultation Time</h3>
          <p className="text-3xl font-bold text-gray-900">15min</p>
          <p className="text-sm text-red-600">+2min from last month</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Patient Satisfaction</h3>
          <p className="text-3xl font-bold text-gray-900">4.8/5</p>
          <p className="text-sm text-green-600">+0.2 from last month</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Prescriptions Issued</h3>
          <p className="text-3xl font-bold text-gray-900">289</p>
          <p className="text-sm text-green-600">+8% from last month</p>
        </div>
      </div>
    );
  };

  const renderPatientFeedback = () => {
    const feedback = [
      { name: 'Pradeep Awasthi', rating: 5, comment: 'Excellent consultation. Doctor was very patient and thorough.' },
      { name: 'Vishal Buttler', rating: 5, comment: 'Great experience. The platform is easy to use.' },
      { name: 'Gunjan Saxena', rating: 2, comment: 'Did not give proper time to consult' },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Patient Feedback</h3>

        <div className="space-y-4">
          {feedback.map((f, i) => (
            <div key={i} className="border border-white/8 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900">{f.name}</h4>

                <div className="flex">
                  {[...Array(f.rating)].map((_, idx) => (
                    <span key={idx} className="text-yellow-400">
                      ★
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-sm text-gray-600">{f.comment}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCommonDiagnoses = () => {
    const items = [
      { diagnosis: 'Common Cold', count: 45, percentage: 35 },
      { diagnosis: 'Hypertension', count: 32, percentage: 25 },
      { diagnosis: 'Diabetes Follow-up', count: 28, percentage: 22 },
      { diagnosis: 'Skin Conditions', count: 23, percentage: 18 },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Common Diagnoses</h3>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900">{item.diagnosis}</p>
                <p className="text-sm text-gray-600">{item.count} cases</p>
              </div>

              <div className="text-right">
                <p className="font-bold text-emerald-600">{item.percentage}%</p>

                <div className="w-36 bg-gray-200 rounded-full h-2 mt-1 overflow-hidden">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            </div>
          ))}
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
              <p className="text-sm opacity-80">Welcome back, Dr Paarth Lalit !</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm opacity-90">Signed in as <span className="font-semibold">paarthl.ic.24@nitj.ac.in</span></div>

            <button
              onClick={onLogout}
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
        {activeTab === 'queue' && renderQueue()}

        {activeTab === 'consultation' && renderConsultation()}

        {activeTab === 'prescriptions' && renderPrescriptions()}

        {activeTab === 'analytics' && renderAnalytics()}
      </main>
    </div>
  );
};

export default DoctorDashboard;
