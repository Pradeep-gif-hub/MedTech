import React, { useState } from 'react';
import { Shield, Users, Activity, BarChart3, Settings, TrendingUp, Globe, UserCheck, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminPanelProps {
  onLogout: () => void;
}

// --- Animation variants ---
const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const tabSlide = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const Card: React.FC<{ title: string; value: React.ReactNode; icon: any; gradient: string; meta?: string }> = ({ title, value, icon: Icon, gradient, meta }) => (
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
      <div className={`h-2 rounded-full`} style={{ width: `${percent}%`, background: accent || 'linear-gradient(90deg,#22c55e,#06b6d4)' }} />
    </div>
  </div>
);

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'analytics' | 'system'>('dashboard');

  // sample data (replace with real props / fetches)
  const usersSample = [
    { name: 'Dr. Mohit Insan', role: 'Doctor', location: 'Mumbai, Maharashtra', joinDate: 'Dec 1, 2024', status: 'active' },
    { name: 'Pradeep Awasthi', role: 'Patient', location: 'Pune, Maharashtra', joinDate: 'Dec 5, 2024', status: 'active' },
    { name: 'MedCare Pharmacy', role: 'Pharmacy', location: 'Bangalore, Karnataka', joinDate: 'Dec 8, 2024', status: 'pending' },
    { name: 'Dr. Anita Patel', role: 'Doctor', location: 'Ahmedabad, Gujarat', joinDate: 'Dec 10, 2024', status: 'active' },
    { name: 'Rajesh Gupta', role: 'Patient', location: 'Jaipur, Rajasthan', joinDate: 'Dec 12, 2024', status: 'suspended' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1220] to-[#0b2537] text-white">
      {/* Header */}
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
            <div className="text-sm opacity-90">Signed in as <span className="font-semibold">medtech@nitj.ac.in</span></div>
            <button onClick={onLogout} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white font-medium shadow hover:scale-[1.02] transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
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
              const active = activeTab === (t.key as any);
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
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

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.section key="dashboard" variants={tabSlide} initial="hidden" animate="visible" exit="exit">
              <motion.div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <Card title="Total Users" value={<span>7843</span>} icon={Users} gradient="bg-gradient-to-r from-[#ff7ab6] to-[#ff6a88]" meta="+8.2% from last month" />
                <Card title="Active Doctors" value={<span>568</span>} icon={Activity} gradient="bg-gradient-to-r from-[#34d399] to-[#10b981]" meta="+12.5% from last month" />
                <Card title="Daily Consultations" value={<span>490</span>} icon={TrendingUp} gradient="bg-gradient-to-r from-[#7c3aed] to-[#4f46e5]" meta="+15.3% from yesterday" />
                <Card title="System Uptime" value={<span>83.6%</span>} icon={Globe} gradient="bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]" meta="Last 30 days" />
              </motion.div>

              {/* Recent & Alerts */}
              <motion.div className="grid lg:grid-cols-2 gap-6 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-xl font-semibold mb-4">Recent User Registrations</h2>
                  <div className="space-y-3">
                    {[
                      { name: 'Dr Mohit Insan', role: 'Doctor', location: 'Maharashtra', time: '2 hours ago' },
                      { name: 'MedCare Pharmacy', role: 'Pharmacy', location: 'Karnataka', time: '4 hours ago' },
                      { name: 'Jethalal Gada', role: 'Patient', location: 'Uttar Pradesh', time: '6 hours ago' },
                      { name: 'Dr. Hathii ', role: 'Doctor', location: 'Gujarat', time: '8 hours ago' },
                    ].map((u, i) => (
                      <motion.div key={i} whileHover={{ scale: 1.01 }} className="flex items-center justify-between p-3 rounded-lg bg-white/4">
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-sm opacity-80">{u.role} • {u.location}</div>
                        </div>
                        <div className="text-sm opacity-70">{u.time}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-xl font-semibold mb-4">System Alerts</h2>
                  <div className="space-y-3">
                    {[{type:'warning', message:'High server load detected in Mumbai region', time:'30 minutes ago', severity:'medium'},
                      {type:'info', message:'Scheduled maintenance completed successfully', time:'2 hours ago', severity:'low'},
                      {type:'success', message:'New kiosk deployed in rural Rajasthan', time:'4 hours ago', severity:'low'},
                      {type:'error', message:'Payment gateway timeout reported', time:'6 hours ago', severity:'high'}
                    ].map((a, i) => (
                      <div key={i} className={`p-3 rounded-lg border-l-4 ${a.severity === 'high' ? 'bg-red-900/40 border-red-500' : a.severity === 'medium' ? 'bg-orange-900/40 border-orange-400' : 'bg-emerald-900/30 border-emerald-400'}`}>
                        <div className="font-medium">{a.message}</div>
                        <div className="text-sm opacity-80 mt-1">{a.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Geographic & Usage */}
              <motion.div className="bg-white/6 p-6 rounded-2xl shadow-xl" variants={fadeInUp} initial="hidden" animate="visible">
                <h3 className="text-lg font-semibold mb-4">Current Geographical Distribution</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Top States by Users</h4>
                    <div className="space-y-3">
                      {[
                        { state: 'Maharashtra', users: 2847, percentage: 23 },
                        { state: 'Karnataka', users: 2134, percentage: 17 },
                        { state: 'Uttar Pradesh', users: 1923, percentage: 15 },
                        { state: 'Gujarat', users: 1654, percentage: 13 },
                        { state: 'Rajasthan', users: 1276, percentage: 10 },
                      ].map((s, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{s.state}</div>
                            <div className="text-sm opacity-80">{s.users} users</div>
                          </div>
                          <div className="font-bold text-emerald-300">{s.percentage}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Kiosk Deployment</h4>
                    <div className="space-y-3">
                      {[
                        { location: 'Rural Villages', count: 245, status: 'active' },
                        { location: 'Semi-Urban Centers', count: 178, status: 'completed' },
                        { location: 'Pending Deployment', count: 67, status: 'pending' },
                        { location: 'Maintenance Required', count: 12, status: 'maintenance' },
                      ].map((k, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{k.location}</div>
                            <div className="text-sm opacity-80">{k.count} kiosks</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${k.status === 'active' ? 'bg-emerald-900/40 text-emerald-200' : k.status === 'pending' ? 'bg-amber-900/40 text-amber-200' : 'bg-red-900/40 text-red-200'}`}>
                            {k.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Usage Statistics</h4>
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-white/4">
                        <div className="font-bold text-2xl">68%</div>
                        <div className="text-sm opacity-80">Mobile App Usage</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/4">
                        <div className="font-bold text-2xl">32%</div>
                        <div className="text-sm opacity-80">Kiosk Usage</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/4">
                        <div className="font-bold text-2xl">14.5min</div>
                        <div className="text-sm opacity-80">Avg Session Time</div>
                      </div>
                    </div>
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
                    <select className="bg-white/5 px-3 py-2 rounded-md text-black">
                      <option>All Users</option>
                      <option>Patients</option>
                      <option>Doctors</option>
                      <option>Pharmacies</option>
                    </select>
                    <button className="px-4 py-2 rounded-md bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]">Export Data</button>
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
                    {usersSample.map((u, i) => (
                      <tr key={i} className="odd:bg-white/3 hover:bg-white/5 transition">
                        <td className="px-4 py-3">{u.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm px-2 py-1 rounded ${u.role === 'Doctor' ? 'bg-emerald-900/40' : u.role === 'Patient' ? 'bg-blue-900/40' : 'bg-purple-900/40'}`}>{u.role}</span>
                        </td>
                        <td className="px-4 py-3 text-sm opacity-90">{u.location}</td>
                        <td className="px-4 py-3 text-sm opacity-80">{u.joinDate}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm px-2 py-1 rounded ${u.status === 'active' ? 'bg-emerald-900/40' : u.status === 'pending' ? 'bg-amber-900/40' : 'bg-red-900/40'}`}>{u.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3 text-sm">
                            <button className="underline">View</button>
                            <button className="underline">Edit</button>
                            {u.status === 'pending' && <button className="underline text-emerald-300">Approve</button>}
                            {u.status === 'suspended' ? <button className="underline text-emerald-300">Activate</button> : <button className="underline text-red-300">Suspend</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>

              {/* Form example */}
              <motion.div className="mt-6 bg-white/6 p-6 rounded-2xl shadow-xl" variants={fadeInUp} initial="hidden" animate="visible">
                <h3 className="text-lg font-semibold mb-4">Create / Invite User</h3>
                <form className="grid md:grid-cols-2 gap-4">
                  <input className="px-4 py-3 rounded-md bg-white/5 focus:outline-none focus:ring-2 focus:ring-pink-400" placeholder="Full name" />
                  <input className="px-4 py-3 rounded-md bg-white/5" placeholder="Email" />
                  <select className="px-4 py-3 rounded-md bg-white/5">
                    <option>Patient</option>
                    <option>Doctor</option>
                    <option>Pharmacy</option>
                  </select>
                  <div className="flex items-center gap-3">
                    <button type="button" className="px-4 py-2 rounded-md bg-gradient-to-r from-[#7c3aed] to-[#ef4444]">Invite</button>
                    <button type="reset" className="px-4 py-2 rounded-md bg-white/5">Clear</button>
                  </div>
                </form>
              </motion.div>
            </motion.section>
          )}

          {activeTab === 'analytics' && (
            <motion.section key="analytics" variants={tabSlide} initial="hidden" animate="visible" exit="exit">
              <motion.div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <Card title="Total Consultations" value={<span>34274</span>} icon={BarChart3} gradient="bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]" meta="+18% from last month" />
                <Card title="Revenue Generated" value={<span>₹8.4L</span>} icon={TrendingUp} gradient="bg-gradient-to-r from-[#f97316] to-[#ef4444]" meta="+22% from last month" />
                <Card title="Patient Satisfaction" value={<span>4.6/5</span>} icon={Users} gradient="bg-gradient-to-r from-[#34d399] to-[#10b981]" meta="+0.3 from last month" />
                <Card title="System Performance" value={<span>91.7%</span>} icon={Globe} gradient="bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed]" meta="Uptime last 30 days" />
              </motion.div>

              <motion.div className="grid lg:grid-cols-2 gap-6" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h3 className="font-semibold mb-4">Consultation Trends</h3>
                  <StatProgress label="Video Consultations" percent={63} />
                  <div className="mt-4">
                    <StatProgress label="Kiosk Consultations" percent={43} accent="linear-gradient(90deg,#3b82f6,#06b6d4)" />
                  </div>
                </div>

                <div className="bg-white/6 rounded-2xl p-6 shadow-xl">
                  <h3 className="font-semibold mb-4">Top Specializations</h3>
                  <div className="space-y-3">
                    {[{specialty:'General Medicine', consultations:12847, percentage:48}, {specialty:'Pediatrics', consultations:8234, percentage:22}, {specialty:'Cardiology', consultations:5621, percentage:15}, {specialty:'Dermatology', consultations:4518, percentage:12}, {specialty:'Orthopedics', consultations:3789, percentage:10}].map((s,i)=> (
                      <div key={i} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{s.specialty}</div>
                          <div className="text-sm opacity-80">{s.consultations} consultations</div>
                        </div>
                        <div className="font-bold text-emerald-300">{s.percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Small dashboard chart placeholders (SVG sparkline) */}
              <motion.div className="mt-6 grid md:grid-cols-3 gap-6" variants={fadeInUp} initial="hidden" animate="visible">
                {[{title:'Weekly Traffic', value:'12.4k'}, {title:'Conversion Rate', value:'4.1%'}, {title:'Avg Response Time', value:'320ms'}].map((c,i)=> (
                  <div key={i} className="bg-white/6 rounded-2xl p-4 shadow-xl">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="font-semibold">{c.title}</div>
                        <div className="text-sm opacity-80">{c.value}</div>
                      </div>
                      <svg width="80" height="36" viewBox="0 0 80 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 28 C14 8 28 20 56 6 68 0 78 10 80 14" stroke="white" strokeOpacity="0.9" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="text-xs opacity-70">MedTech is getting Noticed...</div>
                  </div>
                ))}
              </motion.div>
            </motion.section>
          )}

          {activeTab === 'system' && (
            <motion.section key="system" variants={tabSlide} initial="hidden" animate="visible" exit="exit">
              <motion.div className="grid md:grid-cols-2 gap-6 mb-6" variants={fadeInUp} initial="hidden" animate="visible">
                <div className="bg-white/6 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-semibold mb-4">General Settings</h3>
                  <div className="space-y-4">
                    <label className="block text-sm opacity-90">Platform Name</label>
                    <input defaultValue="HealthConnect" className="w-full px-4 py-3 rounded-md bg-white/5 focus:ring-2 focus:ring-pink-400" />

                    <label className="block text-sm opacity-90">Support Email</label>
                    <input defaultValue="support@healthconnect.in" className="w-full px-4 py-3 rounded-md bg-white/5 focus:ring-2 focus:ring-cyan-400" />

                    <label className="flex items-center gap-3 mt-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span className="text-sm">Enable Maintenance Mode</span>
                    </label>
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
                    <label className="flex items-center gap-3 mt-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span className="text-sm">Enable Two-Factor Authentication</span>
                    </label>
                  </div>
                </div>
              </motion.div>

              <motion.div className="bg-white/6 p-6 rounded-2xl shadow-xl" variants={fadeInUp} initial="hidden" animate="visible">
                <h3 className="font-semibold mb-4">System Monitoring</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-900/30">
                    <div className="font-semibold">Server Status</div>
                    <div className="text-2xl font-bold">Operational</div>
                    <div className="text-sm opacity-80">All services running</div>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-900/30">
                    <div className="font-semibold">Database Health</div>
                    <div className="text-2xl font-bold">Excellent</div>
                    <div className="text-sm opacity-80">Response time: 45ms</div>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-900/30">
                    <div className="font-semibold">API Performance</div>
                    <div className="text-2xl font-bold">92.9%</div>
                    <div className="text-sm opacity-80">Success rate</div>
                  </div>
                </div>
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AdminPanel;
