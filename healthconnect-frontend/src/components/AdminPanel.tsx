import { useEffect, useState } from 'react';
import { Shield, Users, Activity, BarChart3, Settings, TrendingUp, Globe, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL, buildApiUrl } from '../config/api';
import { usePlatformSettings } from '../contexts/PlatformSettingsContext';

type SocketLike = {
  on: (eventName: string, callback: (...args: unknown[]) => void) => void;
  disconnect: () => void;
};

type IconComponent = {
  (props: { className?: string }): JSX.Element;
};

declare global {
  interface Window {
    io?: (url: string, options?: { transports?: string[] }) => SocketLike;
  }
}

interface AdminPanelProps {
  onLogout: () => void;
}

type PanelTab = 'dashboard' | 'users' | 'analytics' | 'system';
type UserRole = 'doctor' | 'patient' | 'pharmacy';
type UserStatus = 'active' | 'pending' | 'suspended' | 'inactive';
type AlertType = 'info' | 'warning' | 'critical';

type PanelUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  location: string;
  status: UserStatus;
  created_at: string;
  joinDate: string;
  gender?: string | null;
  blood_group?: string | null;
  bloodgroup?: string | null;
  specialization?: string | null;
  phone?: string | null;
  dob?: string | null;
  profile_pic?: string | null;
  picture?: string | null;
};

type AlertItem = {
  id: number;
  message: string;
  type: AlertType;
  created_at: string;
};

type DashboardPayload = {
  cards: {
    totalUsers: number;
    activeDoctors: number;
    patients: number;
    pharmacies: number;
    dailyConsultations: number;
    systemUptime: number;
    totalVisitors: number;
  };
  recentRegistrations: PanelUser[];
  alerts: AlertItem[];
};

type SpecializationItem = {
  specialization: string;
  count: number;
  doctors: Array<{ id?: number; name: string; email: string }>;
};

type AnalyticsPayload = {
  totalConsultations: number;
  revenue: number;
  patientSatisfaction: number;
  consultationTrends: Array<{ type: 'video' | 'kiosk'; count: number }>;
  dailyConsultations: Array<{ date: string; count: number }>;
  monthlyGrowth: Array<{ month: string; count: number }>;
  revenueTrend: Array<{ month: string; value: number }>;
  topSpecializations: SpecializationItem[];
};

type Toast = {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
};

type EditForm = {
  name: string;
  email: string;
  location: string;
  role: UserRole;
};

type PlatformSettingsForm = {
  platform_name: string;
  support_email: string;
  session_timeout: number;
  max_login_attempts: number;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Request failed';
};

