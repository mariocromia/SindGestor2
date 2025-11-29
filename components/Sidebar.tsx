
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { User, MODULES, PermissionLevel } from '../types';
import { db } from '../services/db';
import {
  Droplets, ClipboardList, FileText, Wrench, Building, LogOut, LayoutDashboard, ChevronsUpDown, ShieldCheck, KeyRound, X
} from 'lucide-react';

interface SidebarProps {
  user: User;
  currentEnterpriseId: string;
  onSwitchEnterprise: (id: string) => void;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onMobileToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  currentEnterpriseId,
  onSwitchEnterprise,
  onLogout,
  isMobileOpen = false,
  onMobileToggle
}) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const location = useLocation();

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (isMobileOpen && onMobileToggle) {
      onMobileToggle();
    }
  }, [location.pathname]);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-slate-800 hover:text-white'
    }`;

  const currentMembership = user.memberships.find(m => m.enterpriseId === currentEnterpriseId);
  const perms = currentMembership?.permissions || {};
  const hasAccess = (module: string) => { const level = perms[module]; return level && level !== PermissionLevel.NONE; };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setPassMsg("Senha deve ter no mínimo 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { setPassMsg("As senhas não conferem."); return; }

    const success = await db.changePassword(user.email, newPassword);
    if (success) {
      setPassMsg("Senha alterada com sucesso!");
      setTimeout(() => { setShowPasswordModal(false); setPassMsg(''); setNewPassword(''); setConfirmPassword(''); }, 1500);
    } else {
      setPassMsg("Erro ao alterar senha.");
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onMobileToggle}
        />
      )}

      {/* Sidebar - Desktop: always visible, Mobile: overlay when open */}
      <aside className={`
      w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col shadow-xl z-50
      transition-transform duration-300 ease-in-out
      ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
        {/* Mobile Close Button */}
        {isMobileOpen && onMobileToggle && (
          <button
            onClick={onMobileToggle}
            className="absolute top-4 right-4 md:hidden bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        )}

        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300 mb-4 px-2">SindGestor</h1>
          <div className="relative group">
            <button className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg p-3 flex items-center justify-between transition-colors">
              <div className="flex flex-col items-start overflow-hidden w-full">
                <span className="text-xs text-slate-400 font-medium mb-1">Condomínio Atual</span>
                <span className="text-sm font-bold text-white w-full text-left whitespace-normal leading-tight" title={currentMembership?.enterpriseName}>
                  {currentMembership?.enterpriseName || 'Selecione...'}
                </span>
              </div>
              <ChevronsUpDown size={16} className="text-slate-400 shrink-0 ml-1" />
            </button>
            <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden hidden group-hover:block z-50">
              {user.memberships.map(m => (
                <button key={m.enterpriseId} onClick={() => onSwitchEnterprise(m.enterpriseId)} className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-700 transition ${m.enterpriseId === currentEnterpriseId ? 'bg-slate-700 text-white font-bold' : 'text-slate-300'}`}>
                  {m.enterpriseName}
                  <span className="block text-[10px] text-slate-500 uppercase">{m.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <NavLink to="/" className={navItemClass} end><LayoutDashboard size={20} /><span>Dashboard</span></NavLink>
          {hasAccess(MODULES.ADMIN_PANEL) && <NavLink to="/admin" className={navItemClass}><ShieldCheck size={20} /><span>Admin Panel</span></NavLink>}
          {hasAccess(MODULES.WATER) && <NavLink to="/water" className={navItemClass}><Droplets size={20} /><span>Água</span></NavLink>}
          {hasAccess(MODULES.TASKS) && <NavLink to="/tasks" className={navItemClass}><ClipboardList size={20} /><span>Tarefas</span></NavLink>}
          {hasAccess(MODULES.EQUIPMENT) && <NavLink to="/equipment" className={navItemClass}><Wrench size={20} /><span>Equipamentos</span></NavLink>}
          {hasAccess(MODULES.STRUCTURAL) && <NavLink to="/structural" className={navItemClass}><Building size={20} /><span>Estrutural</span></NavLink>}
          {hasAccess(MODULES.DOCUMENTS) && <NavLink to="/documents" className={navItemClass}><FileText size={20} /><span>Documentação</span></NavLink>}
        </nav>

        <div className="p-4 border-t border-slate-700 bg-slate-900">
          <div className="px-2 mb-3">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPasswordModal(true)} className="flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition" title="Alterar Senha"><KeyRound size={18} /></button>
            <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg transition"><LogOut size={18} /><span>Sair</span></button>
          </div>
        </div>
      </aside>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800">Alterar Senha</h3><button onClick={() => setShowPasswordModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input type="password" placeholder="Nova Senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 border rounded text-slate-800" />
              <input type="password" placeholder="Confirmar Senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-2 border rounded text-slate-800" />
              {passMsg && <p className={`text-xs ${passMsg.includes('sucesso') ? 'text-green-600' : 'text-red-500'}`}>{passMsg}</p>}
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
