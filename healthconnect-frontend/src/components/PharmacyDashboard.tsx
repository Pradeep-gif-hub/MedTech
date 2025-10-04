import React, { useState, useEffect } from 'react';
import { Pill, FileText, Package, BarChart3, Check, X, Clock, Search, Filter } from 'lucide-react';
import profileImage from '../assets/pharmacy.png';

interface PharmacyDashboardProps {
  onLogout: () => void;
}

const PharmacyDashboard: React.FC<PharmacyDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'inventory' | 'orders' | 'analytics'>('prescriptions');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'dispensed'>('all');

  const [signedUser, setSignedUser] = useState<{ name?: string; email?: string } | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return { email: String(raw) }; }
    } catch { return null; }
  });

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('user');
        if (!raw) { setSignedUser(null); return; }
        try { setSignedUser(JSON.parse(raw)); } catch { setSignedUser({ email: raw }); }
      } catch { setSignedUser(null); }
    };
    const onStorage = (e: StorageEvent) => { if (e.key === 'user') load(); };
    const onUserUpdated = (e: Event) => {
      try {
        const d = (e as CustomEvent).detail;
        if (d) setSignedUser(typeof d === 'string' ? JSON.parse(d) : d);
        else load();
      } catch { load(); }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('user-updated', onUserUpdated as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('user-updated', onUserUpdated as EventListener);
    };
  }, []);

  const prescriptions = [
    {
      id: 'RX001',
      patient: 'Pradeep Awasthi',
      doctor: 'Dr. Paarth Lalit',
      date: 'Dec 15, 2024',
      medicines: [
        { name: 'Paracetamol 500mg', quantity: 20, inStock: true },
        { name: 'Amoxicillin 250mg', quantity: 15, inStock: true },
      ],
      status: 'pending',
      urgency: 'normal',
      total: 245.50
    },
    {
      id: 'RX002',
      patient: 'Rahul Tewatia',
      doctor: 'Dr. Vishal Buttler',
      date: 'Dec 15, 2024',
      medicines: [
        { name: 'Metformin 500mg', quantity: 30, inStock: true },
        { name: 'Atorvastatin 20mg', quantity: 30, inStock: false },
        { name: 'Lisinopril 10mg', quantity: 30, inStock: true },
      ],
      status: 'approved',
      urgency: 'urgent',
      total: 892.75
    },
    {
      id: 'RX003',
      patient: 'Gunjan Saini',
      doctor: 'Dr. Amit Verma',
      date: 'Dec 14, 2024',
      medicines: [
        { name: 'Vitamin D3', quantity: 30, inStock: true },
      ],
      status: 'dispensed',
      urgency: 'normal',
      total: 156.25
    },
  ];

  const inventory = [
    { name: 'Paracetamol 500mg', currentStock: 500, minStock: 100, price: 2.50, category: 'Analgesics', status: 'in-stock' },
    { name: 'Amoxicillin 250mg', currentStock: 200, minStock: 50, price: 8.75, category: 'Antibiotics', status: 'in-stock' },
    { name: 'Atorvastatin 20mg', currentStock: 15, minStock: 30, price: 12.50, category: 'Cardiovascular', status: 'low-stock' },
    { name: 'Metformin 500mg', currentStock: 0, minStock: 25, price: 6.25, category: 'Diabetes', status: 'out-of-stock' },
    { name: 'Vitamin D3', currentStock: 150, minStock: 50, price: 5.20, category: 'Vitamins', status: 'in-stock' },
  ];

  const filteredPrescriptions = filterStatus === 'all' 
    ? prescriptions 
    : prescriptions.filter(p => p.status === filterStatus);

  const renderPrescriptions = () => (
    <div className="space-y-6">
    {/* Stats Cards */}
<div className="grid md:grid-cols-4 gap-6">
  <div className="bg-gradient-to-r from-orange-100 via-orange-200 to-orange-300 rounded-xl shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Pending Prescriptions</p>
        <p className="text-2xl font-bold text-orange-800">12</p>
      </div>
      <Clock className="h-8 w-8 text-orange-700" />
    </div>
  </div>

  <div className="bg-gradient-to-r from-green-100 via-emerald-200 to-green-300 rounded-xl shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Ready for Pickup</p>
        <p className="text-2xl font-bold text-green-800">8</p>
      </div>
      <Check className="h-8 w-8 text-green-700" />
    </div>
  </div>

  <div className="bg-gradient-to-r from-blue-100 via-sky-200 to-blue-300 rounded-xl shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Today's Revenue</p>
        <p className="text-2xl font-bold text-blue-800">₹19,240</p>
      </div>
      <BarChart3 className="h-8 w-8 text-blue-700" />
    </div>
  </div>

  <div className="bg-gradient-to-r from-purple-100 via-indigo-200 to-purple-300 rounded-xl shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Prescriptions Today</p>
        <p className="text-2xl font-bold text-purple-800">37</p>
      </div>
      <FileText className="h-8 w-8 text-purple-700" />
    </div>
  </div>
</div>


    {/* Filters */}
<div className="bg-gradient-to-r from-cyan-100 via-blue-100 to-emerald-100 rounded-xl shadow-sm p-6">
  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
    <div className="flex items-center space-x-4">
      <div className="relative">
        <Search className="h-5 w-5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
        <input 
          type="text" 
          placeholder="Search prescriptions..." 
          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Filter className="h-5 w-5 text-gray-600" />
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="dispensed">Dispensed</option>
        </select>
      </div>
    </div>
    <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
      Export Report
    </button>
  </div>
</div>

{/* Prescriptions List */}
<div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-emerald-50 rounded-xl shadow-sm p-6">
  <h2 className="text-2xl font-extrabold text-gray-900 mb-6 tracking-tight">
    Digital Prescriptions
  </h2>
  <div className="space-y-4">
    {filteredPrescriptions.map((prescription) => (
      <div
        key={prescription.id}
        className={`rounded-lg p-6 shadow-md transition ${
          prescription.status === 'pending'
            ? 'bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200'
            : prescription.status === 'approved'
            ? 'bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200'
            : 'bg-gradient-to-r from-green-50 to-green-100 border border-green-200'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center space-x-4">
              <h3 className="font-bold text-lg text-gray-900">#{prescription.id}</h3>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded ${
                  prescription.status === 'pending'
                    ? 'bg-orange-200 text-orange-900'
                    : prescription.status === 'approved'
                    ? 'bg-blue-200 text-blue-900'
                    : 'bg-green-200 text-green-900'
                }`}
              >
                {prescription.status}
              </span>
              {prescription.urgency === 'urgent' && (
                <span className="bg-red-200 text-red-900 text-xs font-semibold px-2 py-1 rounded animate-pulse">
                  Urgent
                </span>
              )}
            </div>
            {/* Highlighted Details */}
            <p className="text-base font-semibold text-gray-800 mt-2">
              👤 Patient: <span className="text-blue-800">{prescription.patient}</span>
            </p>
            <p className="text-sm font-medium text-gray-700">
              🩺 Doctor: <span className="text-emerald-700">{prescription.doctor}</span>
            </p>
            <p className="text-xs text-gray-600 font-light">{prescription.date}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold text-gray-900">
              ₹{prescription.total.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Medicines */}
        <div className="mb-4">
          <h4 className="font-semibold text-gray-900 mb-2">Prescribed Medicines:</h4>
          <div className="space-y-2">
            {prescription.medicines.map((medicine, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 px-4 bg-white/70 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-900">{medicine.name}</span>
                  <span className="text-gray-700 text-sm">Qty: {medicine.quantity}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {medicine.inStock ? (
                    <span className="bg-green-200 text-green-900 text-xs px-2 py-1 rounded font-medium">
                      In Stock
                    </span>
                  ) : (
                    <span className="bg-red-200 text-red-900 text-xs px-2 py-1 rounded font-medium">
                      Out of Stock
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <div className="flex space-x-3">
            <button className="text-blue-700 hover:text-blue-900 text-sm font-medium">
              View Details
            </button>
            <button className="text-gray-700 hover:text-gray-900 text-sm font-medium">
              Print
            </button>
          </div>
          <div className="flex space-x-2">
            {prescription.status === 'pending' && (
              <>
                <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold">
                  Reject
                </button>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold">
                  Approve
                </button>
              </>
            )}
            {prescription.status === 'approved' && (
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold">
                Mark as Dispensed
              </button>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
</div>


    </div>
  );

  const renderInventory = () => (
    <div className="space-y-6">
    <div className="space-y-6">
  {/* Inventory Stats */}
  <div className="grid md:grid-cols-4 gap-6">
    {/* Total Items */}
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-md p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Total Items</p>
          <p className="text-2xl font-bold">1,245</p>
        </div>
        <Package className="h-8 w-8 text-white opacity-90" />
      </div>
    </div>

    {/* Low Stock */}
    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl shadow-md p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Low Stock Items</p>
          <p className="text-2xl font-bold">23</p>
        </div>
        <Clock className="h-8 w-8 text-white opacity-90" />
      </div>
    </div>

    {/* Out of Stock */}
    <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-xl shadow-md p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Out of Stock</p>
          <p className="text-2xl font-bold">5</p>
        </div>
        <X className="h-8 w-8 text-white opacity-90" />
      </div>
    </div>

    {/* Inventory Value */}
    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-md p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Inventory Value</p>
          <p className="text-2xl font-bold">₹2.4L</p>
        </div>
        <BarChart3 className="h-8 w-8 text-white opacity-90" />
      </div>
    </div>
  </div>
</div>

{/* Inventory Management */}
<div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-xl font-bold text-blue-700">Inventory Management</h2>
    <button className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-2 rounded-full shadow-md hover:opacity-90 transition">
      + Add New Item
    </button>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full border-collapse rounded-lg overflow-hidden">
      {/* Table Head */}
      <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-semibold uppercase border border-blue-300">Medicine Name</th>
          <th className="px-6 py-3 text-left text-sm font-semibold uppercase border border-blue-300">Category</th>
          <th className="px-6 py-3 text-left text-sm font-semibold uppercase border border-blue-300">Current Stock</th>
          <th className="px-6 py-3 text-left text-sm font-semibold uppercase border border-blue-300">Min Stock</th>
          <th className="px-6 py-3 text-left text-sm font-semibold uppercase border border-blue-300">Price</th>
          <th className="px-6 py-3 text-left text-sm font-semibold uppercase border border-blue-300">Status</th>
          <th className="px-6 py-3 text-left text-sm font-semibold uppercase border border-blue-300">Actions</th>
        </tr>
      </thead>

      {/* Table Body */}
      <tbody>
        {inventory.map((item, index) => (
          <tr
            key={index}
            className={`hover:bg-blue-50 transition ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
          >
            <td className="px-6 py-4 border border-blue-100 font-medium text-gray-900">{item.name}</td>
            <td className="px-6 py-4 border border-blue-100 text-sm text-gray-700">{item.category}</td>
            <td className="px-6 py-4 border border-blue-100 text-sm font-semibold text-gray-900">{item.currentStock}</td>
            <td className="px-6 py-4 border border-blue-100 text-sm text-gray-700">{item.minStock}</td>
            <td className="px-6 py-4 border border-blue-100 text-sm font-semibold text-gray-900">₹{item.price.toFixed(2)}</td>
            <td className="px-6 py-4 border border-blue-100">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm ${
                  item.status === 'in-stock'
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : item.status === 'low-stock'
                    ? 'bg-orange-100 text-orange-700 border border-orange-300'
                    : 'bg-red-100 text-red-700 border border-red-300'
                }`}
              >
                {item.status.replace('-', ' ')}
              </span>
            </td>
            <td className="px-6 py-4 border border-blue-100 text-sm">
              <button className="text-blue-600 font-semibold hover:text-blue-800 mr-3">Edit</button>
              <button className="text-emerald-600 font-semibold hover:text-emerald-800">Restock</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
  <div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-emerald-50 rounded-xl shadow-md p-6">
    <h2 className="text-xl font-extrabold text-gray-900 mb-6 tracking-tight">
      Order Tracking
    </h2>

    <div className="space-y-4">
      {[
        { 
          orderId: 'ORD001', 
          patient: 'Priya Sharma', 
          items: 2, 
          status: 'ready-for-pickup', 
          total: 245.50,
          date: 'Dec 15, 2024'
        },
        { 
          orderId: 'ORD002', 
          patient: 'Rajesh Patel', 
          items: 3, 
          status: 'processing', 
          total: 892.75,
          date: 'Dec 15, 2024'
        },
        { 
          orderId: 'ORD003', 
          patient: 'Meera Singh', 
          items: 1, 
          status: 'completed', 
          total: 156.25,
          date: 'Dec 14, 2024'
        },
      ].map((order, index) => (
        <div 
          key={index} 
          className={`rounded-lg p-5 shadow-md border-l-4 transition transform hover:scale-[1.01] ${
            order.status === 'ready-for-pickup'
              ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-400'
              : order.status === 'processing'
              ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-400'
              : 'bg-gradient-to-r from-green-50 to-green-100 border-green-400'
          }`}
        >
          <div className="flex justify-between items-center">
            {/* Left Side */}
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">
                Order #{order.orderId}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                👤 {order.patient} • 🧾 {order.items} items • 📅 {order.date}
              </p>
            </div>

            {/* Right Side */}
            <div className="text-right">
              <p className="font-bold text-gray-900 text-lg">
                ₹{order.total.toFixed(2)}
              </p>
              <span
                className={`inline-block mt-1 text-xs font-semibold px-3 py-1 rounded-full shadow-sm ${
                  order.status === 'ready-for-pickup'
                    ? 'bg-blue-200 text-blue-900'
                    : order.status === 'processing'
                    ? 'bg-orange-200 text-orange-900'
                    : 'bg-green-200 text-green-900'
                }`}
              >
                {order.status.replace('-', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>

  );

  const renderAnalytics = () => (
    <div className="space-y-6">
  {/* Stats Section */}
  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[
      {
        title: "Monthly Revenue",
        value: "₹4.2L",
        change: "+15% from last month",
        changeType: "positive",
        gradient: "from-cyan-50 to-blue-100",
        border: "border-cyan-400",
        icon: "💰",
      },
      {
        title: "Prescriptions Filled",
        value: "342",
        change: "+8% from last month",
        changeType: "positive",
        gradient: "from-emerald-50 to-green-100",
        border: "border-emerald-400",
        icon: "📄",
      },
      {
        title: "Average Order Value",
        value: "₹425",
        change: "-3% from last month",
        changeType: "negative",
        gradient: "from-orange-50 to-yellow-100",
        border: "border-orange-400",
        icon: "📊",
      },
      {
        title: "Customer Satisfaction",
        value: "4.7/5",
        change: "+0.1 from last month",
        changeType: "positive",
        gradient: "from-purple-50 to-pink-100",
        border: "border-purple-400",
        icon: "⭐",
      },
    ].map((stat, idx) => (
      <div
        key={idx}
        className={`bg-gradient-to-r ${stat.gradient} border-l-4 ${stat.border} rounded-xl shadow-md p-6 transition transform hover:scale-[1.03] hover:shadow-lg`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">{stat.title}</h3>
          <span className="text-xl">{stat.icon}</span>
        </div>
        <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
        <p
          className={`text-sm mt-1 ${
            stat.changeType === "positive" ? "text-green-700" : "text-red-600"
          }`}
        >
          {stat.change}
        </p>
      </div>
    ))}
  </div>

  {/* Medicines & Reviews */}
  <div className="grid lg:grid-cols-2 gap-6">
    {/* Top Selling Medicines */}
    <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-xl shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Top Selling Medicines</h3>
      <div className="space-y-3">
        {[
          { name: "Paracetamol 500mg", sales: 120, revenue: 300 },
          { name: "Amoxicillin 250mg", sales: 85, revenue: 743.75 },
          { name: "Metformin 500mg", sales: 65, revenue: 406.25 },
          { name: "Vitamin D3", sales: 45, revenue: 234 },
        ].map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-center p-3 bg-white border border-blue-200 rounded-lg shadow-sm hover:shadow-md transition"
          >
            <div>
              <p className="font-medium text-gray-900">{item.name}</p>
              <p className="text-sm text-gray-600">{item.sales} units sold</p>
            </div>
            <p className="font-bold text-emerald-600">₹{item.revenue}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Recent Customer Reviews */}
    <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Customer Reviews</h3>
      <div className="space-y-4">
        {[
          { customer: "Priya Sharma", rating: 5, review: "Quick service and accurate fulfillment." },
          { customer: "Rajesh Patel", rating: 4, review: "Good experience, medicines were ready on time." },
          { customer: "Meera Singh", rating: 5, review: "Excellent service and friendly staff." },
        ].map((review, index) => (
          <div
            key={index}
            className="border border-emerald-200 bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-900">{review.customer}</h4>
              <div className="flex">
                {[...Array(review.rating)].map((_, i) => (
                  <span key={i} className="text-yellow-400">★</span>
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-600">{review.review}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>

  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
    {/* Header */}
<header className="bg-gradient-to-r from-blue-700 via-indigo-600 to-emerald-500 shadow-lg backdrop-blur-md">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-16">
      
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        <div className="p-2 bg-white/20 rounded-full">
          <Pill className="h-9 w-9 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white drop-shadow-sm">
            Pharmacy Dashboard
          </h1>
          <p className="text-sm text-emerald-100">
            Welcome back, {signedUser?.name ? signedUser.name : 'MedPlus Pharmacy'}!
          </p>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center flex-row text-right mr-2">
  <span className="text-xs text-emerald-100 mr-1">Signed in as</span>
  <span className="text-sm font-semibold text-white">
    {signedUser?.email ?? 'Not signed in'}
  </span>
</div>

        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 bg-gray-200">
          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <button
          onClick={onLogout}
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2 
                     rounded-lg hover:from-red-600 hover:to-pink-700 transition-all shadow-md"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
</header>


      {/* Navigation Tabs */}
<div className="bg-white border-b border-gray-200">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <nav className="flex space-x-4 py-3">
      {[
        { key: 'prescriptions', label: 'Prescriptions', icon: FileText },
        { key: 'inventory', label: 'Inventory', icon: Package },
        { key: 'orders', label: 'Order Tracking', icon: Clock },
        { key: 'analytics', label: 'Analytics', icon: BarChart3 },
      ].map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-full font-medium text-sm shadow-sm transition-all
              ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            <Icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  </div>
</div>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'prescriptions' && renderPrescriptions()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'analytics' && renderAnalytics()}
      </main>
    </div>
  );
};

export default PharmacyDashboard;