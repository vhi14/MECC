import React from 'react';
import { Navigate } from "react-router-dom";


const ProtectedRoute = ({ children, role }) => {
    const token = localStorage.getItem('accessToken');
    const userRole = localStorage.getItem('userRole');  // Assume 'admin' or 'member'
  
    if (!token) {
      return <Navigate to="/" replace />;
    }
  
    if (role && userRole !== role) {
      return <Navigate to="/home" replace />;  // Redirect if the role doesn't match
    }
  
    return children;
  };
  

export default ProtectedRoute;
