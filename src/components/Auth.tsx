import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Logo } from './Logo';
import { Eye, EyeOff, Lock, User, ShieldQuestion, CheckCircle2 } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (token: string, username: string) => void;
}

export function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Common fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Signup extra fields
  const [securityQuestion, setSecurityQuestion] = useState('What was the name of your first pet?');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Forgot Password fields
  const [forgotStep, setForgotStep] = useState(1); // 1 = username check, 2 = answer & reset
  const [fetchedQuestion, setFetchedQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const resetAllStates = () => {
    setError('');
    setPassword('');
    setSecurityAnswer('');
    setForgotAnswer('');
    setNewPassword('');
    setForgotStep(1);
    setFetchedQuestion('');
    setResetSuccess(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim() || !password || !securityAnswer.trim()) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          securityQuestion,
          securityAnswer
        })
      });

      const data = await res.json();
      if (res.ok) {
        onAuthSuccess(data.token, data.username);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim() || !password) {
      setError('Username and password are required');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok) {
        onAuthSuccess(data.token, data.username);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim()) {
      setError('Username is required');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/auth/security-question/${username.trim().toLowerCase()}`);
      const data = await res.json();
      if (res.ok) {
        setFetchedQuestion(data.securityQuestion);
        setForgotStep(2);
      } else {
        setError(data.error || 'User not found');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!forgotAnswer.trim() || !newPassword) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          securityAnswer: forgotAnswer,
          newPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        setResetSuccess(true);
      } else {
        setError(data.error || 'Incorrect security answer');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#f2f6f5] px-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-2xl border border-teal-50 shadow-md"
      >
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-12 h-12" textClassName="text-2xl font-bold" />
          <p className="text-sm text-slate-500 mt-1">
            {isForgotPassword 
              ? 'Reset Account Password' 
              : isLogin 
                ? 'Welcome back to clean productivity' 
                : 'Create your secure account'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg p-3 mb-4 font-medium">
            {error}
          </div>
        )}

        {isForgotPassword ? (
          <div>
            {resetSuccess ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-teal-950">Password Updated</h3>
                <p className="text-xs text-slate-500 mt-1">You can now login with your new credentials.</p>
                <button
                  onClick={() => {
                    setIsForgotPassword(false);
                    setIsLogin(true);
                    resetAllStates();
                  }}
                  className="mt-6 w-full bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 px-4 rounded-lg font-medium transition"
                >
                  Back to Login
                </button>
              </div>
            ) : forgotStep === 1 ? (
              <form onSubmit={handleFetchSecurityQuestion} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm py-2 px-4 rounded-lg font-medium transition"
                >
                  {loading ? 'Verifying...' : 'Get Security Question'}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      resetAllStates();
                    }}
                    className="text-xs text-teal-700 hover:text-teal-800 font-medium"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2">
                  <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">Security Question</span>
                  <p className="text-xs font-medium text-slate-800">{fetchedQuestion}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Your Answer</label>
                  <div className="relative">
                    <ShieldQuestion className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Answer to security question"
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm py-2 px-4 rounded-lg font-medium transition"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      resetAllStates();
                    }}
                    className="text-xs text-teal-700 hover:text-teal-800 font-medium"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    resetAllStates();
                  }}
                  className="text-[10px] text-teal-700 hover:text-teal-800 font-bold uppercase tracking-wide"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm py-2 px-4 rounded-lg font-medium transition"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>

            <div className="text-center mt-6 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">Don't have an account? </span>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  resetAllStates();
                }}
                className="text-xs text-teal-700 hover:text-teal-800 font-bold"
              >
                Sign Up
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Pick Username</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="At least 3 characters"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Choose Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Security Question (For Recovery)</label>
              <select
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition mb-3"
              >
                <option>What was the name of your first pet?</option>
                <option>What is your mother's maiden name?</option>
                <option>What was the name of your first school?</option>
                <option>In what city were you born?</option>
              </select>

              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Your Answer</label>
              <div className="relative">
                <ShieldQuestion className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Answer is case-insensitive"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm py-2 px-4 rounded-lg font-medium transition mt-2"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>

            <div className="text-center mt-6 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">Already have an account? </span>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  resetAllStates();
                }}
                className="text-xs text-teal-700 hover:text-teal-800 font-bold"
              >
                Sign In
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
