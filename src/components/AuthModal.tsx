/**
 * Sky Hopper - Pilot Authentication Modal (Login & Registration)
 * Enables players to create real user accounts, log in, manage persistent cloud profiles,
 * and compete under their true national colors.
 */

import React, { useState } from 'react';
import {
  Lock,
  User,
  Mail,
  X,
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { leaderboardClient } from '../services/leaderboardClient';
import { COUNTRIES_LIST } from '../../server/src/utils/countries';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        if (!identifier.trim() || !password) {
          setError('Please provide your username/email and password.');
          setLoading(false);
          return;
        }
        await leaderboardClient.login({
          loginIdentifier: identifier.trim(),
          password,
        });
        onSuccess('Welcome back, Commander! Session verified.');
        onClose();
      } else {
        if (!username.trim() || !email.trim() || !password) {
          setError('All registration fields are required.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        await leaderboardClient.register({
          username: username.trim(),
          email: email.trim(),
          password,
          countryCode,
        });
        onSuccess('Account registered! Your cloud dossier is live.');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 pointer-events-auto animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-slate-900/95 border border-sky-500/30 rounded-2xl p-5 shadow-2xl relative flex flex-col text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Auth"
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-sky-400 uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>PILOT HQ ACCESS</span>
        </div>

        <h3 className="text-2xl font-black text-white font-['Outfit'] mb-2">
          {mode === 'LOGIN' ? 'Pilot Login' : 'Register Callsign'}
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          {mode === 'LOGIN'
            ? 'Sign in to access your persistent cloud profile, personal bests, and world standings.'
            : 'Create a permanent pilot account to compete on the global and national leaderboards.'}
        </p>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl mb-4 border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'LOGIN'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'REGISTER'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-2.5 mb-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'REGISTER' ? (
            <>
              {/* Callsign / Username */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  Callsign / Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Maverick"
                    maxLength={30}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pilot@example.com"
                    maxLength={100}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  Password (min 6 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Country Selection */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  Country of Allegiance
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                >
                  {COUNTRIES_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Login identifier */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Username or email"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : mode === 'LOGIN' ? (
              <LogIn className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{loading ? 'Authenticating...' : mode === 'LOGIN' ? 'Sign In to Sky Hopper' : 'Create Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
