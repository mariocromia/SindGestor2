import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Membership, AuditLog, UserRole } from '../types';
import { Download, Database, Settings, Activity, CheckSquare, Droplets, Wrench, Users, Clock, Shield, Lock, Save } from 'lucide-react';

interface DashboardProps {
  currentEnterprise: Membership;
  migrationSql: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentEnterprise, migrationSql }) => {
  const [stats, setStats] = useState({
    pendingTasks: 0,
    waterReadings: 0,
    equipmentCount: 0,
    connected: false
  });
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Settings State
  const [waterLimit, setWaterLimit] = useState(50);
  const [savingSettings, setSavingSettings] = useState(false);

  // Filter states
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdmin = currentEnterprise.role === UserRole.ADMIN;

  useEffect(() => {
    if (currentEnterprise && isAdmin) {
      db.getDashboardStats(currentEnterprise.enterpriseId).then(setStats);
      db.getEnterpriseUsers(currentEnterprise.enterpriseId).then(setUsers);
      db.getEnterpriseSettings(currentEnterprise.enterpriseId).then(settings => {
        if (settings.waterLimit) setWaterLimit(settings.waterLimit);
      });
      fetchLogs();
    }
  }, [currentEnterprise, isAdmin]);

  const fetchLogs = async () => {
    const filters = {
      user: userFilter,
      action: actionFilter,
      startDate: startDate,
      endDate: endDate
    };
    const data = await db.getAuditLogs(currentEnterprise.enterpriseId, filters);
    setLogs(data);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await db.updateEnterpriseSettings(currentEnterprise.enterpriseId, currentEnterprise.userEmail || 'admin', { waterLimit: Number(waterLimit) });
    setSavingSettings(false);
    alert("Configurações salvas com sucesso!");
  };

  const handleDownloadSql = () => {
    const blob = new Blob([migrationSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sindgestor_v10_migration.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearFilters = () => {
    setUserFilter('');
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    if (isAdmin) db.getAuditLogs(currentEnterprise.enterpriseId).then(setLogs);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-fade-in">
        <div className="bg-blue-50 p-6 rounded-full">
          <Shield size={64} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Bem-vindo ao SindGestor</h2>
          <p className="text-slate-500 mt-2 text-lg">Você está conectado ao <b>{currentEnterprise.enterpriseName}</b>.</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-md">
          <h3 className="font-bold text-slate-700 mb-2">Acesso Restrito</h3>
          <p className="text-sm text-slate-500">O painel de estatísticas e auditoria é exclusivo para administradores. Utilize o menu lateral para acessar suas tarefas e módulos permitidos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-slate-800 pl-14 md:pl-0">Visão Geral</h2>
          <p className="text-slate-500 text-sm">Condomínio: <span className="font-semibold text-blue-600">{currentEnterprise.enterpriseName}</span></p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${stats.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <div className={`w-2 h-2 rounded-full ${stats.connected ? 'bg-green-600' : 'bg-red-600'}`}></div>
          {stats.connected ? 'Sistema Online' : 'Desconectado'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <CheckSquare size={24} />
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">Tarefas Pendentes</h3>
            <p className="text-2xl font-bold text-slate-800">{stats.pendingTasks}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Droplets size={24} />
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">Leituras (Total)</h3>
            <p className="text-2xl font-bold text-slate-800">{stats.waterReadings}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <Wrench size={24} />
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">Equipamentos</h3>
            <p className="text-2xl font-bold text-slate-800">{stats.equipmentCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">Usuários Ativos</h3>
            <p className="text-2xl font-bold text-slate-800">{users.length}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Settings & User List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[400px]">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users size={18} className="text-blue-600" /> Membros do Condomínio
            </h3>
            <div className="overflow-y-auto flex-1 space-y-3">
              {users.map((u, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{u.userName}</p>
                    <p className="text-xs text-slate-500">{u.userEmail}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}`}>
                    {u.role === UserRole.ADMIN ? 'Admin' : 'Staff'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Settings size={18} className="text-slate-600" /> Configurações de Alertas
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limite de Consumo de Água (m³)</label>
                <input
                  type="number"
                  value={waterLimit}
                  onChange={e => setWaterLimit(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-slate-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">Acima deste valor, os usuários configurados receberão e-mail.</p>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full bg-slate-700 text-white text-sm py-2 rounded-lg hover:bg-slate-800 transition flex items-center justify-center gap-2"
              >
                <Save size={16} /> {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        </div>

        {/* Audit Log */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[600px]">
          <div className="flex flex-col gap-4 mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock size={18} className="text-blue-600" /> Auditoria e Logs do Sistema
            </h3>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <input
                type="text"
                placeholder="Filtrar Usuário (email)..."
                className="text-xs p-2 rounded border border-slate-200"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              />
              <select
                className="text-xs p-2 rounded border border-slate-200"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="">Todas Ações</option>
                <option value="LOGIN">Login</option>
                <option value="CRIAR_TAREFA">Criar Tarefa</option>
                <option value="ATUALIZAR_TAREFA">Atualizar Tarefa</option>
                <option value="REGISTRAR_LEITURA">Registrar Leitura</option>
              </select>
              <input
                type="date"
                className="text-xs p-2 rounded border border-slate-200"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                className="text-xs p-2 rounded border border-slate-200"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button
                onClick={fetchLogs}
                className="bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700"
              >
                Filtrar
              </button>
              <button
                onClick={handleClearFilters}
                className="bg-white text-slate-600 border border-slate-200 text-xs px-3 py-2 rounded hover:bg-slate-50"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-medium sticky top-0">
                <tr>
                  <th className="px-4 py-2">Data/Hora</th>
                  <th className="px-4 py-2">Usuário</th>
                  <th className="px-4 py-2">Ação</th>
                  <th className="px-4 py-2">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {log.userEmail.split('@')[0]}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded whitespace-nowrap">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600 text-xs break-words" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">Nenhuma atividade encontrada com os filtros atuais.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Config Card */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-white mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-700 rounded-lg">
            <Settings size={20} className="text-cyan-400" />
          </div>
          <h3 className="text-lg font-bold">Atualização do Banco de Dados</h3>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          Para habilitar a auditoria, permissões granulares e notificações, execute o script de migração atualizado no Supabase.
        </p>
        <button
          onClick={handleDownloadSql}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition"
        >
          <Download size={20} />
          <Database size={20} />
          Baixar Script de Migração (V10)
        </button>
      </div>
    </div>
  );
};