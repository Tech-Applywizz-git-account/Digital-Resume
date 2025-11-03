import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Mail, MessageSquare, Send, Phone, MapPin, Clock, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Contact() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    priority: 'medium'
  });

  const handleLogout = () => {
    navigate('/');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const contactInfo = [
    {
      icon: Mail,
      title: 'Email',
      value: 'support@careercast.com',
      description: 'Send us an email anytime'
    },
    {
      icon: Phone,
      title: 'Phone',
      value: '+1 (555) 123-4567',
      description: 'Mon-Fri from 9am to 6pm'
    },
    {
      icon: MapPin,
      title: 'Office',
      value: '123 Career Street, SF, CA 94102',
      description: 'Visit our office'
    }
  ];

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
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Get in touch with our support team. We are here to help you succeed
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {contactInfo.map((info, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#0B4F6C] to-[#159A9C] rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                    <info.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm sm:text-base">{info.title}</h3>
                  <p className="text-[#01796F] font-semibold mb-1 text-sm">{info.value}</p>
                  <p className="text-xs sm:text-sm text-gray-600">{info.description}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] px-4 sm:px-8 py-4 sm:py-6 flex items-center gap-2 sm:gap-3">
                    <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    <h2 className="text-lg sm:text-xl font-bold text-white">Send us a Message</h2>
                  </div>

                  <form onSubmit={handleSubmit} className="p-4 sm:p-8">
                    <div className="mb-4 sm:mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Subject
                      </label>
                      <input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all text-sm sm:text-base"
                        placeholder="What can we help you with?"
                      />
                    </div>

                    <div className="mb-4 sm:mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all text-sm sm:text-base"
                      >
                        <option value="low">Low - General inquiry</option>
                        <option value="medium">Medium - Need assistance</option>
                        <option value="high">High - Urgent issue</option>
                      </select>
                    </div>

                    <div className="mb-6 sm:mb-8">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Message
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={4}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B4F6C] focus:border-transparent outline-none transition-all resize-none text-sm sm:text-base"
                        placeholder="Tell us more about your question or issue..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#01796F] text-white px-4 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold hover:bg-[#016761] shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all text-sm sm:text-base"
                    >
                      <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      Send Message
                    </button>
                  </form>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#01796F]" />
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base">Support Hours</h3>
                  </div>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monday - Friday</span>
                      <span className="font-semibold text-gray-900">9am - 6pm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Saturday</span>
                      <span className="font-semibold text-gray-900">10am - 4pm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sunday</span>
                      <span className="font-semibold text-gray-900">Closed</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#0B4F6C] to-[#159A9C] rounded-lg sm:rounded-xl p-4 sm:p-6 text-white">
                  <h3 className="font-bold text-base sm:text-lg mb-2">Quick Response</h3>
                  <p className="text-white/90 text-xs sm:text-sm mb-3 sm:mb-4">
                    We typically respond to all inquiries within 24 hours during business days
                  </p>
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 backdrop-blur-sm">
                    <p className="text-xs text-white/80 mb-1">Average Response Time</p>
                    <p className="text-lg sm:text-2xl font-bold">4 hours</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-4 sm:p-6">
                  <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">FAQ Available</h3>
                  <p className="text-xs sm:text-sm text-blue-800 mb-2 sm:mb-3">
                    Check our frequently asked questions for quick answers
                  </p>
                  <button className="text-[#01796F] font-semibold text-xs sm:text-sm hover:text-[#016761] transition-colors">
                    View FAQ →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}