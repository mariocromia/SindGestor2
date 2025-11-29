import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { geminiService } from '../services/geminiService';
import { WaterReading, User, PermissionLevel, MODULES } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Sparkles, Loader2, Plus, X, Save, Trash2, Building2, AlertTriangle, Pencil } from 'lucide-react';

interface WaterConsumptionProps {
  user: User;
  currentEnterpriseId: string;
}

export const WaterConsumption: React.FC<WaterConsumptionProps> = ({ user, currentEnterpriseId }) => {
  const [readings, setReadings] = useState<WaterReading[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<string>("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUnitDeleteModal, setShowUnitDeleteModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [readingToDelete, setReadingToDelete] = useState<string | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<string | null>(null);
  const [newUnitName, setNewUnitName] = useState('');
  const [lastUsedUnit, setLastUsedUnit] = useState<string>('');
  const readingInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    unit: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    reading: ''
  });

  // Check Permissions
  const membership = user.memberships.find(m => m.enterpriseId === currentEnterpriseId);
  const permission = membership?.permissions[MODULES.WATER] || PermissionLevel.NONE;
  const canWrite = permission === PermissionLevel.READ_WRITE || permission === PermissionLevel.FULL_ACCESS;
  const canEdit = permission === PermissionLevel.FULL_ACCESS;

  const fetchData = async () => {
    const data = await db.getWaterReadings(currentEnterpriseId);
    const unitList = await db.getUnits(currentEnterpriseId);
    setReadings(data);
    setUnits(unitList);
  };

  useEffect(() => { fetchData(); }, [currentEnterpriseId]);

  // ... (keeping existing logic helpers mostly same)
  const getLocalDateString = (dateObj: Date) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const processedReadings = useMemo(() => {
    if (readings.length === 0) return [];
    const groups: Record<string, WaterReading[]> = {};
    readings.forEach(r => {
      if (!groups[r.unit]) groups[r.unit] = [];
      groups[r.unit].push(r);
    });
    const result: WaterReading[] = [];
    Object.values(groups).forEach(group => {
      const sorted = group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (sorted.length > 0) sorted[0] = { ...sorted[0], previousReading: sorted[0].reading };
      result.push(...sorted);
    });
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [readings]);

  const handleAnalyze = async () => {
    setLoadingAnalysis(true);
    const result = await geminiService.analyzeWaterConsumption(readings);
    setAnalysis(result);
    setLoadingAnalysis(false);
  };

  const prepareFormForUnit = (unitName: string) => {
    const unitReadings = readings.filter(r => r.unit === unitName);
    let nextDate = getLocalDateString(new Date());
    let nextTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (unitReadings.length > 0) {
      const latest = unitReadings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (latest) {
        const lastDateObj = new Date(latest.date);
        nextTime = lastDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const nextDayDate = new Date(lastDateObj.getFullYear(), lastDateObj.getMonth(), lastDateObj.getDate() + 1, 12, 0, 0);
        nextDate = getLocalDateString(nextDayDate);
      }
    }
    setFormData(prev => ({ ...prev, unit: unitName, date: nextDate, time: nextTime, reading: '' }));
    setTimeout(() => readingInputRef.current?.focus(), 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'unit' && !editingId) prepareFormForUnit(value);
    else setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewReadingClick = () => {
    if (!showForm) {
      setEditingId(null);
      let targetUnit = lastUsedUnit || (readings.length > 0 ? readings[0].unit : units[0]);
      if (targetUnit) prepareFormForUnit(targetUnit);
    }
    setShowForm(!showForm);
  };

  const initiateEdit = (r: WaterReading) => {
    const dateObj = new Date(r.date);
    setFormData({
      unit: r.unit,
      date: getLocalDateString(dateObj),
      time: dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      reading: r.reading.toString()
    });
    setEditingId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unit || !formData.reading) return;
    const dateTime = new Date(`${formData.date}T${formData.time}`).toISOString();

    if (editingId) {
      await db.updateWaterReading(editingId, { date: dateTime, reading: Number(formData.reading) }, currentEnterpriseId, user.email);
      setEditingId(null);
      setShowForm(false);
    } else {
      await db.addWaterReading({
        enterpriseId: currentEnterpriseId,
        unit: formData.unit,
        date: dateTime,
        reading: Number(formData.reading)
      }, user.email);
      setLastUsedUnit(formData.unit);

      // Auto prep next
      const enteredDate = new Date(`${formData.date}T12:00:00`);
      enteredDate.setDate(enteredDate.getDate() + 1);
      setFormData(prev => ({ ...prev, date: getLocalDateString(enteredDate), reading: '' }));
    }
    fetchData();
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUnitName.trim()) {
      await db.addUnit(newUnitName.trim(), currentEnterpriseId, user.email);
      setNewUnitName('');
      fetchData();
    }
  };

  const confirmDeleteUnit = async () => {
    if (unitToDelete) {
      await db.deleteUnit(unitToDelete, currentEnterpriseId, user.email);
      setUnitToDelete(null);
      setShowUnitDeleteModal(false);
      fetchData();
    }
  };

  const confirmDelete = async () => {
    if (readingToDelete) {
      await db.deleteWaterReading(readingToDelete, currentEnterpriseId, user.email);
      setShowDeleteModal(false);
      setReadingToDelete(null);
      fetchData();
    }
  };

  const chartData = processedReadings.map(r => ({
    name: r.unit,
    consumo: parseFloat(Math.max(0, r.reading - r.previousReading).toFixed(2)),
    date: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }));

  const tableData = useMemo(() => {
    return [...processedReadings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [processedReadings]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-lg md:text-2xl font-bold text-slate-800 pl-14 md:pl-0">Controle de Consumo de Água</h2>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <button
              onClick={() => setShowUnitModal(true)}
              className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
            >
              <Building2 size={18} /> Gerenciar Unidades
            </button>
          )}
          {canWrite && (
            <button
              onClick={handleNewReadingClick}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {showForm ? <X size={18} /> : <Plus size={18} />}
              {showForm ? 'Cancelar' : 'Nova Leitura'}
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={loadingAnalysis}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {loadingAnalysis ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            Analisar IA
          </button>
        </div>
      </div>

      {/* Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Gerenciar Unidades</h3>
              <button onClick={() => setShowUnitModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleAddUnit} className="mb-4 flex gap-2">
              <input
                type="text" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)}
                className="flex-1 p-2 border rounded-lg" placeholder="Nova unidade..." required
              />
              <button type="submit" className="px-3 bg-blue-600 text-white rounded-lg"><Plus size={20} /></button>
            </form>

            <div className="flex-1 overflow-y-auto pt-2">
              {units.map(u => (
                <div key={u} className="flex justify-between items-center bg-slate-50 p-2 rounded mb-2">
                  <span>{u}</span>
                  <button onClick={() => { setUnitToDelete(u); setShowUnitDeleteModal(true) }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Unit Confirmation */}
      {showUnitDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border border-red-100">
            <h3 className="text-lg font-bold text-red-600 mb-4">Excluir Unidade?</h3>
            <p className="text-slate-600 mb-6">Confirma a exclusão de <b>{unitToDelete}</b>? Todo histórico será perdido.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowUnitDeleteModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button>
              <button onClick={confirmDeleteUnit} className="px-4 py-2 bg-red-600 text-white rounded-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Reading Confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-red-600 mb-4">Excluir Leitura?</h3>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-blue-100">
          <form onSubmit={handleSubmit} className="grid md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium mb-1">Unidade</label>
              <select name="unit" value={formData.unit} onChange={handleInputChange} className="w-full p-2 border rounded-lg" required disabled={!!editingId}>
                <option value="">Selecione...</option>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="md:col-span-1"><label className="block text-sm font-medium mb-1">Data</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2 border rounded-lg" required /></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium mb-1">Horário</label><input type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full p-2 border rounded-lg" required /></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium mb-1">Leitura (m³)</label><input ref={readingInputRef} type="number" name="reading" value={formData.reading} onChange={handleInputChange} step="0.01" className="w-full p-2 border rounded-lg" required /></div>
            <div className="md:col-span-1"><button type="submit" className="w-full bg-green-600 text-white p-2 rounded-lg">{editingId ? 'Atualizar' : 'Salvar'}</button></div>
          </form>
        </div>
      )}

      {analysis && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg text-purple-900 shadow-sm">
          <p className="whitespace-pre-line text-sm">{analysis}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px]">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Gráfico de Consumo (m³)</h3>
          <ResponsiveContainer width="100%" height="90%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="consumo" stroke="#3b82f6" /></LineChart></ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Histórico de Leituras</h3>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr><th className="px-4 py-2">Unidade</th><th className="px-4 py-2">Data</th><th className="px-4 py-2">Leitura</th><th className="px-4 py-2">Consumo</th><th className="px-4 py-2 text-right">Ação</th></tr>
              </thead>
              <tbody>
                {tableData.map(r => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{r.unit}</td>
                    <td className="px-4 py-3">{new Date(r.date).toLocaleDateString()} <span className="text-xs text-slate-400">{new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></td>
                    <td className="px-4 py-3">{r.reading}</td>
                    <td className="px-4 py-3 font-bold text-blue-600">{(r.reading - r.previousReading) > 0 ? (r.reading - r.previousReading).toFixed(2) : '0.00'}</td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => initiateEdit(r)} className="text-blue-500 p-1"><Pencil size={16} /></button>
                          <button onClick={() => { setReadingToDelete(r.id); setShowDeleteModal(true) }} className="text-red-500 p-1"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};