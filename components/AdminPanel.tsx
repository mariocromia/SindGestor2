import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Membership, UserRole, MODULES, PermissionLevel } from '../types';
import { ShieldCheck, UserPlus, Check, X, Shield, AlertCircle, Pencil, Trash2, Users, Lock, Bell } from 'lucide-react';

interface AdminPanelProps {
  currentEnterprise: Membership;
}

const MODULE_TRANSLATIONS: Record<string, string> = {
  [MODULES.WATER]: 'Controle de Água',
  [MODULES.TASKS]: 'Gestão de Tarefas',
  [MODULES.EQUIPMENT]: 'Equipamentos e Manutenção',
  [MODULES.DOCUMENTS]: 'Documentos e Arquivos',
  [MODULES.SUPPLIERS]: 'Fornecedores',
  [MODULES.STRUCTURAL]: 'Manutenção Estrutural',
  [MODULES.ADMIN_PANEL]: 'Acesso Administrativo'
};

const DEFAULT_PERMISSIONS = {
  [MODULES.WATER]: PermissionLevel.READ_ONLY,
  [MODULES.TASKS]: PermissionLevel.READ_WRITE,
  [MODULES.EQUIPMENT]: PermissionLevel.READ_ONLY,
  [MODULES.DOCUMENTS]: PermissionLevel.READ_ONLY,
  [MODULES.SUPPLIERS]: PermissionLevel.READ_ONLY,
  [MODULES.STRUCTURAL]: PermissionLevel.NONE,
  [MODULES.ADMIN_PANEL]: PermissionLevel.NONE
};

