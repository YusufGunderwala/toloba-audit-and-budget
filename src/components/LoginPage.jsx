import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Fetch user role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    if (roleError || !roleData) {
      console.error("Role fetch error:", roleError, data.user.id);
      setError(`Login failed: ${roleError?.message || 'No role assigned for ID: ' + data.user.id}`);
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    onLogin(data.user, roleData);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-toloba relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-fatemi-pattern bg-repeat opacity-[0.05] pointer-events-none"></div>
      
      {/* Decorative circles */}
      <div className="absolute top-[-200px] right-[-200px] w-[500px] h-[500px] bg-white/5 rounded-full"></div>
      <div className="absolute bottom-[-150px] left-[-150px] w-[400px] h-[400px] bg-white/5 rounded-full"></div>
      
      <div className="relative z-10 w-full max-w-md px-4 py-6 sm:py-8">
        {/* Logo & Title */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-20 h-20 sm:w-28 sm:h-28 mx-auto mb-3.5 sm:mb-6 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/20 bg-white flex items-center justify-center p-2">
            <img src="/TolobaLogoAnand.png" alt="Toloba Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-wide leading-tight">TOLOBA UL KULLIYAAT IL MUMINOON</h1>
          <p className="text-toloba-light/80 text-xs sm:text-sm mt-1.5 font-medium uppercase tracking-wider">Anand Treasury Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 sm:p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">Sign In</h2>
          
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-sm px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-white/50 focus:ring-2 focus:ring-white/20 outline-none transition-all"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required
                  className="w-full pl-4 pr-12 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-white/50 focus:ring-2 focus:ring-white/20 outline-none transition-all"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-white text-toloba-dark font-bold rounded-lg shadow-lg hover:bg-toloba-light transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">Toloba Treasury Portal v2.0</p>
      </div>
    </div>
  );
}