const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const tabSlide = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const Card: React.FC<{ title: string; value: React.ReactNode; icon: IconComponent; gradient: string; meta?: string }> = ({ title, value, icon: Icon, gradient, meta }) => (
  <motion.div whileHover={{ scale: 1.03 }} className={`rounded-2xl p-5 shadow-2xl ${gradient} text-white transform-gpu`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm opacity-90">{title}</p>
        <p className="text-2xl font-extrabold tracking-tight mt-1">{value}</p>
      </div>
      <div className="opacity-90">
        <Icon className="h-8 w-8" />
      </div>
    </div>
    {meta && <p className="mt-3 text-sm opacity-80">{meta}</p>}
  </motion.div>
);

const StatProgress: React.FC<{ label: string; percent: number; accent?: string }> = ({ label, percent, accent }) => (
  <div>
    <div className="flex justify-between mb-2">
      <span className="text-sm opacity-90">{label}</span>
      <span className="text-sm font-semibold">{percent}%</span>
    </div>
    <div className="w-full bg-white/10 rounded-full h-2">
      <div className="h-2 rounded-full" style={{ width: `${percent}%`, background: accent || 'linear-gradient(90deg,#22c55e,#06b6d4)' }} />
    </div>
  </div>
);

const formatDate = (value: string) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getRandomDate = () => {
  const start = new Date('2025-11-20').getTime();
  const end = new Date('2026-04-17').getTime();
  return new Date(start + Math.random() * (end - start)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const normalizeRole = (value: unknown): UserRole => {
  const role = String(value || '').toLowerCase();
  if (role === 'doctor' || role === 'pharmacy') return role;
  return 'patient';
};

const normalizeStatus = (value: unknown): UserStatus => {
  const status = String(value || '').toLowerCase();
  if (status === 'active' || status === 'pending' || status === 'suspended') return status;
  return 'inactive';
};

const normalizeUser = (raw: Partial<PanelUser> & { id?: number | string }): PanelUser => {
  const created = typeof raw.created_at === 'string' ? raw.created_at : '';
  return {
    id: Number(raw.id || 0),
    name: (raw.name || 'Unknown User') as string,
    email: (raw.email || '-') as string,
    role: normalizeRole(raw.role),
    location: (raw.location || 'India') as string,
    status: normalizeStatus(raw.status),
    created_at: created,
    joinDate: created ? formatDate(created) : getRandomDate(),
    gender: raw.gender,
    blood_group: raw.blood_group,
    bloodgroup: raw.bloodgroup,
    specialization: raw.specialization,
    phone: raw.phone,
    dob: raw.dob,
    profile_pic: raw.profile_pic,
    picture: raw.picture,
  };
};

const formatRelative = (value: string) => {
  if (!value) return 'just now';
  const dt = new Date(value).getTime();
  if (!dt) return 'just now';
  const diffMs = Date.now() - dt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const roleLabel = (role: UserRole) => role.charAt(0).toUpperCase() + role.slice(1);

const roleBadgeClass = (role: UserRole) => {
  if (role === 'doctor') return 'bg-emerald-900/40';
  if (role === 'patient') return 'bg-blue-900/40';
  return 'bg-purple-900/40';
};

const statusBadgeClass = (status: UserStatus) => {
  if (status === 'active') return 'bg-emerald-900/40 text-emerald-200';
  return 'bg-red-900/40 text-red-200';
};

const alertCardClass = (type: AlertType) => {
  if (type === 'critical') return 'bg-red-900/40 border-red-500';
  if (type === 'warning') return 'bg-orange-900/40 border-orange-400';
  return 'bg-emerald-900/30 border-emerald-400';
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const { settings, saveSettings } = usePlatformSettings();

  const [activeTab, setActiveTab] = useState('dashboard' as PanelTab);
  const [users, setUsers] = useState([] as PanelUser[]);
  const [dashboard, setDashboard] = useState(null as DashboardPayload | null);
  const [analytics, setAnalytics] = useState(null as AnalyticsPayload | null);
  const [roleFilter, setRoleFilter] = useState('all' as 'all' | UserRole);
  const [statusFilter, setStatusFilter] = useState('all' as 'all' | UserStatus);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view' as 'view' | 'edit');
  const [selectedUser, setSelectedUser] = useState(null as PanelUser | null);
  const [editForm, setEditForm] = useState({ name: '', email: '', location: '', role: 'patient' as UserRole } as EditForm);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('patient' as UserRole);
  const [toasts, setToasts] = useState([] as Toast[]);
  const [hoveredSpecialization, setHoveredSpecialization] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<PlatformSettingsForm>({
    platform_name: 'MedTech',
    support_email: 'support@healthconnect.com',
    session_timeout: 30,
    max_login_attempts: 5,
  });

  const adminEmail = localStorage.getItem('admin_email') || 'pradeep240818@gmail.com';
  const [adminAvatar, setAdminAvatar] = useState(localStorage.getItem('role') === 'admin' ? '/admin.png' : '/default-avatar.png');

useEffect(() => {
  const fetchAdminProfile = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/users/me'), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await res.json();
      console.log("ADMIN API RESPONSE 👉", data);

      // ✅ FINAL CLEAN AVATAR PICK
     const avatar =
  data?.avatar ||
  data?.profile_picture_url ||
  data?.picture ||
  data?.profile_pic;

// ✅ FORCE admin logo if role = admin
const finalAvatar =
  data?.role === 'admin'
    ? '/admin.png'
    : avatar || '/default-avatar.png';

setAdminAvatar(finalAvatar);
    } catch (err) {
      console.error("Failed to load admin avatar", err);
    }
  };

  fetchAdminProfile();
}, []);
  const USERS_PER_PAGE = 8;

  useEffect(() => {
    setSettingsForm({
      platform_name: settings.platform_name,
      support_email: settings.support_email,
      session_timeout: settings.session_timeout,
      max_login_attempts: settings.max_login_attempts,
    });
  }, [settings]);

  const addToast = (message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev: Toast[]) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev: Toast[]) => prev.filter((t: Toast) => t.id !== id));
    }, 3500);
  };

  const getAdminToken = () => localStorage.getItem('token') || '';

  const adminFetch = async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const token = getAdminToken();
    const res = await fetch(buildApiUrl(endpoint), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body.error || `Request failed (${res.status})`);
    }

    return body as T;
  };

  const loadDashboard = async () => {
    const response = await adminFetch<{
      success?: boolean;
      cards?: DashboardPayload['cards'];
      totalUsers?: number;
      activeDoctors?: number;
      patients?: number;
      pharmacies?: number;
      dailyConsultations?: number;
      totalVisitors?: number;
      uptime?: number;
      recentUsers?: PanelUser[];
      recentRegistrations?: PanelUser[];
      alerts?: AlertItem[];
    }>('/api/admin/dashboard');

    const cards = response.cards || {
      totalUsers: Number(response.totalUsers || 0),
      activeDoctors: Number(response.activeDoctors || 0),
      patients: Number(response.patients || 0),
      pharmacies: Number(response.pharmacies || 0),
      dailyConsultations: Number(response.dailyConsultations || 0),
      totalVisitors: Number(response.totalVisitors || 0),
      systemUptime: Math.round(Number(response.uptime || 0)),
    };

    let recentRegistrations = (response.recentUsers || response.recentRegistrations || []).map((u) => normalizeUser(u));
    if (recentRegistrations.length === 0) {
      const recent = await adminFetch<PanelUser[]>('/api/admin/recent-users').catch(() => [] as PanelUser[]);
      recentRegistrations = recent.map((u) => normalizeUser(u));
    }

    setDashboard({ cards, recentRegistrations, alerts: response.alerts || [] });
  };

  const loadUsers = async (filters?: { search?: string; role?: string; status?: string }) => {
    const params = new URLSearchParams();
    const search = (filters?.search ?? searchTerm).trim();
    const role = filters?.role ?? roleFilter;
    const status = filters?.status ?? statusFilter;

    if (search) params.set('search', search);
    if (role && role !== 'all') params.set('role', role);
    if (status && status !== 'all') params.set('status', status);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await adminFetch<{ success?: boolean; users?: PanelUser[]; data?: PanelUser[] } | PanelUser[]>(`/api/admin/users${suffix}`);
    if (Array.isArray(response)) {
      setUsers(response.map((u) => normalizeUser(u)));
      return;
    }
    setUsers((response.users || response.data || []).map((u) => normalizeUser(u)));
  };

  const loadAnalytics = async () => {
    const response = await adminFetch<{
      success?: boolean;
      analytics?: AnalyticsPayload;
      totalConsultations?: number;
      revenue?: number;
      satisfaction?: number;
      dailyConsultations?: Array<{ date: string; count: number }>;
      monthlyGrowth?: Array<{ month: string; count: number }>;
      revenueTrend?: Array<{ month: string; value: number }>;
    }>('/api/admin/analytics');
    if (response.analytics) {
      setAnalytics(response.analytics);
      return;
    }

    const specializations = await adminFetch<Array<{ name: string; count: number; doctors?: Array<{ id?: number; name: string; email: string }> }>>('/api/admin/specializations').catch(() => [] as Array<{ name: string; count: number; doctors?: Array<{ id?: number; name: string; email: string }> }>);

    setAnalytics({
      totalConsultations: Number(response.totalConsultations || 0),
      revenue: Number(response.revenue || 0),
      patientSatisfaction: Number(response.satisfaction || 0),
      consultationTrends: [],
      dailyConsultations: response.dailyConsultations || [],
      monthlyGrowth: response.monthlyGrowth || [],
      revenueTrend: response.revenueTrend || [],
      topSpecializations: specializations.map((s) => ({ specialization: s.name, count: s.count, doctors: s.doctors || [] })),
    });
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadDashboard(), loadUsers(), loadAnalytics()]);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      addToast(message || 'Failed to load admin data', 'error');
      if (message.toLowerCase().includes('token')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      Promise.all([loadDashboard(), loadAnalytics()]).catch(() => {
        // Silent background refresh.
      });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    let socket: SocketLike | null = null;
    let mounted = true;

    const setupSocket = async () => {
      if (!window.io) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => resolve();
          document.body.appendChild(script);
        });
      }

      if (!mounted || !window.io) {
        return;
      }

      const wsEndpoint =
        (import.meta.env.VITE_API_URL as string | undefined) ||
        window.location.origin ||
        API_BASE_URL;

      socket = window.io(wsEndpoint, {
        transports: ['websocket'],
      });

      socket.on('new_user', (payloadRaw: unknown) => {
        const payload = normalizeUser(payloadRaw as PanelUser);
        setUsers((prev: PanelUser[]) => [payload, ...prev.filter((u: PanelUser) => u.id !== payload.id)]);
        setDashboard((prev: DashboardPayload | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            cards: { ...prev.cards, totalUsers: prev.cards.totalUsers + 1 },
            recentRegistrations: [payload, ...prev.recentRegistrations.filter((u: PanelUser) => u.id !== payload.id)].slice(0, 5),
          };
        });
        addToast(`New user registered: ${payload.name}`, 'success');
      });

      socket.on('system_alert', (payloadRaw: unknown) => {
        const payload = payloadRaw as AlertItem;
        setDashboard((prev: DashboardPayload | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            alerts: [payload, ...prev.alerts].slice(0, 10),
          };
        });
        addToast(payload.message, payload.type === 'critical' ? 'error' : payload.type === 'warning' ? 'warning' : 'info');
      });

      socket.on('user_status_changed', (payloadRaw: unknown) => {
        const payload = payloadRaw as PanelUser;
        const nextStatus = normalizeStatus(payload?.status);
        setUsers((prev: PanelUser[]) => prev.map((u: PanelUser) => (u.id === payload.id ? { ...u, status: nextStatus } : u)));
        setDashboard((prev: DashboardPayload | null) => {
          if (!prev) return prev;
          const nextRecent = prev.recentRegistrations.map((u: PanelUser) => (u.id === payload.id ? { ...u, status: nextStatus } : u));
          return { ...prev, recentRegistrations: nextRecent };
        });
        addToast(`Status updated: ${payload.name}`, 'info');
      });
    };

    setupSocket();

    return () => {
      mounted = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('admin_email');
    window.dispatchEvent(new CustomEvent('user-updated', { detail: null }));
    onLogout();
  };

  const openUserModal = async (user: PanelUser, mode: 'view' | 'edit') => {
    setBusy(true);
    try {
      const response = await adminFetch<{ success: boolean; user: PanelUser }>('/api/admin/users/' + user.id);
      setSelectedUser(normalizeUser(response.user));
      setModalMode(mode);
      setEditForm({
        name: response.user.name || user.name || '',
        email: response.user.email || user.email || '',
        location: response.user.location || user.location || 'India',
        role: normalizeRole(response.user.role || user.role),
      });
      setShowModal(true);
    } catch (error: unknown) {
      setSelectedUser(user);
      setModalMode(mode);
      setEditForm({
        name: user.name || '',
        email: user.email || '',
        location: user.location || 'India',
        role: user.role,
      });
      setShowModal(true);
      addToast(getErrorMessage(error) || 'Loaded limited user details', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const submitUserEdit = async () => {
    if (!selectedUser) return;

    setBusy(true);
    try {
      await adminFetch('/api/admin/users/' + selectedUser.id, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      await loadUsers();
      await loadDashboard();
      setShowModal(false);
      addToast('User updated successfully', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error) || 'Failed to update user', 'error');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (user: PanelUser, status: UserStatus) => {
    setBusy(true);
    try {
      await adminFetch('/api/admin/users/' + user.id + '/status?status=' + encodeURIComponent(status), {
        method: 'PUT',
      });
      await loadUsers();
      await loadDashboard();
      addToast(`Status updated to ${status}`, 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error) || 'Failed to update status', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      addToast('Invite email is required', 'warning');
      return;
    }

    setBusy(true);
    try {
      await adminFetch('/api/admin/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail('');
      addToast('Invite email sent successfully', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error) || 'Failed to send invite email', 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePlatformSettings = async () => {
    setBusy(true);
    try {
      const updated = await saveSettings(settingsForm);
      setSettingsForm({
        platform_name: updated.platform_name,
        support_email: updated.support_email,
        session_timeout: updated.session_timeout,
        max_login_attempts: updated.max_login_attempts,
      });
      addToast('Platform settings saved successfully', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error) || 'Failed to save settings', 'error');
    } finally {
      setBusy(false);
    }
  };

  const analyticsVideo = analytics?.consultationTrends.find((entry: { type: string; count: number }) => entry.type === 'video')?.count || 0;
  const analyticsKiosk = analytics?.consultationTrends.find((entry: { type: string; count: number }) => entry.type === 'kiosk')?.count || 0;
  const totalTrend = analyticsVideo + analyticsKiosk;
  const videoPercent = totalTrend ? Math.round((analyticsVideo / totalTrend) * 100) : 0;
  const kioskPercent = totalTrend ? Math.round((analyticsKiosk / totalTrend) * 100) : 0;

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'all' ? true : user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' ? true : user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE);
  const doctorCount = users.filter((u) => u.role === 'doctor').length;
  const patientCount = users.filter((u) => u.role === 'patient').length;
  const pharmacyCount = users.filter((u) => u.role === 'pharmacy').length;
  const hoveredSpecializationDetails = (analytics?.topSpecializations || []).find((s) => s.specialization === hoveredSpecialization);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1220] to-[#0b2537] text-white">
      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="inline-block">
              <div className="w-16 h-16 border-4 border-purple-400/30 border-t-purple-500 rounded-full animate-spin mb-4" />
            </div>
            <p className="text-white/90 font-semibold text-lg">Loading Admin Panel...</p>
            <p className="text-white/60 text-sm mt-2">Fetching system data</p>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-r from-[#7c3aed] to-[#ec4899] shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/10 rounded-full drop-shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{settings.platform_name} Admin Panel</h1>
              <p className="text-sm opacity-80">System Administration • {settings.platform_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm opacity-90 text-right">
              <div>Signed in as <span className="font-semibold">{adminEmail}</span></div>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 bg-white/10">
              <img src={adminAvatar} alt="Admin" className="w-full h-full object-cover" />
            </div>
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white font-medium shadow hover:scale-[1.02] transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white/5 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-6 py-3">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'users', label: 'User Management', icon: Users },
              { key: 'analytics', label: 'Analytics', icon: TrendingUp },
              { key: 'system', label: 'System Settings', icon: Settings },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === (t.key as PanelTab);
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as PanelTab)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-all ${active ? 'bg-white/6 ring-1 ring-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/3'}`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.section key="dashboard" variants={tabSlide} initial="hidden" animate="visible" exit="exit">
              <motion.div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <Card title="Total Users" value={<span>{dashboard?.cards.totalUsers || 0}</span>} icon={Users} gradient="bg-gradient-to-r from-[#ff7ab6] to-[#ff6a88]" meta="Live from users table" />
                <Card title="Active Doctors" value={<span>{dashboard?.cards.activeDoctors || 0}</span>} icon={Activity} gradient="bg-gradient-to-r from-[#34d399] to-[#10b981]" meta="role=doctor & status=active" />
                <Card title="Daily Consultations" value={<span>{dashboard?.cards.dailyConsultations || 0}</span>} icon={TrendingUp} gradient="bg-gradient-to-r from-[#7c3aed] to-[#4f46e5]" meta="Today" />
                <Card title="Total Visitors" value={<span>{(dashboard?.cards.totalVisitors || 0).toLocaleString()}</span>} icon={Globe} gradient="bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]" meta="Site traffic tracker" />
              </motion.div>

              <motion.div className="grid md:grid-cols-3 gap-4 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/20 px-4 py-3">
                  <div className="text-sm text-emerald-200/90">Doctors</div>
                  <div className="text-2xl font-bold text-emerald-200">{doctorCount}</div>
                </div>
                <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 px-4 py-3">
                  <div className="text-sm text-blue-200/90">Patients</div>
                  <div className="text-2xl font-bold text-blue-200">{patientCount}</div>
                </div>
                <div className="rounded-xl border border-purple-500/30 bg-purple-900/20 px-4 py-3">
                  <div className="text-sm text-purple-200/90">Pharmacies</div>
                  <div className="text-2xl font-bold text-purple-200">{pharmacyCount}</div>
                </div>
              </motion.div>

              <motion.div className="grid lg:grid-cols-2 gap-6 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-xl font-semibold mb-4">Recent User Registrations</h2>
                  <div className="space-y-3">
                    {(dashboard?.recentRegistrations || []).map((u: PanelUser) => (
                      <motion.div
                        key={u.id}
                        whileHover={{ y: -2, scale: 1.01 }}
                        className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-cyan-300/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={u.profile_pic || u.picture || '/default-avatar.png'}
                            alt={u.name}
                            className="w-10 h-10 rounded-full object-cover border border-white/20"
                          />
                          <div>
                          <div className="font-medium tracking-wide">{u.name}</div>
                          <div className="text-sm opacity-80">{roleLabel(u.role)} • {u.location || 'India'}</div>
                          </div>
                        </div>
                        <div className="text-sm opacity-70">{formatRelative(u.created_at)}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-xl font-semibold mb-4">System Alerts</h2>
                  <div className="space-y-3">
                    {(dashboard?.alerts || []).map((a: AlertItem) => (
                      <div key={a.id} className={`p-3 rounded-lg border-l-4 ${alertCardClass(a.type)}`}>
                        <div className="font-medium">{a.message}</div>
                        <div className="text-sm opacity-80 mt-1">{formatRelative(a.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.section>
          )}

          {activeTab === 'users' && (
            <motion.section key="users" variants={tabSlide} initial="hidden" animate="visible" exit="exit">
              <motion.div className="mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">User Management</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
  className="bg-white/5 px-3 py-2 rounded-md text-white w-64 max-w-full 
             border border-white/10 
             placeholder-gray-400 
             outline-none focus:outline-none focus-visible:outline-none
             focus:ring-2 focus:ring-blue-500 
             focus:ring-offset-2 focus:ring-offset-[#0f172a]
             focus:border-blue-500 transition-all duration-200"
  type="text"
  placeholder="Search by name, email..."
  value={searchTerm}
  onChange={(e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  }}
/>
                    <select
  className="bg-[#0f172a] px-3 py-2 rounded-md text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
  value={roleFilter}
  onChange={(e) => {
    const next = e.target.value as 'all' | UserRole;
    setRoleFilter(next);
    setPage(1);
  }}
>
  <option value="all" className="bg-[#0f172a] text-white">All Roles</option>
  <option value="patient" className="bg-[#0f172a] text-white">Patient</option>
  <option value="doctor" className="bg-[#0f172a] text-white">Doctor</option>
  <option value="pharmacy" className="bg-[#0f172a] text-white">Pharmacy</option>
</select>
                    <select
                      className="bg-[#0f172a] px-3 py-2 rounded-md text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={statusFilter}
                      onChange={(e) => {
                        const next = e.target.value as 'all' | UserStatus;
                        setStatusFilter(next);
                        setPage(1);
                      }}
                    >
                      <option value="all" className="bg-[#0f172a] text-white">All Status</option>
                      <option value="active" className="bg-[#0f172a] text-white">Active</option>
                      <option value="inactive" className="bg-[#0f172a] text-white">Suspended</option>
                      <option value="pending" className="bg-[#0f172a] text-white">Pending</option>
                    </select>
                 <button
  className="px-4 py-2 rounded-md bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] 
             text-white 
             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f172a]"
  onClick={() => {
    setPage(1);
    loadUsers({
      search: searchTerm,
      role: roleFilter,
      status: statusFilter,
    });
  }}
>
  Search Users
</button>
                  </div>
                </div>
              </motion.div>

              <motion.div className="bg-white/6 rounded-2xl shadow-xl p-4 border border-white/10" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="overflow-x-auto overflow-y-auto max-h-[28rem] rounded-xl">
                  <table className="min-w-full text-left table-auto border-separate border-spacing-0">
                    <thead className="sticky top-0 bg-[#0f172a]/95 backdrop-blur">
                    <tr className="text-sm text-white/80">
                      <th className="px-4 py-3 border-b border-white/15">Name</th>
                      <th className="px-4 py-3 border-b border-white/15">Role</th>
                      <th className="px-4 py-3 border-b border-white/15">Location</th>
                      <th className="px-4 py-3 border-b border-white/15">Join Date</th>
                      <th className="px-4 py-3 border-b border-white/15">Status</th>
                      <th className="px-4 py-3 border-b border-white/15">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {paginatedUsers.map((u: PanelUser) => (
                      <tr key={u.id} className="odd:bg-white/3 hover:bg-white/6 transition">
                        <td className="px-4 py-3 border-b border-white/10">
                          <div className="font-medium">{u.name || 'Unknown User'}</div>
                          <div className="text-xs opacity-75">{u.email || '-'}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-white/10">
                          <span className={`text-sm px-2 py-1 rounded ${roleBadgeClass(u.role)}`}>{roleLabel(u.role)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm opacity-90 border-b border-white/10">{u.location || 'India'}</td>
                        <td className="px-4 py-3 text-sm opacity-80 border-b border-white/10">{u.joinDate}</td>
                        <td className="px-4 py-3 border-b border-white/10">
                          <span className={`text-sm px-2 py-1 rounded ${statusBadgeClass(u.status || 'inactive')}`}>
                            {u.status || 'inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-white/10">
                          <div className="flex gap-3 text-sm">
                            <button className="underline" onClick={() => openUserModal(u, 'view')}>View</button>
                            <button className="underline" onClick={() => openUserModal(u, 'edit')}>Edit</button>
                            {u.status === 'pending' && <button className="underline text-emerald-300" onClick={() => updateStatus(u, 'active')}>Approve</button>}
                            {u.status === 'inactive' || u.status === 'suspended'
                              ? <button className="underline text-emerald-300" onClick={() => updateStatus(u, 'active')}>Activate</button>
                              : <button className="underline text-red-300" onClick={() => updateStatus(u, 'inactive')}>Suspend</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <div className="opacity-80">
                    Showing {filteredUsers.length === 0 ? 0 : (safePage - 1) * USERS_PER_PAGE + 1}-
                    {Math.min(safePage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 rounded-md bg-white/10 disabled:opacity-40"
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      disabled={safePage <= 1}
                    >
                      Prev
                    </button>
                    <span className="opacity-85">Page {safePage} / {totalPages}</span>
                    <button
                      className="px-3 py-1 rounded-md bg-white/10 disabled:opacity-40"
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                      disabled={safePage >= totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </motion.div>

              <motion.div className="mt-6 bg-white/6 p-6 rounded-2xl shadow-xl" variants={fadeInUp} initial="hidden" animate="visible">
                <h3 className="text-lg font-semibold mb-4">Create / Invite User</h3>
                <form className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" onSubmit={sendInvite}>
                 <input
  className="px-4 py-3 rounded-md 
             bg-white/5 text-white 
             placeholder-gray-400 
             border border-white/10 
             outline-none focus:outline-none focus-visible:outline-none
             focus:ring-2 focus:ring-blue-500 
             focus:ring-offset-2 focus:ring-offset-[#0f172a]
             focus:border-blue-500 
             transition-all duration-200"
  placeholder="Invite email"
  value={inviteEmail}
  onChange={(e) => setInviteEmail(e.target.value)}
/>
                 <select
  className="px-4 py-3 rounded-md 
             bg-[#0f172a] text-white 
             border border-white/10 
             outline-none focus:outline-none focus-visible:outline-none
             focus:ring-2 focus:ring-blue-500 
             focus:ring-offset-2 focus:ring-offset-[#0f172a]
             focus:border-blue-500 
             transition-all duration-200"
  value={inviteRole}
  onChange={(e) => setInviteRole(e.target.value as UserRole)}
>
  <option value="patient" className="bg-[#0f172a] text-white">Patient</option>
  <option value="doctor" className="bg-[#0f172a] text-white">Doctor</option>
  <option value="pharmacy" className="bg-[#0f172a] text-white">Pharmacy</option>
</select>
                  <div className="flex items-center gap-3">
                    <button type="submit" className="px-4 py-2 rounded-md bg-gradient-to-r from-[#7c3aed] to-[#ef4444]">Invite</button>
                    <button type="button" onClick={() => { setInviteEmail(''); setInviteRole('patient'); }} className="px-4 py-2 rounded-md bg-white/5">Clear</button>
                  </div>
                </form>
              </motion.div>
            </motion.section>
          )}

          {activeTab === 'analytics' && (
            <motion.section key="analytics" variants={tabSlide} initial="hidden" animate="visible" exit="exit">
              <motion.div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <Card title="Total Consultations" value={<span>{analytics?.totalConsultations || 0}</span>} icon={BarChart3} gradient="bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]" meta="From consultations table" />
                <Card title="Revenue Generated" value={<span>₹{((analytics?.revenue || 0) / 100000).toFixed(1)}L</span>} icon={TrendingUp} gradient="bg-gradient-to-r from-[#f97316] to-[#ef4444]" meta="SUM(fee)" />
                <Card title="Patient Satisfaction" value={<span>{(analytics?.patientSatisfaction || 0).toFixed(1)}/5</span>} icon={Users} gradient="bg-gradient-to-r from-[#34d399] to-[#10b981]" meta="AVG(rating)" />
                <Card title="System Performance" value={<span>Live</span>} icon={Globe} gradient="bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed]" meta="Realtime analytics" />
              </motion.div>

              <motion.div className="grid lg:grid-cols-2 gap-6" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h3 className="font-semibold mb-4">Consultation Trends</h3>
                  <StatProgress label="Video Consultations" percent={videoPercent} />
                  <div className="mt-4">
                    <StatProgress label="Kiosk Consultations" percent={kioskPercent} accent="linear-gradient(90deg,#3b82f6,#06b6d4)" />
                  </div>
                </div>

                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h3 className="font-semibold mb-4">Top Specializations</h3>
                  <div className="space-y-3 relative">
                    {(analytics?.topSpecializations || []).slice(0, 5).map((s: SpecializationItem, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between items-center rounded-lg px-3 py-2 hover:bg-white/8 cursor-default"
                        onMouseEnter={() => setHoveredSpecialization(s.specialization)}
                        onMouseLeave={() => setHoveredSpecialization((curr) => (curr === s.specialization ? null : curr))}
                      >
                        <div>
                          <div className="font-medium">{s.specialization || 'General'}</div>
                          <div className="text-sm opacity-80">{s.count} consultations</div>
                        </div>
                        <div className="font-bold text-emerald-300">{analytics?.totalConsultations ? Math.round((s.count / analytics.totalConsultations) * 100) : 0}%</div>
                      </div>
                    ))}

                    {hoveredSpecialization && hoveredSpecializationDetails && (
                      <div className="absolute right-2 top-2 w-72 rounded-xl border border-cyan-400/30 bg-[#071327]/95 backdrop-blur p-3 shadow-2xl z-20">
                        <div className="font-semibold text-cyan-200 mb-2">{hoveredSpecialization} Doctors</div>
                        {(hoveredSpecializationDetails.doctors || []).length === 0 ? (
                          <div className="text-sm opacity-80">No doctors found</div>
                        ) : (
                          <div className="space-y-2 max-h-44 overflow-auto">
                            {hoveredSpecializationDetails.doctors.map((doc, idx) => (
                              <div key={doc.id || idx} className="text-sm border-b border-white/10 pb-1">
                                <div className="font-medium">{doc.name}</div>
                                <div className="opacity-80">{doc.email}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.section>
          )}

          {activeTab === 'system' && (
            <motion.section key="system" variants={tabSlide} initial="hidden" animate="visible" exit="exit">
              <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-6 overflow-x-hidden" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="bg-white/6 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-semibold mb-4">General Settings</h3>
                  <div className="space-y-4">
                    <label className="block text-sm opacity-90">Platform Name</label>
                    <input
                      value={settingsForm.platform_name}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, platform_name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-md bg-white/5 focus:ring-2 focus:ring-pink-400"
                    />
                    <label className="block text-sm opacity-90">Support Email</label>
                    <input
                      value={settingsForm.support_email}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, support_email: e.target.value }))}
                      className="w-full px-4 py-3 rounded-md bg-white/5 focus:ring-2 focus:ring-cyan-400"
                    />
                  </div>
                </div>

                <div className="bg-white/6 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-semibold mb-4">Security Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm opacity-90">Session Timeout (minutes)</label>
                      <input
                        type="number"
                        value={settingsForm.session_timeout}
                        onChange={(e) => setSettingsForm((prev) => ({ ...prev, session_timeout: Number(e.target.value || 1) }))}
                        className="w-full px-4 py-3 rounded-md bg-white/5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm opacity-90">Max Login Attempts</label>
                      <input
                        type="number"
                        value={settingsForm.max_login_attempts}
                        onChange={(e) => setSettingsForm((prev) => ({ ...prev, max_login_attempts: Number(e.target.value || 1) }))}
                        className="w-full px-4 py-3 rounded-md bg-white/5"
                      />
                    </div>
                  </div>
                  <button onClick={savePlatformSettings} className="mt-6 px-4 py-2 rounded-md bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]">
                    Save Settings
                  </button>
                </div>
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {showModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0f172a] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{modalMode === 'view' ? 'User Details' : 'Edit User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white"><X /></button>
            </div>

            {modalMode === 'view' ? (
              <div className="space-y-3 text-sm">
                <div><span className="opacity-70">Name:</span> {selectedUser.name}</div>
                <div><span className="opacity-70">Email:</span> {selectedUser.email}</div>
                <div><span className="opacity-70">Role:</span> {roleLabel(selectedUser.role)}</div>
                <div><span className="opacity-70">Gender:</span> {selectedUser.gender || 'Not specified'}</div>
                <div><span className="opacity-70">Blood Group:</span> {selectedUser.blood_group || selectedUser.bloodgroup || 'Not specified'}</div>
                {selectedUser.role === 'doctor' && (
                  <div><span className="opacity-70">Specialized In:</span> {selectedUser.specialization || 'Not specified'}</div>
                )}
                <div><span className="opacity-70">Phone:</span> {selectedUser.phone || 'Not specified'}</div>
                <div><span className="opacity-70">DOB:</span> {selectedUser.dob || 'Not specified'}</div>
                <div><span className="opacity-70">Status:</span> {selectedUser.status || 'inactive'}</div>
                <div><span className="opacity-70">Location:</span> {selectedUser.location || 'India'}</div>
                <div><span className="opacity-70">Joined:</span> {selectedUser.joinDate || formatDate(selectedUser.created_at)}</div>
              </div>
            ) : (
              <div className="space-y-3">
                <input className="w-full px-4 py-3 rounded-md bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.name} onChange={(e) => setEditForm((p: EditForm) => ({ ...p, name: e.target.value }))} />
                <input className="w-full px-4 py-3 rounded-md bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.email} onChange={(e) => setEditForm((p: EditForm) => ({ ...p, email: e.target.value }))} />
                <input className="w-full px-4 py-3 rounded-md bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.location} onChange={(e) => setEditForm((p: EditForm) => ({ ...p, location: e.target.value }))} />
                <select
  className="w-full px-4 py-3 rounded-md bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
  value={editForm.role}
  onChange={(e) =>
    setEditForm((p: EditForm) => ({
      ...p,
      role: e.target.value as UserRole,
    }))
  }
>
  <option value="patient" className="bg-[#0f172a] text-white">Patient</option>
  <option value="doctor" className="bg-[#0f172a] text-white">Doctor</option>
  <option value="pharmacy" className="bg-[#0f172a] text-white">Pharmacy</option>
</select>
                <div className="flex gap-3">
                  <button className="px-4 py-2 rounded-md bg-gradient-to-r from-[#34d399] to-[#10b981]" onClick={submitUserEdit}>Save</button>
                  <button className="px-4 py-2 rounded-md bg-white/10" onClick={() => setShowModal(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map((toast: Toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg border text-sm ${
              toast.tone === 'success'
                ? 'bg-emerald-900/90 border-emerald-400'
                : toast.tone === 'error'
                ? 'bg-red-900/90 border-red-400'
                : toast.tone === 'warning'
                ? 'bg-orange-900/90 border-orange-400'
                : 'bg-blue-900/90 border-blue-400'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {busy && (
        <div className="fixed inset-0 z-40 bg-black/40 pointer-events-none" />
      )}
    </div>
  );
};

export default AdminPanel;
