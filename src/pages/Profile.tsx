import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User, Mail, Phone, MapPin, Briefcase, Save, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    location: '',
    jobTitle: '',
    company: '',
    bio: ''
  });

  const handleLogout = () => {
    navigate('/');
  };

  useEffect(() => {
    fetchUserProfile();
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Fetch user profile from Supabase
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch profile details from the profile_details table
      const { data: detailsData, error: detailsError } = await supabase
        .from('profile_details')
        .select('phone, location, job_title, company, bio')
        .eq('profile_id', user.id)
        .maybeSingle(); // maybeSingle because the record might not exist yet

      if (detailsError) throw detailsError;

      setFormData({
        firstName: profileData.first_name || '',
        lastName: profileData.last_name || '',
        email: profileData.email || user?.email || '',
        phone: detailsData?.phone || '',
        location: detailsData?.location || '',
        jobTitle: detailsData?.job_title || '',
        company: detailsData?.company || '',
        bio: detailsData?.bio || ''
      });
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      alert('Failed to load profile data: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) return;
    
    try {
      // Check if profile details record exists
      const { data: existingDetails, error: fetchError } = await supabase
        .from('profile_details')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      let saveError = null;

      if (existingDetails) {
        // Update existing record
        const { error } = await supabase
          .from('profile_details')
          .update({
            phone: formData.phone,
            location: formData.location,
            job_title: formData.jobTitle,
            company: formData.company,
            bio: formData.bio,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDetails.id);
        saveError = error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('profile_details')
          .insert({
            profile_id: user.id,
            phone: formData.phone,
            location: formData.location,
            job_title: formData.jobTitle,
            company: formData.company,
            bio: formData.bio
          });
        saveError = error;
      }

      if (saveError) throw saveError;
      
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile: ' + (error.message || 'Unknown error'));
    }
  };

  if (loading) {
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
            <div className="font-bold text-xl text-[#0B4F6C]">careercast</div>
            <div className="w-10"></div> {/* Spacer for alignment */}
          </div>

          <main className="flex-1 p-4 sm:p-6 md:p-8 bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-[#0B4F6C] mx-auto"></div>
              <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading profile...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
          <div className="font-bold text-xl text-[#0B4F6C]">careercast</div>
          <div className="w-10"></div> {/* Spacer for alignment */}
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Manage your personal information and professional details
              </p>
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] px-4 sm:px-8 py-4 sm:py-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-2xl sm:text-3xl backdrop-blur-sm">
                    {formData.firstName.charAt(0) || 'U'}{formData.lastName.charAt(0) || 'U'}
                  </div>
                  <div className="text-white">
                    <h2 className="text-xl sm:text-2xl font-bold">{formData.firstName} {formData.lastName}</h2>
                    <p className="text-white/90 text-sm sm:text-base">{formData.jobTitle || 'Job Title'}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      First Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        disabled // First name is disabled as requested
                        className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:pr-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all bg-gray-100 text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Last Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        disabled // Last name is disabled as requested
                        className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:pr-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all bg-gray-100 text-sm sm:text-base"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-4 sm:mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled // Email is disabled as requested
                      className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:pr-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all bg-gray-100 text-sm sm:text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:pr-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:pr-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all text-sm sm:text-base"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Job Title
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      <input
                        type="text"
                        name="jobTitle"
                        value={formData.jobTitle}
                        onChange={handleChange}
                        className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:pr-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Company
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:pr-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all text-sm sm:text-base"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-6 sm:mb-8">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all resize-none text-sm sm:text-base"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-[#01796F] text-white px-6 py-2 sm:px-8 sm:py-3 rounded-lg font-semibold hover:bg-[#016761] shadow-md hover:shadow-lg flex items-center gap-2 transition-all text-sm sm:text-base"
                  >
                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}