const DEFAULT_NOTIFICATIONS = {
  [MODULES.WATER]: false,
  [MODULES.TASKS]: true,
  [MODULES.EQUIPMENT]: false,
  [MODULES.DOCUMENTS]: false,
  [MODULES.SUPPLIERS]: false,
  [MODULES.STRUCTURAL]: false,
  [MODULES.ADMIN_PANEL]: false
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentEnterprise }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: UserRole.STAFF,
    password: ''
  });
  
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>(DEFAULT_PERMISSIONS);
  const [notifications, setNotifications] = useState<Record<string, boolean>>(DEFAULT_NOTIFICATIONS);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchUsers = async () => {
    const data = await db.getEnterpriseUsers(currentEnterprise.enterpriseId);
    setUsers(data);
  };

  useEffect(() => { fetchUsers(); }, [currentEnterprise.enterpriseId]);

  const handlePermissionChange = (module: string, level: PermissionLevel) => {
    setPermissions(prev => ({ ...prev, [module]: level }));
  };

  const handleNotificationChange = (module: string) => {
    setNotifications(prev => ({ ...prev, [module]: !prev[module] }));
  };

  const handleRoleChange = (role: UserRole) => {
    setNewUser({...newUser, role});
    if (role === UserRole.ADMIN) {
      const adminPerms: any = {};
      Object.values(MODULES).forEach(m => adminPerms[m] = PermissionLevel.FULL_ACCESS);
      setPermissions(adminPerms);
    } else {
      setPermissions(DEFAULT_PERMISSIONS);
    }
  };

  const handleEditClick = (user: any) => {
    setNewUser({
      name: user.userName,
      email: user.userEmail,
      role: user.role,
      password: '' // Reset password field for editing
    });
    setPermissions(user.permissions || DEFAULT_PERMISSIONS);
    setNotifications(user.notifications || DEFAULT_NOTIFICATIONS);
    setEditingUser(user.userEmail);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewUser({ name: '', email: '', role: UserRole.STAFF, password: '' });
    setPermissions(DEFAULT_PERMISSIONS);
    setNotifications(DEFAULT_NOTIFICATIONS);
  };

  const handleDeleteClick = (userEmail: string) => {
    setUserToDelete(userEmail);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      await db.deleteMember(currentEnterprise.enterpriseId, currentEnterprise.userEmail || 'admin', userToDelete);
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim()) return;

    setLoading(true);
    
    if (editingUser) {
      // Update Mode
      await db.updateMember(
        currentEnterprise.enterpriseId,
        currentEnterprise.userEmail || 'admin',
        newUser.email,
        newUser.name,
        newUser.role,
        permissions,
        notifications,
        newUser.password || undefined
      );
    } else {
      // Create Mode
      if (!newUser.password) {
        alert("Senha inicial é obrigatória para cadastro.");
        setLoading(false);
        return;
      }
      await db.registerMember(
        currentEnterprise.enterpriseId,
        currentEnterprise.userEmail || 'admin',
        newUser.email.trim().toLowerCase(),
        newUser.name,
        newUser.role,
        permissions,
        notifications,
        newUser.password
      );
    }
    
    setLoading(false);
    setSuccess(true);
    handleCancelEdit();
    fetchUsers();
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in relative">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Painel Administrativo</h2>
          <p className="text-slate-500">Gestão de Usuários - <span className="font-semibold text-blue-600">{currentEnterprise.enterpriseName}</span></p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {editingUser ? <Pencil size={20} className="text-blue-600"/> : <UserPlus size={20} className="text-blue-600"/>} 
            {editingUser ? 'Editar Usuário e Permissões' : 'Cadastrar Novo Usuário'}
          </h3>
          {editingUser && <button onClick={handleCancelEdit} className="text-sm text-slate-500 underline">Cancelar Edição</button>}
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 border border-green-100">
            <Check size={20} /> Operação realizada com sucesso!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
              <input type="text" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-3 border rounded-lg" placeholder="Ex: Colaborador"/>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail *</label>
              <input type="email" required disabled={!!editingUser} value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className={`w-full p-3 border rounded-lg ${editingUser ? 'bg-slate-100 cursor-not-allowed' : ''}`} placeholder="Ex: emailcolaborador@gmail.com"/>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Lock size={14} /> {editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha Inicial *'}
              </label>
              <input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-3 border rounded-lg" placeholder="••••••"/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Perfil Base</label>
            <div className="flex gap-4">
              <label className={`flex-1 border p-4 rounded-lg cursor-pointer transition ${newUser.role === UserRole.STAFF ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="role" className="hidden" checked={newUser.role === UserRole.STAFF} onChange={() => handleRoleChange(UserRole.STAFF)} />
                <div className="font-bold text-slate-800">Colaborador</div>
              </label>
              <label className={`flex-1 border p-4 rounded-lg cursor-pointer transition ${newUser.role === UserRole.ADMIN ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="role" className="hidden" checked={newUser.role === UserRole.ADMIN} onChange={() => handleRoleChange(UserRole.ADMIN)} />
                <div className="font-bold text-slate-800">Administrador</div>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
             <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 mb-4 flex gap-2"><AlertCircle size={16} /><p>Defina o nível de acesso e ative notificações por e-mail.</p></div>
             <div className="overflow-x-auto border border-slate-200 rounded-lg">
               <table className="w-full text-sm text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-50 border-b">
                     <th className="p-3 w-1/3">Módulo</th>
                     <th className="p-3 text-center">Bloqueado</th>
                     <th className="p-3 text-center">Ver</th>
                     <th className="p-3 text-center">Operar</th>
                     <th className="p-3 text-center">Total</th>
                     <th className="p-3 text-center bg-yellow-50 text-yellow-800 border-l"><div className="flex items-center justify-center gap-1"><Bell size={14}/> Avisos</div></th>
                   </tr>
                 </thead>
                 <tbody>
                   {Object.entries(MODULES).map(([key, moduleKey]) => {
                     if (moduleKey === MODULES.ADMIN_PANEL && newUser.role !== UserRole.ADMIN) return null;
                     const currentLevel = permissions[moduleKey] || PermissionLevel.NONE;
                     const notifEnabled = notifications[moduleKey] || false;
                     return (
                       <tr key={moduleKey} className="border-b hover:bg-slate-50">
                         <td className="p-3 font-medium">{MODULE_TRANSLATIONS[moduleKey] || moduleKey}</td>
                         <td className="p-3 text-center"><input type="radio" name={`perm_${moduleKey}`} checked={currentLevel === PermissionLevel.NONE} onChange={() => handlePermissionChange(moduleKey, PermissionLevel.NONE)} className="cursor-pointer"/></td>
                         <td className="p-3 text-center"><input type="radio" name={`perm_${moduleKey}`} checked={currentLevel === PermissionLevel.READ_ONLY} onChange={() => handlePermissionChange(moduleKey, PermissionLevel.READ_ONLY)} className="cursor-pointer"/></td>
                         <td className="p-3 text-center"><input type="radio" name={`perm_${moduleKey}`} checked={currentLevel === PermissionLevel.READ_WRITE} onChange={() => handlePermissionChange(moduleKey, PermissionLevel.READ_WRITE)} className="cursor-pointer"/></td>
                         <td className="p-3 text-center"><input type="radio" name={`perm_${moduleKey}`} checked={currentLevel === PermissionLevel.FULL_ACCESS} onChange={() => handlePermissionChange(moduleKey, PermissionLevel.FULL_ACCESS)} className="cursor-pointer"/></td>
                         <td className="p-3 text-center border-l bg-yellow-50/30">
                           <input type="checkbox" checked={notifEnabled} onChange={() => handleNotificationChange(moduleKey)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"/>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          </div>

          <button type="submit" disabled={loading} className={`w-full text-white font-bold py-3 rounded-lg transition shadow-md disabled:opacity-70 ${editingUser ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loading ? 'Processando...' : (editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário')}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-6 border-b flex items-center justify-between"><h3 className="text-lg font-bold">Usuários Cadastrados</h3></div>
         <table className="w-full text-left">
           <thead className="bg-slate-50 text-xs uppercase font-medium"><tr><th className="px-6 py-3">Nome</th><th className="px-6 py-3">E-mail</th><th className="px-6 py-3">Perfil</th><th className="px-6 py-3 text-right">Ações</th></tr></thead>
           <tbody className="divide-y divide-slate-100">
             {users.map((u, i) => (
               <tr key={i} className="hover:bg-slate-50">
                 <td className="px-6 py-4 font-medium">{u.userName}</td>
                 <td className="px-6 py-4 text-sm">{u.userEmail}</td>
                 <td className="px-6 py-4"><span className="text-[10px] px-2 py-1 rounded-full bg-slate-200">{u.role}</span></td>
                 <td className="px-6 py-4 text-right flex justify-end gap-2">
                   <button onClick={() => handleEditClick(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Pencil size={18} /></button>
                   {u.userEmail !== (currentEnterprise.userEmail || 'admin') && <button onClick={() => handleDeleteClick(u.userEmail)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm">
             <h3 className="text-lg font-bold text-red-600 mb-4">Excluir Usuário?</h3>
             <p className="mb-6">Confirma a exclusão de <b>{userToDelete}</b>?</p>
             <div className="flex gap-3 justify-end"><button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border rounded">Cancelar</button><button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded">Excluir</button></div>
          </div>
        </div>
      )}
    </div>
  );
};