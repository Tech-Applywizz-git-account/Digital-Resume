import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Menu } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// Define types for our data
interface HRCompany {
  id: number;
  name: string;
}

const HrEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companies, setCompanies] = useState<HRCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    navigate('/');
  };

  const handleCompanySelect = (companyId: number, companyName: string) => {
    // Navigate to the details page with the company ID and name as state
    navigate('/hr-email-details', { state: { companyId, companyName } });
  };

  // Fetch company data from the database
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        console.log('Fetching data from HR_emails table...');
        
        // Fetch all records from HR_emails table
        const { data, error } = await supabase
          .from('HR_emails')
          .select('*');

        if (error) {
          console.error('Error fetching companies:', error);
          // Even with an error, we should stop loading
          setLoading(false);
          return;
        }

        console.log('Data fetched from DB:', data);

        // Check if data exists
        if (!data || data.length === 0) {
          console.log('No data found in HR_emails table');
          // Set some mock data for testing purposes
          const mockCompanies = [
            { id: 1, name: 'Google' },
            { id: 2, name: 'Microsoft' },
            { id: 3, name: 'Amazon' },
            { id: 4, name: 'Apple' },
            { id: 5, name: 'Meta' },
            { id: 6, name: 'Netflix' }
          ];
          setCompanies(mockCompanies);
          setLoading(false);
          return;
        }

        // Extract unique company names and create company objects
        // Handle different possible key names for company name
        let companyNames = [];
        const firstItem = data[0];
        let companyNameKey = '';

        // Try to find the company name key
        const keys = Object.keys(firstItem);
        for (const key of keys) {
          if (key.toLowerCase().includes('company')) {
            companyNameKey = key;
            break;
          }
        }

        if (companyNameKey) {
          companyNames = data
            .map((item: any) => item[companyNameKey])
            .filter((name: string) => name && name.trim() !== '');
        }

        const uniqueCompanyNames = Array.from(new Set(companyNames));
        
        const uniqueCompanies = uniqueCompanyNames.map((name, index) => ({
          id: index + 1,
          name: name
        }));

        console.log('Unique companies:', uniqueCompanies);
        setCompanies(uniqueCompanies);
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        // Set some mock data for testing purposes
        const mockCompanies = [
          { id: 1, name: 'Google' },
          { id: 2, name: 'Microsoft' },
          { id: 3, name: 'Amazon' },
          { id: 4, name: 'Apple' },
          { id: 5, name: 'Meta' },
          { id: 6, name: 'Netflix' }
        ];
        setCompanies(mockCompanies);
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

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
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0B4F6C] mb-6 sm:mb-8">HR Contact Information</h1>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0B4F6C]"></div>
              </div>
            ) : (
              <>
                {/* Show companies count for debugging */}
                <div className="mb-4 text-sm text-gray-500">
                  Found {companies.length} companies
                </div>
                
                {/* Company Cards Grid - 3 cards per row */}
                {companies.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
                    {companies.map((company) => (
                      <div 
                        key={company.id}
                        onClick={() => handleCompanySelect(company.id, company.name)}
                        className="rounded-lg bg-white text-card-foreground shadow-sm p-4 sm:p-6 h-full flex flex-col items-center justify-center text-center border hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group hover:border-[#159A9C]"
                      >
                        <div className="w-14 h-14 flex items-center justify-center rounded-full bg-[#0B4F6C]/5 text-[#0B4F6C] font-semibold text-xl mb-3">
                          {getCompanyInitial(company.name)}
                        </div>
                        <h3 className="font-medium text-base mb-1 max-w-[200px] truncate group-hover:text-[#0B4F6C] transition-colors" title={company.name}>
                          {company.name}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                          <Briefcase className="lucide-building-2 h-3.5 w-3.5" />
                          HR Contact
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-md p-8 sm:p-12 text-center">
                    <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Companies Found</h3>
                    <p className="text-gray-500">
                      No HR contact information available at this time.
                    </p>
                    <div className="mt-4 text-sm text-gray-400">
                      If you expect to see companies here, please check that the HR_emails table contains data.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HrEmailPage;