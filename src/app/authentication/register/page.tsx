"use client";

import React, { useState } from "react";
import "../auth.css";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cpu,
  Home,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  UserPlus
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Link } from "react-router-dom";
import { CyberBackground } from "@/components/CyberBackground";

const REGISTER_SIGNALS = [
  { icon: ShieldCheck, label: "PQC Generation", value: "ML-KEM Keypair" },
  { icon: KeyRound, label: "Entropy", value: "QRNG Seeded" },
  { icon: Activity, label: "Identity Sync", value: "Real-Time" }
];

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { signUp, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setIsLoading(false);
      setError("Access key must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setIsLoading(false);
      setError("Access keys do not match.");
      return;
    }

    try {
      const { error } = await signUp(email, password);
      if (error) {
        setIsLoading(false);
        let msg = error.message || "Registration failed.";
        if (msg.includes("already registered")) msg = "This identity is already deployed.";
        setError(msg);
        return;
      }
      setIsLoading(false);
      setSuccessMsg("Identity deployed. Check your email to verify before signing in.");
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "System error. Try again.");
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setIsLoading(false);
        setError("OAuth Error: " + error.message);
        return;
      }
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setError("OAuth Error: " + err.message);
    }
  };

  return (
    <div className="qguard-home qc-page qc-page-gold">
      <CyberBackground />
      <div className="qc-hex-grid" />
      <div className="qc-radial-glow" />

      <header className="qc-auth-nav qc-in-1">
        <Link to="/" className="qc-auth-brand">
          <img
            src="/NEW_LOGO.png"
            alt="Qguard Helix logo"
            className="qc-auth-logo-video"
          />
          <span className="qc-auth-brand-copy">
            <span className="qc-auth-brand-title">Qguard Helix</span>
            <span className="qc-auth-brand-subtitle">Quantum Defense</span>
          </span>
        </Link>

        <div className="qc-auth-nav-actions">
          <Link to="/" className="qc-auth-nav-link">
            <Home size={15} />
            Home
          </Link>
          <Link to="/login" className="qc-auth-nav-cta">
            Login
          </Link>
        </div>
      </header>

      <main className="qc-login-shell">
        <section className="qc-login-hero qc-in-2" aria-labelledby="register-title">
          <div className="qc-login-kicker">
            <span className="qc-status-dot" />
            Identity Provisioning
          </div>
          <h1 id="register-title" className="qc-auth-title">
            Deploy New <span>Identity</span>
          </h1>
          <p className="qc-auth-lede">
            Initialize your quantum credentials to establish a secure node.
            Your keys are generated using post-quantum QRNG entropy.
          </p>

          <div className="qc-signal-grid" aria-label="Identity provisioning security checks">
            {REGISTER_SIGNALS.map((signal) => {
              const SignalIcon = signal.icon;

              return (
                <div key={signal.label} className="qc-signal-card">
                  <SignalIcon size={18} />
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="qc-login-panel" aria-label="Registration form">
          <div className="qc-card qc-in-3">
            <div className="qc-logo-wrap">
              <div className="qc-logo-icon">
                <Shield size={20} />
              </div>
              <span className="qc-logo-text">QGUARD</span>
            </div>

            <p className="qc-protocol-tag">QUANTUM PROTOCOL</p>
            <h2 className="qc-heading">Identity Provisioning</h2>
            <p className="qc-subtitle">
              Initialize quantum credentials for this node.
            </p>

            {error && (
              <div className="qc-alert qc-alert-error">
                <AlertTriangle size={14} className="text-[var(--qg-red)] shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="qc-alert qc-alert-success">
                <ShieldCheck size={14} className="text-[var(--qg-green)] shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="qc-form">
              <div>
                <label className="qc-field-label">Email Address</label>
                <div className="qc-field-wrap">
                  <Mail size={14} className="qc-field-icon" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="qc-input"
                  />
                </div>
              </div>

              <div>
                <label className="qc-field-label">Password</label>
                <div className="qc-field-wrap">
                  <Lock size={14} className="qc-field-icon" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="MIN. 6 CHARACTERS"
                    className="qc-input"
                  />
                </div>
              </div>

              <div>
                <label className="qc-field-label">Confirm Password</label>
                <div className="qc-field-wrap">
                  <Lock size={14} className="qc-field-icon" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="RE-ENTER ACCESS KEY"
                    className="qc-input"
                  />
                </div>
              </div>

              <div className="qc-remember-row" style={{ marginTop: '1rem' }}>
                <span className="text-xs text-muted-foreground">Keys are secured by ML-KEM post-quantum cryptography</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="qc-btn qc-btn-cyan qc-btn-shimmer"
              >
                {isLoading ? (
                  <Cpu size={16} className="animate-spin" />
                ) : (
                  <>Register Credentials <UserPlus size={15} /></>
                )}
              </button>

              <div className="qc-divider">
                <div className="qc-divider-line" />
                <span className="qc-divider-text">or</span>
                <div className="qc-divider-line" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="qc-btn qc-btn-ghost"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <p className="qc-card-footer">
                Existing node?{" "}
                <Link to="/login" className="qc-card-link">
                  Login here
                </Link>
              </p>
            </form>
          </div>

          <div className="qc-status-bar qc-in-4">
            <div className="qc-status-header">
              <span className="qc-status-label">Quantum Sync Status</span>
              <span className="qc-status-percent">100%</span>
            </div>
            <div className="qc-status-track">
              <div className="qc-status-fill-bar" />
            </div>
            <div className="qc-status-indicator">
              <span className="qc-status-dot" />
              <span className="qc-status-text">Encrypted Connection Established</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
