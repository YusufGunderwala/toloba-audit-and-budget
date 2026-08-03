import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

import { Toaster } from 'react-hot-toast';

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkSession = async () => {
      const minWait = new Promise(resolve => setTimeout(resolve, 2500)); // Minimum 2.5s wait for logo animation

      const authTask = (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Fetch user role
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
          
          if (roleData) {
            setUser(session.user);
            setUserRole(roleData);
          } else {
            // User exists but no role assigned - sign them out
            await supabase.auth.signOut();
          }
        }
      })();

      await Promise.all([minWait, authTask]);
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserRole(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogin = (userData, roleData) => {
    setUser(userData);
    setUserRole(roleData);
  };

  const handleLogout = () => {
    setUser(null);
    setUserRole(null);
  };

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-toloba/15 rounded-full blur-[80px] pointer-events-none"></div>
        
        <div className="text-center relative z-10 flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-toloba/10 rounded-full blur-xl animate-pulse"></div>
            <img 
              src="/TolobaLogoAnand-transparent.png" 
              alt="Toloba Logo" 
              className="w-48 h-48 object-contain animate-logo-zoom relative z-10 drop-shadow-xl" 
            />
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-toloba rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-toloba rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-toloba rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-toloba-dark font-medium mt-4 tracking-widest text-sm uppercase">Loading</p>
        </div>
      </div>
    );
  }

  // If not logged in, show login page
  if (!user || !userRole) {
    return (
      <>
        <Toaster position="bottom-right" toastOptions={{ className: 'text-sm font-medium shadow-xl' }} />
        <LoginPage onLogin={handleLogin} />
      </>
    );
  }

  // If logged in, show dashboard with role-based access
  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ className: 'text-sm font-medium shadow-xl' }} />
      <Dashboard user={user} userRole={userRole} onLogout={handleLogout} />
    </>
  );
}

export default App;
