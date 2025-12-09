import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../login/login.css';

function ResetPassword() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newPassword = e.target.password.value;

    try {
      const response = await fetch(`http://localhost:8000/reset-password/${uid}/${token}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        throw new Error('Password reset failed');
      }

      alert('Password reset successful');
      navigate('/');  
    } catch (err) {
      console.error(err.message);
      alert('Error resetting password');
    }
  };

  return (
    <div className="lcontainer">
      <div className="background"></div>
      <div className="login-box">
        <div className="login-container">
          <h1>MPSU Employees Credit Cooperative</h1>
          <h2>Forgot Password</h2>
          
          <form onSubmit={handleSubmit}>
            <input type="password" name="password" placeholder="Enter new password" required />
            <button type="submit">Reset Password</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
