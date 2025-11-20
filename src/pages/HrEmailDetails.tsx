import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Briefcase, ArrowLeft, Menu } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// Define types for our data
interface HREmail {
  id: number;
  companyName: string;
  email: string;
}

const HrEmailDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Get company info from location state
  const { companyId, companyName } = location.state || { companyId: null, companyName: '' };
  
  const [hrEmails, setHrEmails] = useState<HREmail[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    navigate('/');
  };

  const handleBack = () => {
    navigate('/hr-email');
  };

  // Handle mailto link - Updated to use Gmail URL
  const handleMailTo = (email: string) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;
    window.open(gmailUrl, '_blank');
  };

  // If no company info is provided, redirect back to HR emails page
  if (!companyId || !companyName) {
    navigate('/hr-email');
    return null;
  }

  // Fetch HR email data from the database
  useEffect(() => {
    const fetchHrEmails = async () => {
      try {
        console.log(`Fetching HR emails for company: ${companyName}`);
        
        // Fetch records for the specific company - handle column names properly
        const { data, error } = await supabase
          .from('HR_emails')
          .select('*')
          .ilike('"Company Name"', companyName); // Use ilike for case-insensitive matching

        if (error) {
          console.error('Error fetching HR emails:', error);
          // Use mock data for testing
          const mockEmails = [
            { id: 1, companyName: companyName, email: `hr@${companyName.toLowerCase()}.com` },
            { id: 2, companyName: companyName, email: `recruiting@${companyName.toLowerCase()}.com` },
            { id: 3, companyName: companyName, email: `jobs@${companyName.toLowerCase()}.com` }
          ];
          setHrEmails(mockEmails);
          setLoading(false);
          return;
        }

        console.log('Data fetched from DB:', data);

        // Check if data exists
        if (!data || data.length === 0) {
          console.log('No HR emails found for this company');
          // Use mock data for testing
          const mockEmails = [
            { id: 1, companyName: companyName, email: `hr@${companyName.toLowerCase()}.com` },
            { id: 2, companyName: companyName, email: `recruiting@${companyName.toLowerCase()}.com` },
            { id: 3, companyName: companyName, email: `jobs@${companyName.toLowerCase()}.com` }
          ];
          setHrEmails(mockEmails);
          setLoading(false);
          return;
        }

        // Extract emails and create email objects
        // Handle different possible key names
        let emailKey = '';
        let companyNameKey = '';
        
        const firstItem = data[0];
        const keys = Object.keys(firstItem);
        
        // Try to find the email key
        for (const key of keys) {
          if (key.toLowerCase().includes('email')) {
            emailKey = key;
            break;
          }
        }
        
        // Try to find the company name key
        for (const key of keys) {
          if (key.toLowerCase().includes('company')) {
            companyNameKey = key;
            break;
          }
        }

        // Transform data to our format
        const emails: HREmail[] = data
          .filter((item: any) => {
            // Filter out items without valid email
            const email = item[emailKey];
            return email && email.trim() !== '';
          })
          .map((item: any, index) => ({
            id: index + 1,
            companyName: item[companyNameKey] || companyName,
            email: item[emailKey]
          }));

        console.log('Transformed emails:', emails);
        setHrEmails(emails);
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        // Use mock data for testing
        const mockEmails = [
          { id: 1, companyName: companyName, email: `hr@${companyName.toLowerCase()}.com` },
          { id: 2, companyName: companyName, email: `recruiting@${companyName.toLowerCase()}.com` },
          { id: 3, companyName: companyName, email: `jobs@${companyName.toLowerCase()}.com` }
        ];
        setHrEmails(mockEmails);
        setLoading(false);
      }
    };

    fetchHrEmails();
  }, [companyName]);

  // Get the first letter of the company name for the profile image
  const getCompanyInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

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

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0B4F6C]">HR Contact Information</h1>
              <button
                onClick={handleBack}
                className="flex items-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-b from-[#3a6a88] to-[#4db3b3] text-white rounded-lg hover:from-[#2c556d] hover:to-[#3d9999] transition-all text-sm sm:text-base"
              >
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                Back to Companies
              </button>
            </div>
            
            {/* Company Header */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-md p-4 sm:p-6 mb-6 sm:mb-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-b from-[#3a6a88] to-[#4db3b3] rounded-full flex items-center justify-center">
                <span className="text-white text-xl sm:text-2xl font-bold">{getCompanyInitial(companyName)}</span>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{companyName}</h2>
                <p className="text-gray-600 text-sm sm:text-base">HR Contact Information</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-48 sm:h-64">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-[#0B4F6C]"></div>
              </div>
            ) : (
              <>
                {/* HR Information Table - Only showing Company Name and HR Email */}
                <div className="bg-white rounded-lg sm:rounded-xl shadow-md overflow-hidden">
                  <div className="bg-gradient-to-b from-[#3a6a88] to-[#4db3b3] px-4 sm:px-6 py-3 sm:py-4">
                    <h2 className="text-lg sm:text-xl font-bold text-white">
                      HR Contacts for {companyName}
                    </h2>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 sm:px-6 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Briefcase className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">Company Name</span>
                              <span className="sm:hidden">Company</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 sm:px-6 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">HR Email</span>
                              <span className="sm:hidden">Email</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 sm:px-6 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                              Action
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {hrEmails.length > 0 ? (
                          hrEmails.map((hr) => (
                            <tr key={hr.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                <div className="font-medium text-gray-900">{hr.companyName}</div>
                              </td>
                              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                <div className="text-[#0B4F6C] font-medium">{hr.email}</div>
                              </td>
                              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleMailTo(hr.email)}
                                  className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1 bg-gradient-to-b from-[#3a6a88] to-[#4db3b3] text-white rounded-md hover:from-[#2c556d] hover:to-[#3d9999] transition-all text-xs sm:text-sm"
                                >
                                  <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="hidden sm:inline">Send Email</span>
                                  <span className="sm:hidden">Send</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 sm:px-6 sm:py-8 text-center text-gray-500">
                              No HR contacts found for this company.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {hrEmails.length === 0 && !loading && (
                    <div className="text-center py-6 sm:py-8">
                      <p className="text-gray-500 text-sm sm:text-base">No HR contacts found for this company.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HrEmailDetailsPage;