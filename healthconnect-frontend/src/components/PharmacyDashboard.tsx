import { useState, useEffect } from 'react';
import { Pill, FileText, Package, BarChart3, Check, X, Clock, Filter } from 'lucide-react';
import { useStoredUser } from '../hooks/useStoredUser';
import { useBackendProfile } from '../hooks/useBackendProfile';
import { API_BASE_URL } from '../firebaseConfig';

interface PharmacyDashboardProps {
  onLogout: () => void;
}

interface Prescription {
  id: number;
  patient_name: string;
  doctor_name: string;
  date: string | null;
  diagnosis: string;
  medicines: Array<{name: string; dosage?: string; frequency?: string; duration?: string}>;
  pharmacy_status: string;
  created_at: string | null;
}

interface InventoryItem {
  id: number;
  medicine_name: string;
  category: string;
  current_stock: number;
  min_stock: number;
  price: number;
  status: string;
}

interface InventoryStats {
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  inventory_value: number;
}

type OrderStatus = 'PROCESSING' | 'READY_FOR_PICKUP' | 'COMPLETED';

interface PharmacyOrder {
  id: number;
  order_id: string;
  pharmacy_id: number;
  prescription_id: number | null;
  patient_name: string | null;
  total_items: number;
  total_amount: number;
  status: OrderStatus;
  created_at: string | null;
}

interface TopMedicine {
  medicine_name: string;
  total_sold: number;
}

interface AnalyticsData {
  monthly_revenue: number;
  total_orders: number;
  average_order_value: number;
  completed_orders: number;
  top_selling_medicines: TopMedicine[];
}

