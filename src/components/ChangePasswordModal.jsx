import React, { useState } from 'react';
import { KeyRound, X, CheckCircle2, Lock, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAuditEvent } from '../lib/auditLogger';

export default function ChangePasswordModal({ user, onClose }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      await logAuditEvent(user, 'CHANGE_PASSWORD', 'User updated account password');
      setSuccess('Password changed successfully! Use your new password on next sign in.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-toloba/10 text-toloba-dark rounded-xl flex items-center justify-center font-bold">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Change Account Password</h3>
              <p className="text-xs text-slate-400">Update security credentials for {user?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl mb-4 font-medium">
            <AlertTriangle size={14} className="inline mr-1" /> {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl mb-4 font-semibold">
            <CheckCircle size={14} className="inline mr-1" /> {success}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">New Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                minLength={6}
                className="input-field pl-10 pr-10 text-sm font-mono" 
                placeholder="At least 6 characters" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                minLength={6}
                className="input-field pl-10 text-sm font-mono" 
                placeholder="Re-enter new password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="w-2/3 btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
