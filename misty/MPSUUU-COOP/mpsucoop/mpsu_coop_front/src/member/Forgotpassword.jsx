import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../login/login.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Email sent:", email); // Debug email
  
    try {
      const response = await fetch('http://localhost:8000/forgot-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }), // Ensure the 'email' is correctly passed here
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }
  
      const data = await response.json();
      setMessage(data.message);
      setEmail('');
  
      // Ensure that both uid and token are available
      const { uid, token } = data;
      if (uid && token) {
        // Navigate to reset password page with token
        navigate(`/reset-password/${uid}/${token}`);
      } else {
        throw new Error('Invalid response: Missing uid or token');
      }
    } catch (err) {
      setError(err.message);
    }
  };
  
  

  return (
    <div className="lcontainer">
      <div className="background"></div>
      <div className="login-box">
        <div className="login-container">
          <h1>MPSU Employees Credit Cooperative</h1>
          <h2>Forgot Password</h2>

          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit} className="form">
            <input
              type="email"
              className="form-control"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary">
              Submit
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-secondary"
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
