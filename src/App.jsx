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
    let active = true;
    let revision = 0;
    const checkSession = async () => {
      const current = ++revision;
      const isCurrent = () => active && current === revision;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isCurrent()) return;
        if (!session?.user) {
          setUser(null);
          setUserRole(null);
          return;
        }

        const { data: roleData, error: roleError } = await supabase
          .from('user_roles').select('*').eq('user_id', session.user.id).maybeSingle();
        if (!isCurrent()) return;
        if (roleError) throw roleError;
        if (roleData) {
          setUser(session.user);
          setUserRole(roleData);
        } else {
          setUser(null);
          setUserRole(null);
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch (error) {
        console.error('Unable to restore the treasury session:', error.message);
      } finally {
        if (isCurrent()) setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    let authTimer;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      clearTimeout(authTimer);
      if (event === 'SIGNED_OUT') {
        revision += 1;
        setUser(null);
        setUserRole(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        authTimer = setTimeout(checkSession, 0);
      }
    });
    window.addEventListener('focus', checkSession);

    return () => {
      active = false;
      clearTimeout(authTimer);
      window.removeEventListener('focus', checkSession);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = (userData, roleData) => {
    setUser(userData);
    setUserRole(roleData);
  };

  const handleLogout = () => {
    setUser(null);
    setUserRole(null);
  };

  // Keep the HTML startup screen visible while the session is restored.
  if (loading) return null;

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
      <Dashboard key={`${user.id}:${userRole.role}`} user={user} userRole={userRole} onLogout={handleLogout} />
    </>
  );
}

export default App;
