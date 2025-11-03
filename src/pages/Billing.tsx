import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { CreditCard, Check, Download, Calendar, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Billing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    navigate('/');
  };

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '3 CareerCasts per month',
        'Basic video recording',
        'Standard resume upload',
        'Community support'
      ],
      current: true
    },
    {
      name: 'Premium',
      price: '$9',
      period: 'month',
      features: [
        'Unlimited CareerCasts',
        'HD video recording',
        'Advanced analytics',
        'Priority support',
        'Custom branding'
      ],
      current: false
    }
  ];

  const invoices = [
    { id: 'INV-2024-001', date: '2024-01-15', amount: '$9.00', status: 'Paid' },
    { id: 'INV-2023-012', date: '2023-12-15', amount: '$9.00', status: 'Paid' },
    { id: 'INV-2023-011', date: '2023-11-15', amount: '$9.00', status: 'Paid' }
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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Billing & Payment</h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Manage your subscription, payment methods, and billing history
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className={`bg-white rounded-lg sm:rounded-xl shadow-sm border-2 ${
                    plan.current ? 'border-[#01796F]' : 'border-gray-200'
                  } overflow-hidden hover:shadow-lg transition-all duration-300`}
                >
                  {plan.current && (
                    <div className="bg-[#01796F] text-white text-center py-2 text-xs sm:text-sm font-semibold">
                      Current Plan
                    </div>
                  )}
                  <div className="p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="mb-4 sm:mb-6">
                      <span className="text-3xl sm:text-4xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-600 text-sm sm:text-base">/{plan.period}</span>
                    </div>
                    <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#01796F] flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      className={`w-full py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                        plan.current
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'bg-[#01796F] text-white hover:bg-[#016761] shadow-md'
                      }`}
                      disabled={plan.current}
                    >
                      {plan.current ? 'Current Plan' : 'Upgrade'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}