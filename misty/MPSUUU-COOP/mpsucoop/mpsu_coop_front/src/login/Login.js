
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./login.css";

function Login() {
  const [account_number, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const navigate = useNavigate();

  // Handle countdown timer for lockout
  useEffect(() => {
    let timer;
    if (isLocked && lockoutTime > 0) {
      timer = setInterval(() => {
        setLockoutTime((prev) => prev - 1);
      }, 1000);
    } else if (isLocked && lockoutTime === 0) {
      setIsLocked(false);
      setFailedAttempts(0); // Reset attempts after lockout
      setError("");
    }
    return () => clearInterval(timer);
  }, [isLocked, lockoutTime]);

  const triggerLockout = () => {
    setIsLocked(true);
    setLockoutTime(60); // Lockout duration in seconds
  };

  const handleFailedAttempt = () => {
    setFailedAttempts((prev) => {
      const newAttempts = prev + 1;
      if (newAttempts >= 3) {
        triggerLockout();
      } else {
        setError(`Invalid login. ${3 - newAttempts} attempt(s) remaining.`);
      }
      return newAttempts;
    });
  };

  // 🔑 Unified Login (works for both Admin + Member)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return; // Prevent login attempts during lockout
    setLoading(true);
    const credentials = { username, password };

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        handleFailedAttempt();
        throw new Error(errorData.detail || "Login failed");
      }

      const data = await response.json();
      console.log("Login response:", data);
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("username", data.username);
      localStorage.setItem("userRole", data.role);

      if (data.account_number) {
        localStorage.setItem("account_number", data.account_number);
      }

      console.log("Login successful as", data.role);

      // Redirect based on role
      if (data.role === "admin") {
        navigate("/admin-dashboard");
      } else {
        navigate("/home");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔑 Signup (for members only)
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const signupData = { account_number, email, password };

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signupData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Signup failed");
      }

      setShowSignup(false);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lcontainer">
      <div className="background"></div>
      <div className="login-box">
        <div className="login-container">
          <h1>MPSPC Employees Credit Cooperative</h1>

          {isLocked ? (
            <div className="alert alert-warning">
              Too many failed attempts. Please wait {lockoutTime} seconds.
            </div>
          ) : (
            error && <div className="alert alert-danger">{error}</div>
          )}

          {/* 🔑 Show Signup Form */}
          {showSignup ? (
            <form onSubmit={handleSignupSubmit} className="form">
              <input
                type="text"
                className="form-control"
                placeholder="Account Number"
                value={account_number}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
              />
              <input
                type="email"
                className="form-control"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="form-control"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <div className="alert alert-danger">{error}</div>}
              <button type="submit" className="btn btn-primary">
                {loading ? "Signing up..." : "Sign up"}
              </button>
              <button
                type="button"
                onClick={() => setShowSignup(false)}
                className="btn btn-secondary"
              >
                Back
              </button>
            </form>
          ) : (
            // 🔑 Unified Login Form
            <form onSubmit={handleLoginSubmit} className="form">
              <input
                type="text"
                className="form-control"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="password"
                className="form-control"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {/* <a href="#" onClick={() => navigate("/forgot-password")}>
                Forgot Password?
              </a> */}
              {error && <div className="alert alert-danger">{error}</div>}
              <button type="submit" className="btn btn-primary">
                {loading ? "Logging in..." : "Log in"}
              </button>
              <p>
                Don’t have an account?{" "}
                <a href="#" className="create" onClick={() => setShowSignup(true)}>
                  Create
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
