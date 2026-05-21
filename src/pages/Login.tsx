import { useState, FormEvent, useEffect } from 'react';
import { Factory, Lock, Mail, AlertCircle, Eye, EyeOff, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// DEMO MODE: Set to true to skip Supabase authentication for development
const DEMO_MODE = true;

export default function Login() {
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Auto-login in demo mode
  useEffect(() => {
    if (DEMO_MODE && !loading && !user) {
      // Auto-login with demo credentials
      signIn('admin@factory.com', 'demo123');
    }
  }, [loading, user, signIn]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
  }

  if (DEMO_MODE && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Zap size={48} className="text-amber-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white font-semibold">Starting Demo Mode...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, #94a3b8 39px, #94a3b8 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #94a3b8 39px, #94a3b8 40px)`
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Factory size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WMS Validator</h1>
          <p className="text-slate-400 text-sm mt-1">SAP Business One Integration Layer</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">Sign in to your account</h2>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to access the dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="admin@factory.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertCircle size={15} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm rounded-lg transition-colors shadow-sm mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Access restricted to authorized WMS personnel only.<br />
              Contact your system administrator for credentials.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          WMS Validator v1.0 &nbsp;·&nbsp; SAP B1 Integration &nbsp;·&nbsp; Industrial IoT
        </p>
      </div>
    </div>
  );
}
