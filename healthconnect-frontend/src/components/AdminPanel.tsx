import { useEffect, useState } from 'react';
import { Shield, Users, Activity, BarChart3, Settings, TrendingUp, Globe, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL, buildApiUrl } from '../config/api';

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
type UserStatus = 'active' | 'pending' | 'suspended';
type AlertType = 'info' | 'warning' | 'critical';

type PanelUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  location: string;
  status: UserStatus;
  created_at: string;
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
    dailyConsultations: number;
    systemUptime: number;
  };
  recentRegistrations: PanelUser[];
  alerts: AlertItem[];
};

type AnalyticsPayload = {
  totalConsultations: number;
  revenue: number;
  patientSatisfaction: number;
  consultationTrends: Array<{ type: 'video' | 'kiosk'; count: number }>;
  topSpecializations: Array<{ specialization: string; count: number }>;
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
  if (status === 'active') return 'bg-emerald-900/40';
  if (status === 'pending') return 'bg-amber-900/40';
  return 'bg-red-900/40';
};

const alertCardClass = (type: AlertType) => {
  if (type === 'critical') return 'bg-red-900/40 border-red-500';
  if (type === 'warning') return 'bg-orange-900/40 border-orange-400';
  return 'bg-emerald-900/30 border-emerald-400';
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard' as PanelTab);
  const [users, setUsers] = useState([] as PanelUser[]);
  const [dashboard, setDashboard] = useState(null as DashboardPayload | null);
  const [analytics, setAnalytics] = useState(null as AnalyticsPayload | null);
  const [roleFilter, setRoleFilter] = useState('all' as 'all' | UserRole);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view' as 'view' | 'edit');
  const [selectedUser, setSelectedUser] = useState(null as PanelUser | null);
  const [editForm, setEditForm] = useState({ name: '', email: '', location: '', role: 'patient' as UserRole } as EditForm);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('patient' as UserRole);
  const [toasts, setToasts] = useState([] as Toast[]);

  const adminEmail = localStorage.getItem('admin_email') || 'pradeep240818@gmail.com';
  const adminAvatar = localStorage.getItem('admin_profile_pic') || '/default-avatar.png';

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
      dailyConsultations?: number;
      uptime?: number;
      recentRegistrations?: PanelUser[];
      alerts?: AlertItem[];
    }>('/api/admin/dashboard');

    const cards = response.cards || {
      totalUsers: Number(response.totalUsers || 0),
      activeDoctors: Number(response.activeDoctors || 0),
      dailyConsultations: Number(response.dailyConsultations || 0),
      systemUptime: Math.round(Number(response.uptime || 0)),
    };

    setDashboard({ cards, recentRegistrations: response.recentRegistrations || [], alerts: response.alerts || [] });
  };

  const loadUsers = async (nextRole: 'all' | UserRole = roleFilter) => {
    const query = nextRole === 'all' ? '' : `?role=${encodeURIComponent(nextRole)}`;
    const response = await adminFetch<{ success?: boolean; users?: PanelUser[]; data?: PanelUser[] } | PanelUser[]>(`/api/admin/users${query}`);
    if (Array.isArray(response)) {
      setUsers(response);
      return;
    }
    setUsers(response.users || response.data || []);
  };

  const loadAnalytics = async () => {
    const response = await adminFetch<{
      success?: boolean;
      analytics?: AnalyticsPayload;
      totalConsultations?: number;
      revenue?: number;
      satisfaction?: number;
    }>('/api/admin/analytics');
    if (response.analytics) {
      setAnalytics(response.analytics);
      return;
    }

    setAnalytics({
      totalConsultations: Number(response.totalConsultations || 0),
      revenue: Number(response.revenue || 0),
      patientSatisfaction: Number(response.satisfaction || 0),
      consultationTrends: [],
      topSpecializations: [],
    });
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadDashboard(), loadUsers(roleFilter), loadAnalytics()]);
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
        const payload = payloadRaw as PanelUser;
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
        setUsers((prev: PanelUser[]) => prev.map((u: PanelUser) => (u.id === payload.id ? { ...u, status: payload.status } : u)));
        setDashboard((prev: DashboardPayload | null) => {
          if (!prev) return prev;
          const nextRecent = prev.recentRegistrations.map((u: PanelUser) => (u.id === payload.id ? { ...u, status: payload.status } : u));
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

  const openUserModal = async (id: number, mode: 'view' | 'edit') => {
    setBusy(true);
    try {
      const response = await adminFetch<{ success: boolean; user: PanelUser }>('/api/admin/users/' + id);
      setSelectedUser(response.user);
      setModalMode(mode);
      setEditForm({
        name: response.user.name || '',
        email: response.user.email || '',
        location: response.user.location || '',
        role: response.user.role,
      });
      setShowModal(true);
    } catch (error: unknown) {
      addToast(getErrorMessage(error) || 'Failed to open user details', 'error');
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
      await loadUsers(roleFilter);
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
      await adminFetch('/api/admin/users/' + user.id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadUsers(roleFilter);
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

  const analyticsVideo = analytics?.consultationTrends.find((entry: { type: string; count: number }) => entry.type === 'video')?.count || 0;
  const analyticsKiosk = analytics?.consultationTrends.find((entry: { type: string; count: number }) => entry.type === 'kiosk')?.count || 0;
  const totalTrend = analyticsVideo + analyticsKiosk;
  const videoPercent = totalTrend ? Math.round((analyticsVideo / totalTrend) * 100) : 0;
  const kioskPercent = totalTrend ? Math.round((analyticsKiosk / totalTrend) * 100) : 0;

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
              <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
              <p className="text-sm opacity-80">System Administration • MedTech</p>
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
                <Card title="System Uptime" value={<span>{Math.floor((dashboard?.cards.systemUptime || 0) / 3600)}h</span>} icon={Globe} gradient="bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]" meta="Node process uptime" />
              </motion.div>

              <motion.div className="grid lg:grid-cols-2 gap-6 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-xl font-semibold mb-4">Recent User Registrations</h2>
                  <div className="space-y-3">
                    {(dashboard?.recentRegistrations || []).map((u: PanelUser) => (
                      <motion.div key={u.id} whileHover={{ scale: 1.01 }} className="flex items-center justify-between p-3 rounded-lg bg-white/4">
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-sm opacity-80">{roleLabel(u.role)} • {u.location || 'India'}</div>
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
                  <div className="flex items-center gap-3">
                    <select
                      className="bg-white/5 px-3 py-2 rounded-md text-white"
                      value={roleFilter}
                      onChange={async (e) => {
                        const next = e.target.value as 'all' | UserRole;
                        setRoleFilter(next);
                        await loadUsers(next);
                      }}
                    >
                      <option value="all">All Users</option>
                      <option value="patient">Patients</option>
                      <option value="doctor">Doctors</option>
                      <option value="pharmacy">Pharmacies</option>
                    </select>
                    <button className="px-4 py-2 rounded-md bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]" onClick={() => loadUsers(roleFilter)}>
                      Export Data
                    </button>
                  </div>
                </div>
              </motion.div>

              <motion.div className="bg-white/6 rounded-2xl shadow-xl p-4 overflow-x-auto" variants={fadeInUp} initial="hidden" animate="visible">
                <table className="min-w-full text-left table-auto">
                  <thead>
                    <tr className="text-sm text-white/80">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Join Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: PanelUser) => (
                      <tr key={u.id} className="odd:bg-white/3 hover:bg-white/5 transition">
                        <td className="px-4 py-3">{u.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm px-2 py-1 rounded ${roleBadgeClass(u.role)}`}>{roleLabel(u.role)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm opacity-90">{u.location || '-'}</td>
                        <td className="px-4 py-3 text-sm opacity-80">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm px-2 py-1 rounded ${statusBadgeClass(u.status)}`}>{u.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3 text-sm">
                            <button className="underline" onClick={() => openUserModal(u.id, 'view')}>View</button>
                            <button className="underline" onClick={() => openUserModal(u.id, 'edit')}>Edit</button>
                            {u.status === 'pending' && <button className="underline text-emerald-300" onClick={() => updateStatus(u, 'active')}>Approve</button>}
                            {u.status === 'suspended'
                              ? <button className="underline text-emerald-300" onClick={() => updateStatus(u, 'active')}>Activate</button>
                              : <button className="underline text-red-300" onClick={() => updateStatus(u, 'suspended')}>Suspend</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>

              <motion.div className="mt-6 bg-white/6 p-6 rounded-2xl shadow-xl" variants={fadeInUp} initial="hidden" animate="visible">
                <h3 className="text-lg font-semibold mb-4">Create / Invite User</h3>
                <form className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" onSubmit={sendInvite}>
                  <input
                    className="px-4 py-3 rounded-md bg-white/5"
                    placeholder="Invite email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <select className="px-4 py-3 rounded-md bg-white/5" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)}>
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                    <option value="pharmacy">Pharmacy</option>
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
                  <div className="space-y-3">
                    {(analytics?.topSpecializations || []).slice(0, 5).map((s: { specialization: string; count: number }, i: number) => (
                      <div key={i} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{s.specialization || 'General'}</div>
                          <div className="text-sm opacity-80">{s.count} consultations</div>
                        </div>
                        <div className="font-bold text-emerald-300">{analytics?.totalConsultations ? Math.round((s.count / analytics.totalConsultations) * 100) : 0}%</div>
                      </div>
                    ))}
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
                    <input defaultValue="HealthConnect" className="w-full px-4 py-3 rounded-md bg-white/5 focus:ring-2 focus:ring-pink-400" />
                    <label className="block text-sm opacity-90">Support Email</label>
                    <input defaultValue="support@healthconnect.in" className="w-full px-4 py-3 rounded-md bg-white/5 focus:ring-2 focus:ring-cyan-400" />
                  </div>
                </div>

                <div className="bg-white/6 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-semibold mb-4">Security Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm opacity-90">Session Timeout (minutes)</label>
                      <input type="number" defaultValue={30} className="w-full px-4 py-3 rounded-md bg-white/5" />
                    </div>
                    <div>
                      <label className="block text-sm opacity-90">Max Login Attempts</label>
                      <input type="number" defaultValue={5} className="w-full px-4 py-3 rounded-md bg-white/5" />
                    </div>
                  </div>
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
                <div><span className="opacity-70">Status:</span> {selectedUser.status}</div>
                <div><span className="opacity-70">Location:</span> {selectedUser.location || '-'}</div>
                <div><span className="opacity-70">Joined:</span> {formatDate(selectedUser.created_at)}</div>
              </div>
            ) : (
              <div className="space-y-3">
                <input className="w-full px-4 py-3 rounded-md bg-white/5" value={editForm.name} onChange={(e) => setEditForm((p: EditForm) => ({ ...p, name: e.target.value }))} />
                <input className="w-full px-4 py-3 rounded-md bg-white/5" value={editForm.email} onChange={(e) => setEditForm((p: EditForm) => ({ ...p, email: e.target.value }))} />
                <input className="w-full px-4 py-3 rounded-md bg-white/5" value={editForm.location} onChange={(e) => setEditForm((p: EditForm) => ({ ...p, location: e.target.value }))} />
                <select className="w-full px-4 py-3 rounded-md bg-white/5" value={editForm.role} onChange={(e) => setEditForm((p: EditForm) => ({ ...p, role: e.target.value as UserRole }))}>
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="pharmacy">Pharmacy</option>
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
