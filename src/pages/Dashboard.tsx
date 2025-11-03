import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {
  Video,
  Eye,
  CheckCircle,
  Plus,
  FileText,
  Play,
  Redo,
  Clock,
  Loader2,
  X,
  Menu,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [careerCasts, setCareerCasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showPricingPopup, setShowPricingPopup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    navigate('/');
  };

  const handleNewCast = () => {
    // Count completed recordings (status = 'recorded')
    const completedRecordings = careerCasts.filter(cast => cast.status === 'recorded').length;
    
    // If user has 3 or more completed recordings, show pricing popup
    if (completedRecordings >= 3) {
      setShowPricingPopup(true);
    } else {
      navigate('/step1');
    }
  };

  const handleReRecord = (id: string) => navigate(`/record/${id}`);
  const handleViewDetails = (id: string) => navigate(`/final-result/${id}`);
  const handleCloseVideo = () => setSelectedVideo(null);
  const handleClosePricingPopup = () => setShowPricingPopup(false);

  useEffect(() => {
    fetchCareerCasts();
  }, [user]);

  const fetchCareerCasts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch job requests for the current user with related recordings
      const { data, error } = await supabase
        .from('job_requests')
        .select(`
          id,
          job_title,
          resume_path,
          status,
          created_at,
          recordings (
            storage_path
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setCareerCasts(data || []);
    } catch (error) {
      console.error('Error fetching career casts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBadge = (status: string) => {
    switch (status) {
      case 'recorded':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-md text-xs font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Recorded
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md text-xs font-medium">
            <Clock className="w-3.5 h-3.5" /> Resume Uploaded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md text-xs font-medium">
            <Clock className="w-3.5 h-3.5" /> Draft
          </span>
        );
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className="min-h-screen bg-white flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <Sidebar userEmail={user?.email || ''} onLogout={handleLogout} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar for mobile */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="font-bold text-xl text-[#0B4F6C]">Careercast</div>
          <div className="w-10"></div> {/* Spacer for alignment */}
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className="bg-white border border-gray-200 rounded-lg sm:rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] px-4 sm:px-8 py-4 sm:py-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                    Your CareerCasts
                  </h2>
                  <p className="text-white/90 text-xs sm:text-sm">
                    Track progress and manage your recordings
                  </p>
                </div>

                <button
                  onClick={handleNewCast}
                  className="bg-white text-[#0B4F6C] px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold hover:bg-white/90 transition-all shadow-md flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  New CareerCast
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-24">
                <Loader2 className="animate-spin text-[#01796F] h-8 w-8 sm:h-10 sm:w-10 mb-3 sm:mb-4" />
                <p className="text-gray-600 font-medium text-base sm:text-lg">
                  Loading your CareerCasts...
                </p>
              </div>
            ) : careerCasts.length === 0 ? (
              <div className="text-center py-16 sm:py-24 px-4 sm:px-6">
                <div className="bg-gradient-to-br from-[#0B4F6C]/5 to-[#159A9C]/5 rounded-full w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Video className="h-10 w-10 sm:h-12 sm:w-12 text-[#0B4F6C]" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
                  No CareerCasts Yet
                </h3>
                <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base max-w-md mx-auto">
                  Create your first professional video resume and make your
                  profile shine.
                </p>
                <button
                  onClick={handleNewCast}
                  className="bg-[#01796F] text-white px-6 py-2 sm:px-8 sm:py-3 rounded-lg font-semibold hover:bg-[#016761] shadow-md hover:shadow-lg flex items-center gap-1 sm:gap-2 mx-auto transition-all text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Create CareerCast
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[#0B4F6C] uppercase tracking-wide font-semibold">
                    <tr>
                      <th className="py-3 px-4 sm:py-4 sm:px-6">Job Title</th>
                      <th className="py-3 px-4 sm:py-4 sm:px-6">Resume</th>
                      <th className="py-3 px-4 sm:py-4 sm:px-6">Video</th>
                      <th className="py-3 px-4 sm:py-4 sm:px-6">Status</th>
                      <th className="py-3 px-4 sm:py-4 sm:px-6">Created</th>
                      <th className="py-3 px-4 sm:py-4 sm:px-6 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerCasts.map((cast, index) => {
                      const video = cast.recordings?.[0]?.storage_path || null;
                      const hasVideo = !!video;
                      const hasResume = !!cast.resume_path;
                      const bothAvailable = hasVideo && hasResume;

                      return (
                        <tr
                          key={cast.id}
                          className={`hover:bg-[#0B4F6C]/5 transition-all duration-200 ${
                            index !== careerCasts.length - 1 ? 'border-b border-gray-100' : ''
                          }`}
                        >
                          <td className="py-3 px-4 sm:py-4 sm:px-6 font-semibold text-gray-800">
                            {cast.job_title || 'Untitled'}
                          </td>

                          <td className="py-3 px-4 sm:py-4 sm:px-6">
                            {hasResume ? (
                              <a
                                href={cast.resume_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#01796F] hover:text-[#016761] flex items-center gap-1 font-medium transition-colors text-xs sm:text-sm"
                              >
                                <FileText className="w-3 h-3 sm:w-4 sm:h-4" /> View Resume
                              </a>
                            ) : (
                              <span className="text-gray-400 italic text-xs">No resume</span>
                            )}
                          </td>

                          <td className="py-3 px-4 sm:py-4 sm:px-6">
                            {hasVideo ? (
                              <button
                                onClick={() => setSelectedVideo(video)}
                                className="text-[#01796F] hover:text-[#016761] flex items-center gap-1 font-medium transition-colors text-xs sm:text-sm"
                              >
                                <Play className="w-3 h-3 sm:w-4 sm:h-4" /> Play
                              </button>
                            ) : (
                              <span className="text-gray-400 italic text-xs">No video</span>
                            )}
                          </td>

                          <td className="py-3 px-4 sm:py-4 sm:px-6">{getBadge(cast.status)}</td>

                          <td className="py-3 px-4 sm:py-4 sm:px-6 text-gray-600 font-medium text-xs sm:text-sm">
                            {formatDate(cast.created_at)}
                          </td>

                          <td className="py-3 px-4 sm:py-4 sm:px-6">
                            <div className="flex flex-col sm:flex-row justify-center gap-1 sm:gap-2">
                              <button
                                onClick={() => bothAvailable && handleViewDetails(cast.id)}
                                disabled={!bothAvailable}
                                className={`${
                                  bothAvailable
                                    ? 'bg-[#01796F] hover:bg-[#016761] text-white shadow-sm'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                } text-xs px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold flex items-center gap-1 transition-all`}
                              >
                                <Eye className="w-3 h-3" /> View
                              </button>

                              <button
                                onClick={() => handleReRecord(cast.id)}
                                className="border-2 border-[#0B4F6C] text-[#0B4F6C] text-xs px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-[#0B4F6C] hover:text-white font-semibold flex items-center gap-1 transition-all"
                              >
                                <Redo className="w-3 h-3" /> Re-record
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* Video popup */}
        {selectedVideo && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden relative">
              <div className="flex justify-between items-center border-b border-gray-200 p-3 sm:p-5 bg-gradient-to-r from-[#0B4F6C] to-[#159A9C]">
                <h3 className="font-bold text-white text-base sm:text-lg">
                  CareerCast Video
                </h3>
                <button
                  onClick={handleCloseVideo}
                  className="text-white hover:text-white/80 text-xl sm:text-2xl font-bold w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="bg-black aspect-video">
                <video
                  controls
                  autoPlay
                  className="w-full h-full"
                  src={selectedVideo}
                ></video>
              </div>
            </div>
          </div>
        )}

        {/* Pricing popup */}
        {showPricingPopup && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-md w-full overflow-hidden relative">
              <div className="flex justify-between items-center border-b border-gray-200 p-3 sm:p-5 bg-gradient-to-r from-[#0B4F6C] to-[#159A9C]">
                <h3 className="font-bold text-white text-base sm:text-lg">
                  Upgrade Your Account
                </h3>
                <button
                  onClick={handleClosePricingPopup}
                  className="text-white hover:text-white/80 text-xl sm:text-2xl font-bold w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <div className="text-center mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-[#0B4F6C] to-[#159A9C] rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <Video className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-2">
                    Unlock Unlimited CareerCasts
                  </h4>
                  <p className="text-gray-600 text-xs sm:text-sm">
                    You've reached the limit of 3 free CareerCasts. Upgrade to our Premium plan for unlimited recordings.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-[#0B4F6C]/5 to-[#159A9C]/5 rounded-lg p-4 sm:p-5 mb-4 sm:mb-6">
                  <div className="flex justify-between items-center mb-2 sm:mb-3">
                    <h5 className="font-bold text-gray-900 text-sm sm:text-base">Premium Plan</h5>
                    <div className="text-right">
                      <div className="text-lg sm:text-2xl font-bold text-[#0B4F6C]">$9<span className="text-sm sm:text-lg">/month</span></div>
                    </div>
                  </div>
                  <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                    <li className="flex items-center gap-1 sm:gap-2">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#01796F]" />
                      Unlimited CareerCasts
                    </li>
                    <li className="flex items-center gap-1 sm:gap-2">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#01796F]" />
                      HD Video Recording
                    </li>
                    <li className="flex items-center gap-1 sm:gap-2">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#01796F]" />
                      Advanced Analytics
                    </li>
                    <li className="flex items-center gap-1 sm:gap-2">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#01796F]" />
                      Priority Support
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      handleClosePricingPopup();
                      navigate('/billing');
                    }}
                    className="w-full bg-[#01796F] text-white px-3 py-2 sm:px-4 sm:py-3 rounded-lg font-semibold hover:bg-[#016761] shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
                  >
                    Upgrade Now
                  </button>
                  <button
                    onClick={handleClosePricingPopup}
                    className="w-full bg-gray-200 text-gray-700 px-3 py-2 sm:px-4 sm:py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all text-sm sm:text-base"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}