import React, { useState, useEffect } from 'react';
import { useStoredUser } from '../hooks/useStoredUser';
import { buildApiUrl } from '../config/api';
import { getAuthHeaders } from '../hooks/useBackendProfile';
import {
  User,
  Package,
  Activity,
  BarChart3,
  LogOut,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  Truck
} from 'lucide-react';

interface DeliveryAgentDashboardProps {
  onLogout: () => void;
}

const DeliveryAgentDashboard: React.FC<DeliveryAgentDashboardProps> = ({ onLogout }) => {
  const sessionUser = useStoredUser();
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'profile' | 'analytics'>('home');
  const [profile, setProfile] = useState<any>(sessionUser);
  const [isUpdating, setIsUpdating] = useState(false);

  // Form state for profile
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    age: profile?.age || '',
    vehicle_number: profile?.vehicle_number || '',
    license_number: profile?.license_number || '',
    experience: profile?.experience || '',
  });

  useEffect(() => {
    // Fetch latest profile
    const fetchProfile = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/users/me'), {
          headers: getAuthHeaders()
        });
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          setFormData({
            name: data.name || '',
            phone: data.phone || '',
            age: data.age || '',
            vehicle_number: data.vehicle_number || '',
            license_number: data.license_number || '',
            experience: data.experience || '',
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const response = await fetch(buildApiUrl('/api/users/update-profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        alert('Profile updated successfully!');
      } else {
        alert('Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  const renderHome = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="bg-blue-100 p-3 rounded-xl">
            <User className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Agent Name</p>
            <p className="font-bold text-gray-900">{profile?.name || 'Agent'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="bg-emerald-100 p-3 rounded-xl">
            <User className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Age / Gender</p>
            <p className="font-bold text-gray-900">{profile?.age || '-'} / {profile?.gender || '-'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="bg-purple-100 p-3 rounded-xl">
            <User className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Mobile Number</p>
            <p className="font-bold text-gray-900">{profile?.phone || '-'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="bg-orange-100 p-3 rounded-xl">
            <Activity className="h-8 w-8 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Experience</p>
            <p className="font-bold text-gray-900">{profile?.experience || '0'} Years</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="bg-indigo-100 p-3 rounded-xl">
            <Truck className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Vehicle Number</p>
            <p className="font-bold text-gray-900">{profile?.vehicle_number || '-'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="bg-rose-100 p-3 rounded-xl">
            <User className="h-8 w-8 text-rose-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">License Number</p>
            <p className="font-bold text-gray-900">{profile?.license_number || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOrders = () => {
    // Mock orders data for UI representation
    const mockOrders = [
      {
        id: 'ORD-1001',
        patientName: 'Rahul Kumar',
        doctorName: 'Dr. Smith',
        pharmacyName: 'City Meds',
        medicines: 'Paracetamol, Vitamin C',
        totalAmount: '₹450',
        paymentMode: 'Cash on Delivery',
        status: 'Pending'
      },
      {
        id: 'ORD-1002',
        patientName: 'Priya Sharma',
        doctorName: 'Dr. Awasthi',
        pharmacyName: 'Health First',
        medicines: 'Amoxicillin',
        totalAmount: '₹220',
        paymentMode: 'Online',
        status: 'Delivered'
      }
    ];

    return (
      <div className="space-y-6 animate-fadeIn">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Orders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mockOrders.map((order, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{order.patientName}</h3>
                  <p className="text-sm text-gray-500">Order ID: {order.id}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-gray-900">Doctor:</span> {order.doctorName}</p>
                <p><span className="font-medium text-gray-900">Pharmacy:</span> {order.pharmacyName}</p>
                <p><span className="font-medium text-gray-900">Items:</span> {order.medicines}</p>
                <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500">Total Amount</p>
                    <p className="font-bold text-gray-900">{order.totalAmount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Payment</p>
                    <p className="font-bold text-gray-900">{order.paymentMode}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn">
      <div className="p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Your Mobile Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({...formData, age: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Age"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Experience (Years)</label>
              <input
                type="number"
                value={formData.experience}
                onChange={(e) => setFormData({...formData, experience: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Years of Experience"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Number</label>
              <input
                type="text"
                value={formData.vehicle_number}
                onChange={(e) => setFormData({...formData, vehicle_number: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Vehicle Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">License Number</label>
              <input
                type="text"
                value={formData.license_number}
                onChange={(e) => setFormData({...formData, license_number: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="License Number"
              />
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={isUpdating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-md flex items-center space-x-2"
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderAnalytics = () => {
    // Mock analytics data
    return (
      <div className="space-y-6 animate-fadeIn">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-yellow-100 p-3 rounded-xl">
                <Star className="h-6 w-6 text-yellow-600 fill-current" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">Average Rating</p>
            <p className="text-3xl font-bold text-gray-900">4.8</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">Total Deliveries</p>
            <p className="text-3xl font-bold text-gray-900">142</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <Activity className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">Revenue Earned</p>
            <p className="text-3xl font-bold text-gray-900">₹12,450</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">Positive Feedback</p>
            <p className="text-3xl font-bold text-gray-900">96%</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Delivery Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-emerald-100 hidden sm:block">
                Welcome, <span className="font-semibold text-white">{profile?.name || 'Agent'}</span>
              </span>
              <button
                onClick={onLogout}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors flex items-center space-x-2"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            {[
              { id: 'home', icon: User, label: 'Home' },
              { id: 'orders', icon: Package, label: 'Orders' },
              { id: 'profile', icon: User, label: 'Profile' },
              { id: 'analytics', icon: BarChart3, label: 'Analytics' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center space-x-2 py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200
                  ${activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-emerald-500' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'analytics' && renderAnalytics()}
      </main>
    </div>
  );
};

export default DeliveryAgentDashboard;
