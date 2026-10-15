import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import CustomSelect from '../ui/CustomSelect';
import { 
  ShieldCheck, 
  KeyRound, 
  UserCheck, 
  RefreshCw, 
  Copy, 
  Check, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  IndianRupee, 
  Eye as EyeIcon,
  X,
  UserPlus,
  Mail,
  User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';

export default function UserManagementTab({ user, userRole, onRefresh }) {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);

  // Create User State
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [membersList, setMembersList] = useState([]);
  const [newUserForm, setNewUserForm] = useState({
    memberId: '',
    email: '',
    password: '',
    role: 'viewer'
  });

  // Form State
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [rolePrompt, setRolePrompt] = useState({ show: false, user: null, role: '' });

  const isAdmin = userRole?.role === 'super_admin';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsersList(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase.from('members').select('id, name, its_number');
      if (error) throw error;
      setMembersList(data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMembers();
  }, []);

  // Generate secure random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  // Handle Admin Reset Password
  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters!");
      return;
    }

    setLoading(true);
    setStatusMsg('');

    try {
      // Call Postgres RPC function `admin_reset_user_password`
      const { error } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: selectedUserForReset.user_id,
        new_password: newPassword
      });

      if (error) throw error;

      await logAuditEvent(
        user, 
        'ADMIN_RESET_PASSWORD', 
        `Super Admin reset password for ${selectedUserForReset.display_name || selectedUserForReset.user_id}`
      );

      setStatusMsg(`Password successfully reset for ${selectedUserForReset.display_name || 'User'}!`);
    } catch (err) {
      toast.error("Failed to reset password: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (newUserForm.password.length < 6) {
      toast.error("Password must be at least 6 characters!");
      return;
    }
    const selectedMember = membersList.find(m => m.id === newUserForm.memberId);
    if (!selectedMember) {
      toast.error("Please select a member");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('admin_create_user', {
        email: newUserForm.email,
        password: newUserForm.password,
        display_name: selectedMember.name,
        role: newUserForm.role
      });

      if (error) throw error;

      await logAuditEvent(
        user, 
        'ADMIN_CREATE_USER', 
        `Super Admin created a new user account for ${selectedMember.name} (${newUserForm.email})`
      );

      toast.success(`User account for ${selectedMember.name} created successfully!`);
      setShowCreateUser(false);
      setNewUserForm({ memberId: '', email: '', password: '', role: 'viewer' });
      fetchUsers();
    } catch (err) {
      toast.error("Failed to create user: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Role Change
  const handleChangeRole = (targetUser, newRole) => {
    setRolePrompt({ show: true, user: targetUser, role: newRole });
  };

  const confirmChangeRole = async () => {
    const targetUser = rolePrompt.user;
    const newRole = rolePrompt.role;
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('id', targetUser.id);

      if (error) throw error;

      await logAuditEvent(user, 'CHANGE_USER_ROLE', `Changed role of ${targetUser.display_name} to ${newRole}`);
      toast.success(`Role updated to ${newRole}!`);
      fetchUsers();
      onRefresh();
    } catch (err) {
      toast.error("Error updating role: " + err.message);
    } finally {
      setRolePrompt({ show: false, user: null, role: '' });
    }
  };

  const copyCredentials = () => {
    if (!selectedUserForReset || !newPassword) return;
    const text = `Toloba Treasury System Login:\nUser: ${selectedUserForReset.display_name || 'User'}\nNew Password: ${newPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-12 bg-white rounded-2xl border border-slate-200 text-center">
        <ShieldCheck size={48} className="mx-auto text-red-500 mb-3" />
        <h3 className="text-xl font-bold text-slate-800">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">Only Super Admins can access User & Password Management.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck size={20} className="text-toloba flex-shrink-0" /> User Access & Password Manager ({usersList.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Super Admin Control Center: Reset user passwords and assign system roles</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button 
            onClick={() => setShowCreateUser(true)} 
            className="flex-1 sm:flex-none justify-center btn-primary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow"
          >
            <UserPlus size={15} /> <span>Create User</span>
          </button>
          <button 
            onClick={fetchUsers} 
            disabled={loading}
            className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Mobile View: Modern User Cards (No Horizontal Scroll) */}
        <div className="divide-y divide-slate-100 md:hidden">
          {usersList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No users found.</div>
          ) : (
            usersList.map(u => (
              <div key={u.id} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-toloba/10 text-toloba-dark font-bold flex items-center justify-center text-xs flex-shrink-0">
                      {(u.display_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{u.display_name || 'User'}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">ID: {u.user_id ? `${u.user_id.slice(0, 8)}...` : 'N/A'}</p>
                    </div>
                  </div>

                  <div className="w-28 sm:w-32 flex-shrink-0">
                    <CustomSelect 
                      value={u.role} 
                      onChange={e => handleChangeRole(u, e.target.value)}
                      className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border outline-none cursor-pointer ${
                        u.role === 'super_admin' ? 'bg-red-50 text-red-700 border-red-200' :
                        u.role === 'treasurer' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                      options={[
                        { value: 'super_admin', label: 'Super Admin' },
                        { value: 'treasurer', label: 'Treasurer' },
                        { value: 'viewer', label: 'Auditor' }
                      ]}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">Added: {new Date(u.created_at).toLocaleDateString('en-GB')}</span>
                  <button 
                    onClick={() => {
                      setSelectedUserForReset(u);
                      setNewPassword('');
                      setStatusMsg('');
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 transition-all text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 shadow"
                  >
                    <KeyRound size={13} /> Reset Password
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Spreadsheet Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-6 font-semibold">User Display Name</th>
                <th className="py-3.5 px-6 font-semibold">Assigned Role</th>
                <th className="py-3.5 px-6 font-semibold">User ID</th>
                <th className="py-3.5 px-6 font-semibold">Created Date</th>
                <th className="py-3.5 px-6 font-semibold text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersList.length === 0 ? (
                <tr><td colSpan="5" className="py-12 text-center text-slate-400">No users found.</td></tr>
              ) : (
                usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-toloba/10 text-toloba-dark font-bold flex items-center justify-center text-xs">
                        {(u.display_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      {u.display_name || 'User'}
                    </td>
                    <td className="py-4 px-6">
                      <CustomSelect 
                        value={u.role} 
                        onChange={e => handleChangeRole(u, e.target.value)}
                        className={`text-xs font-bold px-3 py-2 rounded-lg border outline-none cursor-pointer ${
                          u.role === 'super_admin' ? 'bg-red-50 text-red-700 border-red-200' :
                          u.role === 'treasurer' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                        options={[
                          { value: 'super_admin', label: 'Super Admin' },
                          { value: 'treasurer', label: 'Treasurer' },
                          { value: 'viewer', label: 'Auditor / Viewer' }
                        ]}
                      />
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-slate-400">{u.user_id}</td>
                    <td className="py-4 px-6 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => {
                          setSelectedUserForReset(u);
                          setNewPassword('');
                          setStatusMsg('');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow"
                      >
                        <KeyRound size={14} /> Reset Password
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== ADMIN PASSWORD RESET MODAL ===== */}
      {selectedUserForReset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-100 text-red-700 rounded-lg flex items-center justify-center">
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Reset User Password</h3>
                  <p className="text-xs text-slate-400">Target User: <span className="font-bold text-slate-700">{selectedUserForReset.display_name || 'User'}</span></p>
                </div>
              </div>
              <button onClick={() => setSelectedUserForReset(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            {statusMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl mb-4 font-semibold flex items-center gap-1.5">
                <Check size={14} /> {statusMsg}
              </div>
            )}

            <form onSubmit={handleAdminResetPassword} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-600">New Password</label>
                  <button 
                    type="button" 
                    onClick={generateRandomPassword}
                    className="text-[11px] font-bold text-toloba hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Generate Random
                  </button>
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required 
                    minLength={6}
                    className="input-field pl-10 pr-10 text-sm font-mono" 
                    placeholder="Enter new password" 
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

              {newPassword && (
                <button 
                  type="button" 
                  onClick={copyCredentials} 
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-slate-200"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Password to Share'}</span>
                </button>
              )}

              <div className="pt-3 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setSelectedUserForReset(null)} 
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-2/3 btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  <UserCheck size={16} />
                  <span>{loading ? 'Resetting...' : 'Set New Password'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ===== ADMIN CREATE USER MODAL ===== */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Create New System User</h3>
                  <p className="text-xs text-slate-400">Generate a new login for a committee member</p>
                </div>
              </div>
              <button onClick={() => setShowCreateUser(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Select Member from Directory</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <CustomSelect 
                    value={newUserForm.memberId}
                    onChange={e => setNewUserForm({...newUserForm, memberId: e.target.value})}
                    options={[{value: '', label: 'Select a Member...'}, ...membersList.map(m => ({ value: m.id, label: `${m.name} (${m.its_number})` }))]}
                    className="pl-9 w-full input-field text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Login Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email" 
                    required 
                    className="input-field pl-10 text-sm" 
                    placeholder="user@example.com" 
                    value={newUserForm.email} 
                    onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-600">Initial Password</label>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required 
                    minLength={6}
                    className="input-field pl-10 pr-10 text-sm font-mono" 
                    placeholder="Min 6 characters" 
                    value={newUserForm.password} 
                    onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} 
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
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">System Role</label>
                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <CustomSelect 
                    value={newUserForm.role}
                    onChange={e => setNewUserForm({...newUserForm, role: e.target.value})}
                    options={[
                      { value: 'viewer', label: 'Auditor / Viewer (Read Only)' },
                      { value: 'treasurer', label: 'Treasurer (Read & Write)' },
                      { value: 'super_admin', label: 'Super Admin (Full Access)' }
                    ]}
                    className="pl-9 w-full input-field text-sm font-bold text-toloba"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowCreateUser(false)} 
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-2/3 btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  <UserPlus size={16} />
                  <span>{loading ? 'Creating...' : 'Create User Account'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ===== ROLE PROMPT MODAL ===== */}
      {rolePrompt.show && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Change User Role</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to change the role of <span className="font-semibold">{rolePrompt.user?.display_name || 'User'}</span> to <span className="font-semibold text-toloba">{rolePrompt.role.toUpperCase()}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRolePrompt({ show: false, user: null, role: '' })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmChangeRole}
                className="px-4 py-2 bg-toloba hover:bg-toloba-dark text-white rounded-lg text-sm font-medium shadow-lg shadow-toloba/30 transition-all"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
