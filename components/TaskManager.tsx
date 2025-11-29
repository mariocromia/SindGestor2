
import React, { useEffect, useState, useRef } from 'react';
import { db, fileToBase64 } from '../services/db';
import { Task, UserRole, PermissionLevel, MODULES, Membership, TaskComment, TaskAttachment } from '../types';
import { CheckCircle2, Circle, Clock, Plus, X, Users, Trash2, Filter, Pencil, LayoutGrid, List, CalendarDays, Building, AlertCircle, Building2, Mic, Image, Camera, Send, StopCircle, PlayCircle, ChevronLeft, ChevronRight, Bell } from 'lucide-react';

interface TaskManagerProps {
  userEmail: string;
  userRole: UserRole;
  currentEnterpriseId: string;
  permissions: Record<string, PermissionLevel>;
  userName?: string;
  memberships: Membership[];
}

// Audio Recorder Component
const AudioRecorder: React.FC<{ onSave: (base64: string) => void; label?: string }> = ({ onSave, label }) => {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Convert to Base64 for storage
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          onSave(reader.result as string);
        };
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (e) {
      alert("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
    }
  };

  const clearRecording = () => {
    setAudioUrl(null);
    onSave('');
  };

  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
      {label && <span className="text-xs font-bold text-slate-500 uppercase mr-2">{label}</span>}
      {!audioUrl ? (
        <button 
          type="button"
          onClick={recording ? stopRecording : startRecording}
          className={`p-2 rounded-full transition ${recording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-100 text-blue-600'}`}
          title={recording ? "Parar Gravação" : "Gravar Áudio"}
        >
          {recording ? <StopCircle size={20} /> : <Mic size={20} />}
        </button>
      ) : (
        <div className="flex items-center gap-2 w-full">
           <audio src={audioUrl} controls className="h-8 w-48" />
           <button type="button" onClick={clearRecording} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
        </div>
      )}
      {recording && <span className="text-xs text-red-500 font-bold animate-pulse">Gravando...</span>}
    </div>
  );
};

