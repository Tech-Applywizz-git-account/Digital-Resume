// import React from 'react';
// import { Routes, Route } from 'react-router-dom';
// import { AuthProvider } from './contexts/AuthContext';
// import Landing from './pages/landing';
// import Auth from './pages/Auth';
// import Dashboard from './pages/Dashboard';
// import Step1 from './pages/Step1';
// import Step2 from './pages/Step2';
// import Step3 from './pages/Step3';
// import Record from './pages/Record';
// import FinalResult from './pages/FinalResult';
// import Network from './pages/Network';
// import Resources from './pages/Resources';
// import Profile from './pages/Profile';
// import Billing from './pages/Billing';
// import Password from './pages/Password';
// import Contact from './pages/Contact';
// import HrEmail from './pages/hr_email';
// import HrEmailDetails from './pages/HrEmailDetails';
// import Home from './pages/home';

// function App() {
//   return (
//     <AuthProvider>
//       <Routes>
//         {/* Serve home.html as the first page */}
//         <Route
//           path="/"
//           element={
//             <iframe
//               src="/home1.html"
//               title="Home Page"
//               width="100%"
//               height="100%"
//               style={{ border: 'none', height: '100vh' }}
//             />
//           }
//         />

//         {/* Alternative: Use the React Home component */}
//         {/* <Route path="/" element={<Home />} /> */}

//         {/* React Routes for other pages */}
//         <Route path="/landing" element={<Landing />} />
//         <Route path="/auth" element={<Auth />} />
//         <Route path="/dashboard" element={<Dashboard />} />
//         <Route path="/step1" element={<Step1 />} />
//         <Route path="/step2" element={<Step2 />} />
//         <Route path="/step3" element={<Step3 />} />
//         <Route path="/record" element={<Record />} />
//         <Route path="/record/:id" element={<Record />} />
//         <Route path="/network" element={<Network />} />
//         <Route path="/final-result/:castId?" element={<FinalResult />} />
//         <Route path="/resources" element={<Resources />} />
//         <Route path="/profile" element={<Profile />} />
//         <Route path="/billing" element={<Billing />} />
//         <Route path="/password" element={<Password />} />
//         <Route path="/contact" element={<Contact />} />
//         <Route path="/hr-email" element={<HrEmail />} />
//         <Route path="/hr-email-details" element={<HrEmailDetails />} />
//       </Routes>
//     </AuthProvider>
//   );
// }

// export default App;


import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Landing from './pages/landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Step1 from './pages/Step1';
import Step2 from './pages/Step2';
import Step3 from './pages/Step3';
import Record from './pages/Record';
import FinalResult from './pages/FinalResult';
import Network from './pages/Network';
import Resources from './pages/Resources';
import Profile from './pages/Profile';
import Billing from './pages/Billing';
import Password from './pages/Password';
import Contact from './pages/Contact';
import HrEmail from './pages/hr_email';
import HrEmailDetails from './pages/HrEmailDetails'; // Ensure the correct capitalization

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/step1" element={<Step1 />} />
        <Route path="/step2" element={<Step2 />} />
        <Route path="/step3" element={<Step3 />} />
        <Route path="/record" element={<Record />} />
        <Route path="/record/:id" element={<Record />} />
        <Route path="/network" element={<Network />} /> {/* Uncomment this route */}
        <Route path="/final-result/:castId?" element={<FinalResult />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/password" element={<Password />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/hr-email" element={<HrEmail />} />
        <Route path="/hr-email-details" element={<HrEmailDetails />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
