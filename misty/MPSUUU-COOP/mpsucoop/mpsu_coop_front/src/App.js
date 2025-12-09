// import React from 'react';
// import { BrowserRouter as Router, Route, Routes} from 'react-router-dom';
// import ForgotPassword from './member/Forgotpassword';
// import ResetPassword from './member/ResetPassword';
// import AdminDashboard from './admin/AdminDashboard/AdminDashboard';
// import Home from './member/Home/Home';
// import Login from './login/Login';
// import Loans from './member/Loans/Loans'; 
// import PaymentSchedule from './member/PaymentSchedule'; 
// import Payments from './member/Payments'; 
// import Accounts from './member/Account/Account'; 
// import Ledger from './member/Ledger/Ledger'; 
// import Archive from './admin/Archive/Archive';
// function App() {
//   return (
//     <Router>
//       <Routes>
//         {/* Public/General Routes */}
//         <Route path="/" element={<Login />} />
        
        
//         {/* this is for the admin only */}
//         <Route path="/admin-dashboard" element={<AdminDashboard />} />
//           <Route path="/archived-records" component={Archive} />

        
//         {/* Members or individual*/}
//         <Route path="/home" element={<Home />} />
//         <Route path="/forgot-password" element={<ForgotPassword />} />
//         <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
//           <Route path="/loans" element={<Loans />} />
//           <Route path="/payment-schedules/:control_number" element={<PaymentSchedule />} /> 
//           <Route path="/payments/:control_number" element={<Payments />} />
//           <Route path="/accounts" element={<Accounts />} /> 
//           <Route path="/ledger" element={<Ledger />} /> 
        
//       </Routes>
//     </Router>
//   );
// }

// export default App;

import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ForgotPassword from './member/Forgotpassword';
import ResetPassword from './member/ResetPassword';
import AdminDashboard from './admin/AdminDashboard/AdminDashboard';
import Home from './member/Home/Home';
import Login from './login/Login';
import Loans from './member/Loans/Loans';
import PaymentSchedule from './member/PaymentSchedule';
import Payments from './member/Payments/Payments';
import Accounts from './member/Account/Account';
import Info from './member/Info/Info';
import Ledger from './member/Ledger/Ledger';
import Archive from './admin/Archive/Archive';
import Usermgmt from './admin/Usermgmt/Usermgmt';
import ProtectedRoute from './ProtectedRoute';  // Import ProtectedRoute

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />

        {/* Admin-Only Routes */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute role= "admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
          <Route
            path="/archived-records"
            element={
              <ProtectedRoute>
                <Archive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-mgmt"
            element={
              <ProtectedRoute>
                <Usermgmt />
              </ProtectedRoute>
            }
          />

        {/* Member-Only Routes */}
        <Route
          path="/home"
          element={
            <ProtectedRoute role = "member">
              <Home />
            </ProtectedRoute>
          }
        />
          <Route
            path="/loans"
            element={
              <ProtectedRoute>
                <Loans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment-schedules/:control_number"
            element={
              <ProtectedRoute>
                <PaymentSchedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments/"
            element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedRoute>
                <Accounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/infos"
            element={
              <ProtectedRoute>
                <Info />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ledger"
            element={
              <ProtectedRoute>
                <Ledger />
              </ProtectedRoute>
            }
          />
      </Routes>
    </Router>
  );
}

export default App;