export const TaskManager: React.FC<TaskManagerProps> = ({ userEmail, userRole, currentEnterpriseId, permissions, userName, memberships }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [availableAssignees, setAvailableAssignees] = useState<{name: string, id: string, type: 'USER' | 'CUSTOM'}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Attachments & Comments
  const [newAttachments, setNewAttachments] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentAudio, setNewCommentAudio] = useState('');
  
  // Image Viewer State
  const [viewerImageIndex, setViewerImageIndex] = useState<number | null>(null);
  
  // Input Refs for Images
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Filters
  const [filters, setFilters] = useState({ 
    assignee: '', 
    startDate: '', 
    endDate: '', 
    status: '',
    enterpriseContext: 'CURRENT'
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  
  // Default assignee is current user if they don't have full access
  const permission = permissions[MODULES.TASKS] || PermissionLevel.NONE;
  const canWrite = permission === PermissionLevel.READ_WRITE || permission === PermissionLevel.FULL_ACCESS;
  const canEdit = permission === PermissionLevel.FULL_ACCESS;
  
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    audioDescription: '',
    assignedTo: canEdit ? '' : userEmail, 
    dueDate: new Date().toISOString().split('T')[0], 
    status: 'PENDING' as Task['status'],
    notifyAssignee: true // New V11 State
  });

  const fetchData = async () => {
    let data: Task[] = [];
    if (filters.enterpriseContext === 'ALL') {
       data = await db.getUnifiedTasks(userEmail, memberships);
    } else {
       const targetId = filters.enterpriseContext === 'CURRENT' ? currentEnterpriseId : filters.enterpriseContext;
       const membership = memberships.find(m => m.enterpriseId === targetId);
       const targetPerm = membership?.permissions[MODULES.TASKS] || PermissionLevel.NONE;
       data = await db.getTasks(userEmail, targetPerm, targetId);
    }
    setTasks(data);
    
    let users = await db.getAvailableUsers(currentEnterpriseId);
    if (!canEdit) {
       // Se não tem acesso total, vê apenas a si mesmo na lista
       users = users.filter(u => u.id.toLowerCase() === userEmail.toLowerCase());
       if (users.length === 0) users = [{ name: userName || 'Você', id: userEmail, type: 'USER' }];
       
       // Força o filtro para o usuário atual
       setFilters(prev => ({ ...prev, assignee: userEmail }));
    }
    setAvailableAssignees(users);
  };

  useEffect(() => { 
    setFilters(prev => ({ ...prev, enterpriseContext: 'CURRENT' })); 
  }, [currentEnterpriseId]);

  useEffect(() => { fetchData(); }, [currentEnterpriseId, userEmail, filters.enterpriseContext]);

  // Fetch sub-data when editing a task
  useEffect(() => {
    if (editingId) {
      db.getTaskComments(editingId).then(setComments);
      db.getTaskAttachments(editingId).then(setAttachments);
    } else {
      setComments([]);
      setAttachments([]);
    }
  }, [editingId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setShowSuggestions(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    let finalTaskId = editingId;
    
    try {
      // Save/Update Task
      if (editingId) {
        const taskToEdit = tasks.find(t => t.id === editingId);
        const targetEntId = taskToEdit ? taskToEdit.enterpriseId : currentEnterpriseId;
        await db.updateTask(editingId, newTask, targetEntId, userEmail);
      } else {
        const createdTask = await db.addTask({ ...newTask, enterpriseId: currentEnterpriseId }, userEmail);
        if (createdTask) finalTaskId = createdTask.id;
      }

      // Save Attachments (New ones)
      if (finalTaskId && newAttachments.length > 0) {
        for (const base64 of newAttachments) {
          await db.addTaskAttachment(finalTaskId, base64);
        }
      }

      handleCloseModal();
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => { 
    setShowModal(false); 
    setEditingId(null); 
    setNewAttachments([]);
    setViewerImageIndex(null);
    setNewTask({ 
      title: '', 
      description: '', 
      audioDescription: '',
      assignedTo: canEdit ? '' : userEmail, 
      dueDate: new Date().toISOString().split('T')[0], 
      status: 'PENDING',
      notifyAssignee: true
    }); 
  };
  
  const handleEditClick = (task: Task) => {
    const taskMembership = memberships.find(m => m.enterpriseId === task.enterpriseId);
    const taskPerm = taskMembership?.permissions[MODULES.TASKS] || PermissionLevel.NONE;
    const taskCanWrite = taskPerm === PermissionLevel.READ_WRITE || taskPerm === PermissionLevel.FULL_ACCESS;

    // Safety Check: Users with READ_WRITE can only edit their own tasks.
    // However, if they have FULL_ACCESS, they can edit anything.
    if (!taskCanWrite) {
      alert("Você não tem permissão para editar tarefas neste condomínio.");
      return;
    }
    
    // Strict ownership check for non-admins
    if (taskPerm !== PermissionLevel.FULL_ACCESS && task.assignedTo.toLowerCase() !== userEmail.toLowerCase()) {
       alert("Você só pode editar suas próprias tarefas.");
       return;
    }

    setEditingId(task.id);
    setNewTask({ 
      title: task.title, 
      description: task.description, 
      audioDescription: task.audioDescription || '',
      assignedTo: task.assignedTo, 
      dueDate: task.dueDate ? (task.dueDate.length === 10 ? task.dueDate : task.dueDate.split('T')[0]) : '', 
      status: task.status,
      notifyAssignee: task.notifyAssignee ?? true
    });
    setNewAttachments([]);
    setShowModal(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (canEdit) {
      setTaskToDelete(task.id);
      setShowDeleteModal(true);
    }
  };

  const confirmDeleteTask = async () => {
    if (taskToDelete) {
       await db.deleteTask(taskToDelete, currentEnterpriseId, userEmail);
       setShowDeleteModal(false);
       setTaskToDelete(null);
       fetchData();
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const taskMembership = memberships.find(m => m.enterpriseId === task.enterpriseId);
    const taskPerm = taskMembership?.permissions[MODULES.TASKS] || PermissionLevel.NONE;
    const taskCanWrite = taskPerm === PermissionLevel.READ_WRITE || taskPerm === PermissionLevel.FULL_ACCESS;

    if(!taskCanWrite) return;
    
    // Non-admin can only toggle own tasks
    if (taskPerm !== PermissionLevel.FULL_ACCESS && task.assignedTo.toLowerCase() !== userEmail.toLowerCase()) return;

    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    await db.updateTask(task.id, { status: newStatus }, task.enterpriseId, userEmail);
    fetchData();
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const currentCount = (attachments.length || 0) + newAttachments.length;
      if (currentCount + files.length > 5) {
        alert("Máximo de 5 imagens permitido.");
        return;
      }

      const promises = Array.from(files).map(file => fileToBase64(file as File));
      const results = await Promise.all(promises);
      setNewAttachments(prev => [...prev, ...results]);
    }
  };

  const handleSendComment = async () => {
    if (!editingId) return;
    
    if (newCommentText.trim() || newCommentAudio) {
      const content = newCommentText.trim() || newCommentAudio;
      const type = newCommentText.trim() ? 'TEXT' : 'AUDIO';
      
      await db.addTaskComment(editingId, userEmail, userName || 'Usuário', content, type);
      
      // Refresh comments
      const updated = await db.getTaskComments(editingId);
      setComments(updated);
      setNewCommentText('');
      setNewCommentAudio('');
    }
  };

  const handleDeleteAssignee = async (name: string) => { await db.deleteCustomAssignee(name, currentEnterpriseId); fetchData(); };
  const handleAddAdHocAssignee = async () => { if (newTask.assignedTo.trim()) { await db.addCustomAssignee(newTask.assignedTo.trim(), currentEnterpriseId); setShowSuggestions(false); fetchData(); } };

  // Helper
  const getAssigneeLabel = (email: string) => {
     if (email.toLowerCase() === userEmail.toLowerCase()) return `${userName || 'Você'}`;
     const found = availableAssignees.find(u => u.id.toLowerCase() === email.toLowerCase());
     return found ? found.name : email.split('@')[0];
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Sem data';
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    if (cleanDate.length !== 10) return cleanDate;
    const [year, month, day] = cleanDate.split('-');
    return `${day}/${month}/${year}`;
  };

  // Gallery Logic
  const galleryImages = [
    ...attachments.map(a => a.url),
    ...newAttachments
  ];

  const handlePrevImage = () => {
    if (viewerImageIndex === null) return;
    setViewerImageIndex((prev) => (prev !== null ? (prev - 1 + galleryImages.length) % galleryImages.length : null));
  };

  const handleNextImage = () => {
    if (viewerImageIndex === null) return;
    setViewerImageIndex((prev) => (prev !== null ? (prev + 1) % galleryImages.length : null));
  };

  // Filter Logic
  const displayTasks = tasks.filter(task => {
    const matchAssignee = filters.assignee ? task.assignedTo.toLowerCase() === filters.assignee.toLowerCase() : true;
    const matchStatus = filters.status ? task.status === filters.status : true;
    let matchDate = true;
    const taskDate = task.dueDate ? (task.dueDate.length === 10 ? task.dueDate : task.dueDate.split('T')[0]) : '';
    if (filters.startDate) matchDate = taskDate >= filters.startDate;
    if (filters.endDate && matchDate) matchDate = taskDate <= filters.endDate;
    return matchAssignee && matchStatus && matchDate;
  });

  return (
    <div className="space-y-6 relative">
       <style>{`@keyframes borderPulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); border-color: rgba(239, 68, 68, 1); } 50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.6); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); border-color: rgba(239, 68, 68, 1); } } .task-pulse { animation: borderPulse 2s infinite; }`}</style>
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Controle de Tarefas</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
           <div className="flex bg-white rounded-lg border border-slate-200 p-1 mr-2 self-start">
             <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
             <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-slate-400'}`}><List size={18} /></button>
           </div>
          {canEdit && filters.enterpriseContext === 'CURRENT' && (
            <button onClick={() => setShowAssigneeModal(true)} className="bg-slate-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm"><Users size={16} /> Resp.</button>
          )}
          {canWrite && filters.enterpriseContext === 'CURRENT' && (
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm flex-1 md:flex-none"><Plus size={16} /> Nova Tarefa</button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm items-end flex-wrap">
          {memberships.length > 1 && (
            <div className="flex-1 w-full min-w-[200px] md:w-auto">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Condomínio</label>
              <div className="relative">
                 <select value={filters.enterpriseContext} onChange={e => setFilters({...filters, enterpriseContext: e.target.value})} className="w-full p-2 border rounded-lg bg-blue-50 text-blue-900 text-sm font-medium border-blue-200">
                   <option value="CURRENT">Atual (Padrão)</option>
                   <option value="ALL">Todos os Condomínios (Visão Unificada)</option>
                   <optgroup label="Específicos">
                     {memberships.map(m => (
                       <option key={m.enterpriseId} value={m.enterpriseId}>{m.enterpriseName}</option>
                     ))}
                   </optgroup>
                 </select>
                 <Building2 size={14} className="absolute right-3 top-3 text-blue-400" />
              </div>
            </div>
          )}

          <div className="flex-1 w-full md:w-auto">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsável</label>
             <div className="relative">
                <select 
                  value={filters.assignee} 
                  onChange={e => setFilters({...filters, assignee: e.target.value})} 
                  className={`w-full p-2 border rounded-lg bg-slate-50 text-sm ${!canEdit ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                  disabled={!canEdit}
                >
                  <option value="">Todos</option>
                  {availableAssignees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <Filter size={14} className="absolute right-3 top-3 text-slate-400" />
             </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
             <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">De</label>
                <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full p-2 border rounded-lg bg-slate-50 text-sm"/>
             </div>
             <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Até</label>
                <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full p-2 border rounded-lg bg-slate-50 text-sm"/>
             </div>
          </div>

          <div className="flex-1 w-full md:w-auto">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
             <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="w-full p-2 border rounded-lg bg-slate-50 text-sm">
                <option value="">Todos</option>
                <option value="PENDING">Pendente</option>
                <option value="COMPLETED">Concluído</option>
             </select>
          </div>
          
          <div className="flex gap-1">
             <button onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setFilters({...filters, startDate: today, endDate: today});
             }} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600">Hoje</button>
             <button onClick={() => setFilters({assignee: canEdit ? '' : userEmail, startDate: '', endDate: '', status: '', enterpriseContext: 'CURRENT'})} className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-xs font-bold"><X size={16}/></button>
          </div>
      </div>
      
      {viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayTasks.map(task => {
               const isOverdue = task.status !== 'COMPLETED' && task.dueDate && task.dueDate < new Date().toISOString().split('T')[0];
               const taskMembership = memberships.find(m => m.enterpriseId === task.enterpriseId);
               const taskPerm = taskMembership?.permissions[MODULES.TASKS] || PermissionLevel.NONE;
               // Permite editar se for admin OU se for dono da tarefa e tiver permissão de escrita
               const canEditThis = taskPerm === PermissionLevel.FULL_ACCESS || (taskPerm === PermissionLevel.READ_WRITE && task.assignedTo.toLowerCase() === userEmail.toLowerCase());

               return (
               <div 
                 key={task.id} 
                 onClick={() => handleEditClick(task)}
                 className={`bg-white p-5 rounded-xl shadow-sm border flex flex-col cursor-pointer transition-colors hover:border-blue-300 ${task.status === 'COMPLETED' ? 'border-green-100 bg-green-50/30' : 'border-slate-200'} ${isOverdue ? 'task-pulse border-red-400' : ''}`}
               >
                  <div className="flex justify-between items-start mb-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // Stop propagation to prevent opening modal
                        handleToggleStatus(task);
                      }} 
                      className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 font-medium ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                    >
                      {task.status === 'COMPLETED' ? <CheckCircle2 size={12}/> : <Circle size={12}/>}
                      {task.status === 'COMPLETED' ? 'Concluída' : 'Pendente'}
                    </button>
                    <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                       <CalendarDays size={12}/> {formatDate(task.dueDate)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{task.title}</h3>
                  <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-1">{task.description}</p>
                  
                  {task.enterpriseName && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded uppercase font-bold border border-blue-200">
                        <Building size={10} /> {task.enterpriseName}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-2 mb-2">
                     <span className="text-[10px] text-slate-400 flex items-center gap-1">
                       <Clock size={10}/> Criado: {new Date(task.createdAt || Date.now()).toLocaleDateString('pt-BR')}
                     </span>
                     <span className="text-[9px] text-slate-300 font-mono">#{task.id.substring(0, 8)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-auto">
                    <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                       <Users size={12}/> {getAssigneeLabel(task.assignedTo)}
                    </div>
                    <div className="flex gap-2">
                      {canEditThis && (
                        <span className="text-sm text-blue-600 font-medium flex items-center gap-1 p-1 rounded"><Pencil size={14} /> Editar</span>
                      )}
                      {canEdit && (
                        <button onClick={(e) => handleDeleteClick(e, task)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition">
                           <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
               </div>
            )})}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-medium border-b border-slate-200">
                 <tr>
                   <th className="px-4 py-3">Status</th>
                   <th className="px-4 py-3">Tarefa</th>
                   <th className="px-4 py-3">Responsável</th>
                   <th className="px-4 py-3">Data</th>
                   <th className="px-4 py-3 text-right">Ações</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                 {displayTasks.map(task => {
                    const isOverdue = task.status !== 'COMPLETED' && task.dueDate && task.dueDate < new Date().toISOString().split('T')[0];
                    const taskMembership = memberships.find(m => m.enterpriseId === task.enterpriseId);
                    const taskPerm = taskMembership?.permissions[MODULES.TASKS] || PermissionLevel.NONE;
                    const canEditThis = taskPerm === PermissionLevel.FULL_ACCESS || (taskPerm === PermissionLevel.READ_WRITE && task.assignedTo.toLowerCase() === userEmail.toLowerCase());

                    return (
                    <tr 
                      key={task.id} 
                      onClick={() => handleEditClick(task)}
                      className={`hover:bg-slate-50 cursor-pointer ${isOverdue ? 'bg-red-50' : ''}`}
                    >
                       <td className="px-4 py-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(task);
                            }} 
                            className={`p-1 rounded-full ${task.status === 'COMPLETED' ? 'text-green-600' : 'text-slate-300 hover:text-blue-600'}`}
                          >
                             {task.status === 'COMPLETED' ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                          </button>
                       </td>
                       <td className="px-4 py-3">
                          <span className={`font-medium ${task.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</span>
                          {task.enterpriseName && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-bold">{task.enterpriseName}</span>}
                          <div className="text-[10px] text-slate-400 mt-1">Criado: {new Date(task.createdAt || Date.now()).toLocaleDateString('pt-BR')}</div>
                       </td>
                       <td className="px-4 py-3 text-slate-600">{getAssigneeLabel(task.assignedTo)}</td>
                       <td className={`px-4 py-3 ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{formatDate(task.dueDate)}</td>
                       <td className="px-4 py-3 text-right flex justify-end gap-3">
                          {canEditThis && <span className="text-blue-600 hover:underline">Editar</span>}
                          {canEdit && <button onClick={(e) => handleDeleteClick(e, task)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>}
                       </td>
                    </tr>
                 )})}
              </tbody>
           </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
           <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2"><Trash2 size={20}/> Excluir Tarefa?</h3>
              <p className="text-slate-600 mb-6 text-sm">Tem certeza que deseja excluir esta tarefa? Todo o histórico de comentários e anexos será perdido permanentemente.</p>
              <div className="flex gap-3 justify-end">
                 <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
                 <button onClick={confirmDeleteTask} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold">Confirmar Exclusão</button>
              </div>
           </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">{editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</h3><button onClick={handleCloseModal}><X size={24}/></button></div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Título</label>
                    <input type="text" required value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full p-2 border rounded-lg"/>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Descrição</label>
                    <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="w-full p-2 border rounded-lg h-24 mb-2"/>
                    <AudioRecorder label="Adicionar Áudio na Descrição" onSave={(base64) => setNewTask({...newTask, audioDescription: base64})} />
                    {newTask.audioDescription && <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200"><p className="text-xs text-slate-500 mb-1">Áudio Anexado:</p><audio src={newTask.audioDescription} controls className="h-8 w-full"/></div>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Data Limite</label>
                    <input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} className="w-full p-2 border rounded-lg"/>
                  </div>
               
                  <div className="relative" ref={wrapperRef}>
                    <label className="block text-sm font-medium mb-1">Responsável</label>
                    {canEdit ? (
                      <>
                        <input type="text" required value={newTask.assignedTo} onChange={e => {setNewTask({...newTask, assignedTo: e.target.value}); setShowSuggestions(true);}} onFocus={() => setShowSuggestions(true)} className="w-full p-2 border rounded-lg"/>
                        {showSuggestions && <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {availableAssignees.filter(n => (n.id || '').toLowerCase().includes(newTask.assignedTo.toLowerCase()) || n.name.toLowerCase().includes(newTask.assignedTo.toLowerCase())).map((u, i) => <div key={i} onClick={() => {setNewTask({...newTask, assignedTo: u.id}); setShowSuggestions(false);}} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm">{u.name} <span className="text-xs text-slate-400">({u.id})</span></div>)}
                            <div onClick={handleAddAdHocAssignee} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 font-bold">Cadastrar novo: "{newTask.assignedTo}"</div>
                        </div>}
                      </>
                    ) : (
                      <select value={newTask.assignedTo} onChange={e => setNewTask({...newTask, assignedTo: e.target.value})} className="w-full p-2 border rounded-lg bg-slate-100" disabled>
                        <option value={userEmail}>{userName || userEmail}</option>
                      </select>
                    )}
                  </div>
               </div>

               {/* Notifications Toggle (V11) */}
               <div className="flex items-center gap-3 py-2 bg-yellow-50 rounded-lg px-3 border border-yellow-100">
                  <div className={`p-1.5 rounded-full ${newTask.notifyAssignee ? 'bg-yellow-200 text-yellow-700' : 'bg-slate-200 text-slate-400'}`}>
                    <Bell size={16}/>
                  </div>
                  <div className="flex-1">
                     <label htmlFor="notifyToggle" className="text-sm font-bold text-slate-700 cursor-pointer select-none">Notificar Responsável por E-mail</label>
                     <p className="text-[10px] text-slate-500">Se ativo, enviaremos um alerta ao salvar.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input id="notifyToggle" type="checkbox" checked={newTask.notifyAssignee} onChange={e => setNewTask({...newTask, notifyAssignee: e.target.checked})} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
               </div>

               {/* IMAGES SECTION */}
               <div>
                  <label className="block text-sm font-medium mb-2">Anexar Imagens (Máx: 5)</label>
                  <div className="flex gap-2 mb-2">
                     <input type="file" accept="image/*" multiple ref={galleryInputRef} className="hidden" onChange={handleAddImage} />
                     <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleAddImage} />
                     
                     <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-slate-50 text-sm"><Image size={16}/> Galeria</button>
                     <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-slate-50 text-sm"><Camera size={16}/> Câmera</button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                     {attachments.map((a, i) => (
                       <div key={a.id} className="relative aspect-square bg-slate-100 rounded overflow-hidden border cursor-pointer hover:opacity-80 transition" onClick={() => setViewerImageIndex(i)}>
                         <img src={a.url} alt="anexo" className="w-full h-full object-cover" />
                       </div>
                     ))}
                     {newAttachments.map((url, i) => (
                       <div key={i} className="relative aspect-square bg-slate-100 rounded overflow-hidden border border-blue-300 cursor-pointer hover:opacity-80 transition" onClick={() => setViewerImageIndex(attachments.length + i)}>
                         <img src={url} alt="novo anexo" className="w-full h-full object-cover" />
                         <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-1">Novo</div>
                       </div>
                     ))}
                  </div>
               </div>
               
               {/* COMMENTS SECTION (Only when Editing) */}
               {editingId && (
                 <div className="border-t pt-4">
                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Clock size={16}/> Comentários e Histórico</h4>
                    <div className="bg-slate-50 rounded-xl p-4 mb-3 max-h-48 overflow-y-auto space-y-3">
                       {comments.length === 0 && <p className="text-center text-slate-400 text-xs">Nenhum comentário ainda.</p>}
                       {comments.map(c => (
                         <div key={c.id} className={`flex flex-col ${c.userEmail === userEmail ? 'items-end' : 'items-start'}`}>
                            <div className={`p-2 rounded-lg max-w-[85%] text-sm ${c.userEmail === userEmail ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
                               {c.contentType === 'AUDIO' ? <audio src={c.content} controls className="h-8 w-40"/> : <p>{c.content}</p>}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">{c.userName} • {new Date(c.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                         </div>
                       ))}
                    </div>
                    <div className="flex gap-2 items-center">
                       <input type="text" placeholder="Digite um comentário..." value={newCommentText} onChange={e => setNewCommentText(e.target.value)} className="flex-1 p-2 border rounded-lg text-sm" onKeyDown={e => {if(e.key === 'Enter') {e.preventDefault(); handleSendComment();}}}/>
                       <div className="scale-75 origin-right">
                         <AudioRecorder onSave={(b64) => setNewCommentAudio(b64)} />
                       </div>
                       {(newCommentText || newCommentAudio) && (
                         <button type="button" onClick={handleSendComment} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700"><Send size={16}/></button>
                       )}
                    </div>
                 </div>
               )}

               <div className="flex justify-end pt-2"><button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2">{isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}{editingId ? 'Atualizar' : 'Salvar'}</button></div>
            </form>
          </div>
        </div>
      )}
      
      {/* IMAGE VIEWER MODAL */}
      {viewerImageIndex !== null && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewerImageIndex(null)}>
           <button onClick={() => setViewerImageIndex(null)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-[70]"><X size={32}/></button>
           
           <div className="w-full h-full flex items-center justify-center relative" onClick={e => e.stopPropagation()}>
              {galleryImages.length > 1 && (
                <button onClick={handlePrevImage} className="absolute left-2 text-white/50 hover:text-white hover:bg-white/10 p-2 rounded-full transition"><ChevronLeft size={48}/></button>
              )}
              
              <img 
                 src={galleryImages[viewerImageIndex]} 
                 alt={`Imagem ${viewerImageIndex + 1}`} 
                 className="max-h-full max-w-full object-contain"
              />
              
              {galleryImages.length > 1 && (
                <button onClick={handleNextImage} className="absolute right-2 text-white/50 hover:text-white hover:bg-white/10 p-2 rounded-full transition"><ChevronRight size={48}/></button>
              )}
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                {viewerImageIndex + 1} / {galleryImages.length}
              </div>
           </div>
        </div>
      )}
      
      {showAssigneeModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Gerenciar Responsáveis</h3><button onClick={() => setShowAssigneeModal(false)}><X/></button></div>
              <p className="text-xs text-slate-500 mb-4">Adicione nomes avulsos (prestadores) ou use os usuários cadastrados.</p>
              <div className="flex-1 overflow-y-auto space-y-2">
                 {availableAssignees.map(a => (
                    <div key={a.id} className="flex justify-between items-center bg-slate-50 p-2 rounded">
                       <span className="text-sm">{a.name}</span>
                       {a.type === 'CUSTOM' && <button onClick={() => handleDeleteAssignee(a.name)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>}
                    </div>
                 ))}
              </div>
           </div>
         </div>
      )}
    </div>
  );
};
