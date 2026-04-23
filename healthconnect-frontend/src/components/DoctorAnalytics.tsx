import { useEffect, useState } from 'react';
import { buildApiUrl } from '../config/api';
import { getAuthHeaders, useBackendProfile } from '../hooks/useBackendProfile';
import { Star, TrendingUp, Users, Clock, BarChart3, Activity } from 'lucide-react';

interface AnalyticsData {
  doctor_id: number;
  doctor_name: string;
  total_patients_this_month: number;
  patient_change_percent: number;
  avg_consultation_time: string;
  consultation_time_change: string;
  patient_satisfaction: string;
  satisfaction_change: number;
  prescriptions_issued: number;
  prescription_change_percent: number;
  common_diagnoses: Array<{
    diagnosis: string;
    cases: number;
    percentage: number;
  }>;
  patient_feedback: Array<{
    patient_name: string;
    rating: number;
    feedback_text: string;
    created_at: string;
  }>;
}

interface DoctorAnalyticsProps {
  onLogout: () => void;
}

const DoctorAnalytics = ({ onLogout }: DoctorAnalyticsProps) => {
  const { profile } = useBackendProfile();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    
    // Force immediate fresh fetch on component mount
    fetchAnalytics();
    
    // Auto-refresh every 10 seconds (more frequent for real-time feel)
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [profile?.id]);

  const fetchAnalytics = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Force cache busting with timestamp
      const timestamp = new Date().getTime();
      const url = buildApiUrl(`/api/analytics/doctor/${profile.id}?t=${timestamp}`);
      const headers = getAuthHeaders();
      
      console.log(`[DoctorAnalytics] Fetching from: ${url}`);
      console.log(`[DoctorAnalytics] Headers:`, headers);
      
      const response = await fetch(url, {
        headers: headers,
        cache: 'no-store',
      });
      
      console.log(`[DoctorAnalytics] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DoctorAnalytics] API Error:`, errorText);
        throw new Error(`Failed to fetch analytics: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`[DoctorAnalytics] ✅ Real data fetched:`, {
        total_patients: data.total_patients_this_month,
        satisfaction: data.patient_satisfaction,
        feedback_count: data.patient_feedback?.length,
        feedback_data: data.patient_feedback,
      });
      setAnalytics(data);
    } catch (err) {
      console.error('[DoctorAnalytics] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    onLogout();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1220] to-[#0b2537] text-white flex items-center justify-center p-2 sm:p-3 lg:p-4">
        <div className="bg-red-900 border-2 border-red-600 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-8 max-w-xs sm:max-w-sm lg:max-w-md text-center">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-red-200 mb-3 sm:mb-4 lg:mb-6">⚠️ Error Loading Analytics</h2>
          <p className="text-red-100 mb-4 sm:mb-6 font-mono text-xs sm:text-sm break-words">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1220] to-[#0b2537] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-2xl">Loading your analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1220] to-[#0b2537] text-white flex items-center justify-center">
        <div className="text-2xl">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1220] to-[#0b2537] text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Doctor Analytics Dashboard</h1>
              <p className="text-purple-100 mt-2">Welcome back, {analytics.doctor_name} !</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={handleLogout}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Key Metrics Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
          {/* Total Patients */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-4 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm font-medium">Total Patients This Month</p>
                <p className="text-2xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 sm:mt-2 lg:mt-3">{analytics.total_patients_this_month}</p>
                <p className={`text-xs sm:text-sm mt-1 sm:mt-2 ${analytics.patient_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analytics.patient_change_percent >= 0 ? '+' : ''}{analytics.patient_change_percent}% from last month
                </p>
              </div>
              <Users className="h-10 w-10 text-purple-600" />
            </div>
          </div>

          {/* Avg Consultation Time */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Avg Consultation Time</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.avg_consultation_time}</p>
                <p className="text-sm text-blue-600 mt-2">{analytics.consultation_time_change}</p>
              </div>
              <Clock className="h-10 w-10 text-blue-600" />
            </div>
          </div>

          {/* Patient Satisfaction */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Patient Satisfaction</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.patient_satisfaction}</p>
                <p className={`text-sm mt-2 ${analytics.satisfaction_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analytics.satisfaction_change >= 0 ? '+' : ''}{analytics.satisfaction_change} from last month
                </p>
                {analytics.patient_feedback.length > 0 ? (
                  <p className="text-xs text-gray-500 mt-2">({analytics.patient_feedback.length} reviews received)</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">No feedback yet</p>
                )}
              </div>
              <Star className="h-10 w-10 text-yellow-500" />
            </div>
          </div>

          {/* Prescriptions Issued */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Prescriptions Issued</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.prescriptions_issued}</p>
                <p className={`text-sm mt-2 ${analytics.prescription_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analytics.prescription_change_percent >= 0 ? '+' : ''}{analytics.prescription_change_percent}% from last month
                </p>
              </div>
              <Activity className="h-10 w-10 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Patient Feedback & Common Diagnoses Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Patient Feedback */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Patient Feedback</h2>
              {analytics.patient_feedback.length > 0 && (
                <span className="text-sm font-semibold text-emerald-600">
                  {analytics.patient_feedback.length} review{analytics.patient_feedback.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="space-y-4">
              {analytics.patient_feedback.length > 0 ? (
                analytics.patient_feedback.map((feedback, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{feedback.patient_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(feedback.created_at).toLocaleDateString()} at {new Date(feedback.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= feedback.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {feedback.feedback_text && (
                      <p className="text-gray-700 text-sm mt-2 italic">"{feedback.feedback_text}"</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-blue-50 rounded-lg">
                  <Star className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No patient feedback yet</p>
                  <p className="text-sm text-gray-500 mt-1">Feedback will appear here after patients submit ratings</p>
                </div>
              )}
            </div>
          </div>

          {/* Common Diagnoses */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Common Diagnoses</h2>
              {analytics.common_diagnoses.length > 0 && (
                <span className="text-sm font-semibold text-emerald-600">
                  {analytics.common_diagnoses.reduce((sum, d) => sum + d.cases, 0)} cases
                </span>
              )}
            </div>
            <div className="space-y-4">
              {analytics.common_diagnoses.length > 0 ? (
                analytics.common_diagnoses.map((diagnosis, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{diagnosis.diagnosis || 'Unspecified'}</span>
                        <span className="text-xs text-gray-500 ml-2">({diagnosis.cases} case{diagnosis.cases !== 1 ? 's' : ''})</span>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">{diagnosis.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${diagnosis.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-green-50 rounded-lg">
                  <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No diagnoses recorded yet</p>
                  <p className="text-sm text-gray-500 mt-1">Diagnoses will appear here as you issue prescriptions</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <button
            onClick={fetchAnalytics}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Refresh Analytics
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorAnalytics;