const PharmacyDashboard: React.FC<PharmacyDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('prescriptions' as 'prescriptions' | 'inventory' | 'orders' | 'analytics');
  const [analyticsView, setAnalyticsView] = useState<'top-selling' | 'order-status'>('top-selling');
  const [filterStatus, setFilterStatus] = useState('all' as 'all' | 'pending' | 'approved');
  const signedUser = useStoredUser();
  const { profile } = useBackendProfile();

  // Prescriptions state
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Orders + Analytics state
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [newInventoryItem, setNewInventoryItem] = useState({
    medicine_name: '',
    category: '',
    current_stock: 0,
    min_stock: 0,
    price: 0,
  });

  const userId = signedUser?.user_id || localStorage.getItem('user_id');

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('role');
      localStorage.removeItem('user_id');
      window.dispatchEvent(new CustomEvent('user-updated', { detail: null }));
    } catch {
      // no-op
    }
    onLogout();
  };

  // Fetch prescriptions
  const fetchPrescriptions = async () => {
    if (!userId) return;
    setPrescriptionsLoading(true);
    try {
      const apiUrl = `${API_BASE_URL}/api/pharmacy/prescriptions?user_id=${userId}`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        setPrescriptions(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch prescriptions:', response.status, errorText);
      }
    } catch (error) {
      console.error('Failed to fetch prescriptions:', error);
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  // Fetch inventory
  const fetchInventory = async () => {
    if (!userId) return;
    setInventoryLoading(true);
    try {
      const apiUrl = `${API_BASE_URL}/api/pharmacy/inventory?user_id=${userId}`;
      const statsUrl = `${API_BASE_URL}/api/pharmacy/inventory/stats?user_id=${userId}`;
      
      const [inventoryRes, statsRes] = await Promise.all([
        fetch(apiUrl),
        fetch(statsUrl),
      ]);
      
      if (inventoryRes.ok) {
        const data = await inventoryRes.json();
        setInventory(data);
      } else {
        const errorText = await inventoryRes.text();
        console.error('Failed to fetch inventory:', inventoryRes.status, errorText);
      }
      
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setInventoryStats(stats);
      } else {
        const errorText = await statsRes.text();
        console.error('Failed to fetch inventory stats:', statsRes.status, errorText);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setInventoryLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPrescriptions();
    fetchInventory();
    fetchOrders();
    fetchAnalytics();
    // Poll for new prescriptions every 5 seconds
    const prescriptionInterval = setInterval(fetchPrescriptions, 5000);
    const orderInterval = setInterval(() => {
      fetchOrders();
      fetchAnalytics();
    }, 10000);
    return () => {
      clearInterval(prescriptionInterval);
      clearInterval(orderInterval);
    };
  }, [userId]);

  const fetchOrders = async () => {
    if (!userId) return;
    setOrdersLoading(true);
    try {
      const apiUrl = `${API_BASE_URL}/api/orders?user_id=${userId}`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch orders:', response.status, errorText);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!userId) return;
    setAnalyticsLoading(true);
    try {
      const apiUrl = `${API_BASE_URL}/api/analytics?user_id=${userId}`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch analytics:', response.status, errorText);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const createOrderFromPrescription = async (prescriptionId: number) => {
    if (!userId) return;
    try {
      const apiUrl = `${API_BASE_URL}/api/orders/from-prescription/${prescriptionId}?user_id=${userId}`;
      const response = await fetch(apiUrl, { method: 'POST' });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Order creation failed:', response.status, errorText);
      }
      fetchOrders();
      fetchAnalytics();
    } catch (error) {
      console.error('Order creation failed:', error);
    }
  };

  const formatCurrency = (value: number) => `₹${(value || 0).toFixed(2)}`;
  const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'N/A');
  const statusLabel = (status: string) => status.replaceAll('_', ' ');
  const approvedOrders = orders.filter((order) => order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED');

  const handleApprovePrescription = async (prescriptionId: number) => {
    if (!userId) return;
    try {
      const apiUrl = `${API_BASE_URL}/api/pharmacy/prescriptions/${prescriptionId}/approve?user_id=${userId}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
      });
      if (response.ok) {
        alert('✓ Prescription approved!');
        await createOrderFromPrescription(prescriptionId);
        fetchPrescriptions();
      } else {
        const errorText = await response.text();
        let errorMsg = `Status ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          // If not JSON, use status
        }
        alert(`✗ Failed: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('Failed to approve prescription:', error);
      alert(`✗ Error: ${error.message}`);
    }
  };

  const handleRejectPrescription = async (prescriptionId: number) => {
    if (!userId) return;
    try {
      const apiUrl = `${API_BASE_URL}/api/pharmacy/prescriptions/${prescriptionId}/reject?user_id=${userId}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
      });
      if (response.ok) {
        alert('✓ Prescription rejected!');
        fetchPrescriptions();
      } else {
        const errorText = await response.text();
        let errorMsg = `Status ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          // If not JSON, use status
        }
        alert(`✗ Failed: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('Failed to reject prescription:', error);
      alert(`✗ Error: ${error.message}`);
    }
  };

  const handleAddInventory = async () => {
    if (!userId) {
      alert('User ID not found. Please log in again.');
      return;
    }
    
    // Validate form
    if (!newInventoryItem.medicine_name.trim()) {
      alert('Please enter medicine name');
      return;
    }
    if (!newInventoryItem.category.trim()) {
      alert('Please enter category');
      return;
    }
    if (newInventoryItem.current_stock < 0) {
      alert('Current stock must be >= 0');
      return;
    }
    if (newInventoryItem.min_stock < 0) {
      alert('Min stock must be >= 0');
      return;
    }
    if (newInventoryItem.price < 0) {
      alert('Price must be >= 0');
      return;
    }

    try {
      console.log('[Pharmacy] Adding inventory:', { userId, ...newInventoryItem });
      
      const apiUrl = `${API_BASE_URL}/api/pharmacy/inventory?user_id=${userId}`;
      console.log('[Pharmacy] POST URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInventoryItem),
      });

      console.log('[Pharmacy] Response status:', response.status);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('[Pharmacy] Response data:', responseData);
        alert('✓ Medicine added successfully!');
        setNewInventoryItem({ medicine_name: '', category: '', current_stock: 0, min_stock: 0, price: 0 });
        setShowAddInventoryModal(false);
        fetchInventory();
      } else {
        const errorText = await response.text();
        console.error('[Pharmacy] Error response:', response.status, errorText);
        let errorMsg = `Status ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          // If not JSON, use status
        }
        alert(`✗ Failed to add medicine: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('[Pharmacy] Failed to add inventory item:', error);
      alert(`✗ Error adding medicine: ${error.message || 'Network error'}`);
    }
  };

  const handleUpdateInventory = async (itemId: number, updates: Partial<InventoryItem>) => {
    if (!userId) return;
    try {
      const apiUrl = `${API_BASE_URL}/api/pharmacy/inventory/${itemId}?user_id=${userId}`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        alert('✓ Inventory updated successfully!');
        fetchInventory();
      } else {
        const errorText = await response.text();
        let errorMsg = `Status ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          // If not JSON, use status
        }
        alert(`✗ Failed to update: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('Failed to update inventory item:', error);
      alert(`✗ Error: ${error.message}`);
    }
  };

  const handleUpdateOrderStatus = async (orderPrimaryId: number, status: OrderStatus) => {
    if (!userId) return;
    try {
      const apiUrl = `${API_BASE_URL}/api/orders/${orderPrimaryId}/status?user_id=${userId}`;
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Status ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          // If not JSON, use status
        }
        alert(`✗ Failed to update order: ${errorMsg}`);
        return;
      }

      fetchOrders();
      fetchAnalytics();
    } catch (error: any) {
      console.error('Failed to update order status:', error);
      alert(`✗ Error updating order: ${error.message}`);
    }
  };

  const filteredPrescriptions = filterStatus === 'all' 
    ? prescriptions 
    : prescriptions.filter(p => p.pharmacy_status === filterStatus);

  const renderPrescriptions = () => (
    <div className="space-y-6">
    {/* Stats Cards */}
<div className="grid md:grid-cols-4 gap-6">
  <div className="bg-gradient-to-r from-orange-100 via-orange-200 to-orange-300 rounded-xl shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Pending Prescriptions</p>
        <p className="text-2xl font-bold text-orange-800">
          {prescriptions.filter(p => p.pharmacy_status === 'pending').length}
        </p>
      </div>
      <Clock className="h-8 w-8 text-orange-700" />
    </div>
  </div>

  <div className="bg-gradient-to-r from-green-100 via-emerald-200 to-green-300 rounded-xl shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Approved Prescriptions</p>
        <p className="text-2xl font-bold text-green-800">
          {prescriptions.filter(p => p.pharmacy_status === 'approved').length}
        </p>
      </div>
      <Check className="h-8 w-8 text-green-700" />
    </div>
  </div>

  <div className="bg-gradient-to-r from-blue-100 via-sky-200 to-blue-300 rounded-xl shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Total Prescriptions</p>
        <p className="text-2xl font-bold text-blue-800">{prescriptions.length}</p>
      </div>
      <FileText className="h-8 w-8 text-blue-700" />
    </div>
  </div>

  <div className="bg-gradient-to-r from-purple-100 via-indigo-200 to-purple-300 rounded-xl shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Rejected</p>
        <p className="text-2xl font-bold text-purple-800">
          {prescriptions.filter(p => p.pharmacy_status === 'rejected').length}
        </p>
      </div>
      <X className="h-8 w-8 text-purple-700" />
    </div>
  </div>
</div>

    {/* Filters */}
<div className="bg-gradient-to-r from-cyan-100 via-blue-100 to-emerald-100 rounded-xl shadow-sm p-6">
  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
    <div className="flex items-center space-x-4">
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
        </select>
      </div>
    </div>
  </div>
</div>

{/* Prescriptions List */}
<div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-emerald-50 rounded-xl shadow-sm p-6">
  <h2 className="text-2xl font-extrabold text-gray-900 mb-6 tracking-tight">
    Digital Prescriptions
  </h2>
  {prescriptionsLoading ? (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  ) : prescriptions.length === 0 ? (
    <div className="text-center py-8 text-gray-500">No prescriptions available</div>
  ) : (
    <div className="space-y-4">
      {filteredPrescriptions.map((prescription) => (
        <div
          key={prescription.id}
          className={`rounded-lg p-6 shadow-md transition ${
            prescription.pharmacy_status === 'pending'
              ? 'bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200'
              : prescription.pharmacy_status === 'approved'
              ? 'bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200'
              : 'bg-gradient-to-r from-red-50 to-red-100 border border-red-200'
          }`}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center space-x-4">
                <h3 className="font-bold text-lg text-gray-900">#{prescription.id}</h3>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    prescription.pharmacy_status === 'pending'
                      ? 'bg-orange-200 text-orange-900'
                      : prescription.pharmacy_status === 'approved'
                      ? 'bg-blue-200 text-blue-900'
                      : 'bg-red-200 text-red-900'
                  }`}
                >
                  {prescription.pharmacy_status}
                </span>
              </div>
              {/* Highlighted Details */}
              <p className="text-base font-semibold text-gray-800 mt-2">
                👤 Patient: <span className="text-blue-800">{prescription.patient_name}</span>
              </p>
              <p className="text-sm font-medium text-gray-700">
                🩺 Doctor: <span className="text-emerald-700">{prescription.doctor_name}</span>
              </p>
              <p className="text-xs text-gray-600 font-light">
                {prescription.date ? new Date(prescription.date).toLocaleDateString() : 'N/A'}
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
                    {medicine.dosage && <span className="text-gray-700 text-sm">| {medicine.dosage}</span>}
                    {medicine.frequency && <span className="text-gray-700 text-sm">| {medicine.frequency}</span>}
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
            </div>
            <div className="flex space-x-2">
              {prescription.pharmacy_status === 'pending' && (
                <>
                  <button
                    onClick={() => handleRejectPrescription(prescription.id)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprovePrescription(prescription.id)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
                  >
                    Approve
                  </button>
                </>
              )}
              {prescription.pharmacy_status === 'approved' && (
                <span className="bg-emerald-200 text-emerald-800 px-4 py-2 rounded-lg text-sm font-semibold">
                  ✓ Approved
                </span>
              )}
              {prescription.pharmacy_status === 'rejected' && (
                <span className="bg-red-200 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold">
                  ✗ Rejected
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
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
          <p className="text-2xl font-bold">{inventoryStats?.total_items || 0}</p>
        </div>
        <Package className="h-8 w-8 text-white opacity-90" />
      </div>
    </div>

    {/* Low Stock */}
    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl shadow-md p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Low Stock Items</p>
          <p className="text-2xl font-bold">{inventoryStats?.low_stock_count || 0}</p>
        </div>
        <Clock className="h-8 w-8 text-white opacity-90" />
      </div>
    </div>

    {/* Out of Stock */}
    <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-xl shadow-md p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Out of Stock</p>
          <p className="text-2xl font-bold">{inventoryStats?.out_of_stock_count || 0}</p>
        </div>
        <X className="h-8 w-8 text-white opacity-90" />
      </div>
    </div>

    {/* Inventory Value */}
    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-md p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Inventory Value</p>
          <p className="text-2xl font-bold">₹{(inventoryStats?.inventory_value || 0).toFixed(0)}</p>
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
    <button
      onClick={() => setShowAddInventoryModal(true)}
      className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-2 rounded-full shadow-md hover:opacity-90 transition"
    >
      + Add New Item
    </button>
  </div>

  {showAddInventoryModal && (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="font-bold mb-4">Add New Medicine</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          placeholder="Medicine Name"
          value={newInventoryItem.medicine_name}
          onChange={(e) => setNewInventoryItem({...newInventoryItem, medicine_name: e.target.value})}
          className="border border-gray-300 rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Category"
          value={newInventoryItem.category}
          onChange={(e) => setNewInventoryItem({...newInventoryItem, category: e.target.value})}
          className="border border-gray-300 rounded px-3 py-2"
        />
        <input
          type="number"
          placeholder="Current Stock"
          value={newInventoryItem.current_stock}
          onChange={(e) => setNewInventoryItem({...newInventoryItem, current_stock: parseInt(e.target.value)})}
          className="border border-gray-300 rounded px-3 py-2"
        />
        <input
          type="number"
          placeholder="Min Stock"
          value={newInventoryItem.min_stock}
          onChange={(e) => setNewInventoryItem({...newInventoryItem, min_stock: parseInt(e.target.value)})}
          className="border border-gray-300 rounded px-3 py-2"
        />
        <input
          type="number"
          placeholder="Price"
          value={newInventoryItem.price}
          onChange={(e) => setNewInventoryItem({...newInventoryItem, price: parseFloat(e.target.value)})}
          className="border border-gray-300 rounded px-3 py-2"
        />
      </div>
      <div className="flex space-x-2">
        <button
          onClick={handleAddInventory}
          className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
        >
          Save
        </button>
        <button
          onClick={() => setShowAddInventoryModal(false)}
          className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    </div>
  )}

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
        {inventory.length === 0 ? (
          <tr>
            <td colSpan={7} className="text-center py-8 text-gray-500">
              {inventoryLoading ? 'Loading inventory...' : 'No inventory items yet'}
            </td>
          </tr>
        ) : (
          inventory.map((item, index) => (
            <tr
              key={index}
              className={`hover:bg-blue-50 transition ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
            >
              <td className="px-6 py-4 border border-blue-100 font-medium text-gray-900">{item.medicine_name}</td>
              <td className="px-6 py-4 border border-blue-100 text-sm text-gray-700">{item.category}</td>
              <td className="px-6 py-4 border border-blue-100 text-sm font-semibold text-gray-900">{item.current_stock}</td>
              <td className="px-6 py-4 border border-blue-100 text-sm text-gray-700">{item.min_stock}</td>
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
                <button
                  onClick={() => {
                    const newStock = prompt('Enter new stock quantity:', item.current_stock.toString());
                    if (newStock !== null) {
                      handleUpdateInventory(item.id, {current_stock: parseInt(newStock)});
                    }
                  }}
                  className="text-blue-600 font-semibold hover:text-blue-800 mr-3"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleUpdateInventory(item.id, {current_stock: item.min_stock})}
                  className="text-emerald-600 font-semibold hover:text-emerald-800"
                >
                  Restock
                </button>
              </td>
            </tr>
          ))
        )}
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
      {ordersLoading ? (
        <div className="text-center py-8 text-gray-600">Loading orders...</div>
      ) : approvedOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No approved orders found for this pharmacy</div>
      ) : approvedOrders.map((order) => {
        const baseTotal = Number(order.total_amount || 0);
        const gstAmount = baseTotal * 0.18;
        const finalTotal = baseTotal + gstAmount;

        return (
        <div 
          key={order.id} 
          className={`rounded-lg p-5 shadow-md border-l-4 transition transform hover:scale-[1.01] ${
            order.status === 'READY_FOR_PICKUP'
              ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-400'
              : order.status === 'PROCESSING'
              ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-400'
              : 'bg-gradient-to-r from-green-50 to-green-100 border-green-400'
          }`}
        >
          <div className="flex justify-between items-center">
            {/* Left Side */}
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">
                Order #{order.order_id}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                👤 {order.patient_name || 'Unknown'} • 🧾 {order.total_items} items • 📅 {formatDate(order.created_at)}
              </p>
            </div>

            {/* Right Side */}
            <div className="text-right">
              <p className="font-bold text-gray-900 text-lg">
                {formatCurrency(finalTotal)}
              </p>
              <p className="text-xs text-gray-600">Base {formatCurrency(baseTotal)} + GST 18% {formatCurrency(gstAmount)}</p>
              <span
                className={`inline-block mt-1 text-xs font-semibold px-3 py-1 rounded-full shadow-sm ${
                  order.status === 'READY_FOR_PICKUP'
                    ? 'bg-blue-200 text-blue-900'
                    : order.status === 'PROCESSING'
                    ? 'bg-orange-200 text-orange-900'
                    : 'bg-green-200 text-green-900'
                }`}
              >
                {statusLabel(order.status)}
              </span>
              {order.status !== 'COMPLETED' && (
                <div className="mt-2">
                  <button
                    onClick={() => handleUpdateOrderStatus(order.id, 'COMPLETED')}
                    className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-full hover:bg-emerald-700"
                  >
                    Mark Completed
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )})}
    </div>
  </div>
</div>

  );

  const renderAnalytics = () => (
    <div className="space-y-4 h-[calc(100vh-220px)] overflow-hidden">
  {/* Stats Section */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 overflow-x-hidden">
    {[
      {
        title: "Monthly Revenue",
        value: formatCurrency(analyticsData?.monthly_revenue || 0),
        change: "Current month",
        changeType: "positive",
        gradient: "from-cyan-50 to-blue-100",
        border: "border-cyan-400",
        icon: "💰",
      },
      {
        title: "Total Orders",
        value: String(analyticsData?.total_orders || 0),
        change: "All-time",
        changeType: "positive",
        gradient: "from-emerald-50 to-green-100",
        border: "border-emerald-400",
        icon: "📄",
      },
      {
        title: "Average Order Value",
        value: formatCurrency(analyticsData?.average_order_value || 0),
        change: "Across all orders",
        changeType: "positive",
        gradient: "from-orange-50 to-yellow-100",
        border: "border-orange-400",
        icon: "📊",
      },
      {
        title: "Completed Orders",
        value: String(analyticsData?.completed_orders || 0),
        change: "Marked completed",
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

  {/* Horizontal Tabs */}
  <div className="bg-white rounded-xl shadow-md p-4">
    <div className="flex gap-3 mb-4">
      <button
        onClick={() => setAnalyticsView('top-selling')}
        className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
          analyticsView === 'top-selling'
            ? 'bg-blue-600 text-white'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
        }`}
      >
        Top Selling Medicines
      </button>
      <button
        onClick={() => setAnalyticsView('order-status')}
        className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
          analyticsView === 'order-status'
            ? 'bg-emerald-600 text-white'
            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
        }`}
      >
        Order Status Snapshot
      </button>
    </div>

    {analyticsView === 'top-selling' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {analyticsLoading ? (
          <p className="text-sm text-gray-600">Loading analytics...</p>
        ) : (analyticsData?.top_selling_medicines || []).length === 0 ? (
          <p className="text-sm text-gray-600">No medicine sales yet</p>
        ) : (analyticsData?.top_selling_medicines || []).map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm"
          >
            <div>
              <p className="font-medium text-gray-900">{item.medicine_name}</p>
              <p className="text-sm text-gray-600">{item.total_sold} units sold</p>
            </div>
            <p className="font-bold text-emerald-600">#{index + 1}</p>
          </div>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Processing', count: orders.filter((o) => o.status === 'PROCESSING').length },
          { label: 'Ready For Pickup', count: orders.filter((o) => o.status === 'READY_FOR_PICKUP').length },
          { label: 'Completed', count: orders.filter((o) => o.status === 'COMPLETED').length },
        ].map((entry, index) => (
          <div
            key={index}
            className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-900">{entry.label}</h4>
              <div className="font-bold text-emerald-700">{entry.count}</div>
            </div>
            <p className="text-sm text-gray-600">Real-time count from pharmacy orders</p>
          </div>
        ))}
      </div>
    )}
  </div>
</div>

  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
    {/* Loading Spinner */}
    {!profile && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-16 h-16 border-4 border-blue-400/30 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          </div>
          <p className="text-white/90 font-semibold text-lg">Loading Pharmacy Dashboard...</p>
          <p className="text-white/60 text-sm mt-2">Initializing pharmacy data</p>
        </div>
      </div>
    )}
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
            Welcome back, {profile?.name || signedUser?.name || 'Pharmacy User'}!
          </p>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center flex-row text-right mr-2">
  <span className="text-xs text-emerald-100 mr-1">Signed in as</span>
  <span className="text-sm font-semibold text-white">
    {profile?.email || signedUser?.email || 'Not signed in'}
  </span>
</div>

        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 bg-gray-200">
          <img src={profile?.picture || profile?.profile_picture_url || signedUser?.picture || '/default-avatar.png'} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <button
          onClick={handleLogout}
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
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${activeTab === 'analytics' ? 'h-[calc(100vh-140px)] overflow-hidden' : ''}`}>
        {activeTab === 'prescriptions' && renderPrescriptions()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'analytics' && renderAnalytics()}
      </main>
    </div>
  );
};

export default PharmacyDashboard;