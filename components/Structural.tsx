import React, { useEffect, useState, useRef } from 'react';
import { db, fileToBase64 } from '../services/db';
import { StructuralIssue, StructuralPhoto, PermissionLevel } from '../types';
import { AlertTriangle, Camera, CheckCircle, Clock, MapPin, Search, Filter, Plus, X, Trash2, Loader2, Image as ImageIcon, Bell, ChevronLeft, ChevronRight } from 'lucide-react';

interface StructuralProps {
  currentEnterpriseId: string;
  userEmail: string;
  permissionLevel: PermissionLevel;
}

export const Structural: React.FC<StructuralProps> = ({ currentEnterpriseId, userEmail, permissionLevel }) => {
  const [issues, setIssues] = useState<StructuralIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Image Viewer State
  const [viewerImageIndex, setViewerImageIndex] = useState<number | null>(null);
  
  // Form State
  const [newIssue, setNewIssue] = useState({
    title: '', 
    description: '', 
    location: '', 
    priority: 'MEDIUM' as StructuralIssue['priority'],
    status: 'REPORTED' as StructuralIssue['status'],
    notifyAdmin: true
  });
  
  const [newPhotos, setNewPhotos] = useState<string[]>([]); // New pending photos
  const [existingPhotos, setExistingPhotos] = useState<StructuralPhoto[]>([]); // Photos from DB
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const canWrite = permissionLevel === PermissionLevel.READ_WRITE || permissionLevel === PermissionLevel.FULL_ACCESS;
  const canEdit = permissionLevel === PermissionLevel.FULL_ACCESS;

  useEffect(() => { fetchIssues(); }, [currentEnterpriseId]);

  const fetchIssues = async () => {
    setLoading(true);
    const data = await db.getStructuralIssues(currentEnterpriseId);
    setIssues(data);
    setLoading(false);
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (newPhotos.length + existingPhotos.length + files.length > 5) { alert("Máximo de 5 fotos no total."); return; }
      const promises = Array.from(files).map((f: File) => fileToBase64(f));
      const results = await Promise.all(promises);
      setNewPhotos(prev => [...prev, ...results]);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if(confirm("Excluir esta foto?")) {
       await db.deleteStructuralPhoto(photoId);
       setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
    }
  };

  const openModal = async (issue?: StructuralIssue) => {
    if (issue) {
      // Edit Mode
      setEditingId(issue.id);
      setNewIssue({
        title: issue.title,
        description: issue.description,
        location: issue.location,
        priority: issue.priority,
        status: issue.status,
        notifyAdmin: issue.notifyAdmin ?? true
      });
      // Fetch existing photos
      const photos = await db.getStructuralPhotos(issue.id);
      setExistingPhotos(photos);
      setNewPhotos([]); 
    } else {
      // Create Mode
      setEditingId(null);
      setNewIssue({ 
        title: '', 
        description: '', 
        location: '', 
        priority: 'MEDIUM',
        status: 'REPORTED',
        notifyAdmin: true
      });
      setExistingPhotos([]);
      setNewPhotos([]);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssue.title || !newIssue.location) return;
    setIsSubmitting(true);
    
    if (editingId) {
      // Update
      await db.updateStructuralIssue(editingId, {
        title: newIssue.title,
        description: newIssue.description,
        location: newIssue.location,
        priority: newIssue.priority,
        status: newIssue.status,
        notifyAdmin: newIssue.notifyAdmin
      }, currentEnterpriseId, userEmail);
      
      // Add new photos if any
      if (newPhotos.length > 0) {
         for (const photo of newPhotos) {
            await db.addStructuralPhoto(editingId, photo);
         }
      }
    } else {
      // Create
      await db.addStructuralIssue({
        enterpriseId: currentEnterpriseId,
        title: newIssue.title,
        description: newIssue.description,
        location: newIssue.location,
        priority: newIssue.priority,
        status: 'REPORTED',
        reportedBy: userEmail,
        notifyAdmin: newIssue.notifyAdmin
      }, newPhotos, userEmail);
    }

    setIsSubmitting(false);
    setShowModal(false);
    fetchIssues();
  };

  const handleStatusChange = async (e: React.MouseEvent, id: string, newStatus: StructuralIssue['status']) => {
    e.stopPropagation();
    if (canWrite) {
       await db.updateStructuralIssueStatus(id, newStatus, currentEnterpriseId, userEmail);
       fetchIssues();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir este registro?")) {
      await db.deleteStructuralIssue(id, currentEnterpriseId, userEmail);
      fetchIssues();
    }
  };

  // Gallery Navigation Logic
  const galleryImages = [
    ...existingPhotos.map(p => p.url),
    ...newPhotos
  ];

  const handlePrevImage = () => {
    if (viewerImageIndex === null) return;
    setViewerImageIndex((prev) => (prev !== null ? (prev - 1 + galleryImages.length) % galleryImages.length : null));
  };

  const handleNextImage = () => {
    if (viewerImageIndex === null) return;
    setViewerImageIndex((prev) => (prev !== null ? (prev + 1) % galleryImages.length : null));
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const filteredIssues = issues.filter(i => {
    const matchSearch = i.title.toLowerCase().includes(searchTerm.toLowerCase()) || i.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus ? i.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Manutenção Estrutural</h2>
        {canWrite && (
          <button onClick={() => openModal()} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2 shadow-sm">
            <AlertTriangle size={18} /> Reportar Problema
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-4">
         <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por título ou local..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-2.5 border rounded-lg bg-white"
            />
         </div>
         <select 
           value={filterStatus} 
           onChange={e => setFilterStatus(e.target.value)} 
           className="p-2.5 border rounded-lg bg-white min-w-[150px]"
         >
            <option value="">Todos Status</option>
            <option value="REPORTED">Reportado</option>
            <option value="IN_PROGRESS">Em Andamento</option>
            <option value="RESOLVED">Resolvido</option>
         </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-400" size={32}/></div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredIssues.length === 0 && <p className="text-center text-slate-400 py-8">Nenhum problema registrado.</p>}
          {filteredIssues.map(issue => (
            <div 
              key={issue.id} 
              onClick={() => canEdit ? openModal(issue) : null}
              className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 transition hover:shadow-md ${issue.status === 'RESOLVED' ? 'opacity-75' : ''} ${canEdit ? 'cursor-pointer hover:border-blue-300' : ''}`}
            >
              
              {/* Icon / Photo / Status */}
              <div className={`w-full md:w-32 h-32 md:h-auto rounded-lg flex items-center justify-center shrink-0 border overflow-hidden relative ${issue.status === 'RESOLVED' ? 'bg-green-50 border-green-100' : 'bg-slate-100 border-slate-200'}`}>
                 {issue.coverPhoto ? (
                   <>
                     <img src={issue.coverPhoto} alt="Foto Principal" className="w-full h-full object-cover" />
                     {issue.status === 'RESOLVED' && (
                        <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                           <CheckCircle size={32} className="text-white drop-shadow-md"/>
                        </div>
                     )}
                   </>
                 ) : (
                   <>
                     {issue.status === 'RESOLVED' ? <CheckCircle size={32} className="text-green-500"/> : <Camera size={32} className="text-slate-400"/>}
                   </>
                 )}
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-start">
                   <div>
                      <h3 className={`font-bold text-lg ${issue.status === 'RESOLVED' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{issue.title}</h3>
                      <div className="flex gap-2 mt-1">
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityColor(issue.priority)}`}>{issue.priority === 'CRITICAL' ? 'CRÍTICO' : issue.priority}</span>
                         <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-100 text-slate-600">{issue.status}</span>
                      </div>
                   </div>
                   {canEdit && (
                      <button 
                        type="button"
                        onClick={(e) => handleDelete(e, issue.id)} 
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition relative z-10"
                        title="Excluir Registro"
                      >
                        <Trash2 size={18}/>
                      </button>
                   )}
                </div>
                
                <p className="text-sm text-slate-600 mt-2">{issue.description}</p>
                
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                   <span className="flex items-center gap-1"><MapPin size={14}/> {issue.location}</span>
                   <span className="flex items-center gap-1"><Clock size={14}/> {new Date(issue.createdAt).toLocaleDateString()}</span>
                   <span>Reportado por: {issue.reportedBy.split('@')[0]}</span>
                </div>

                {/* Action Buttons */}
                {canWrite && issue.status !== 'RESOLVED' && (
                   <div className="mt-4 flex gap-2">
                      {issue.status === 'REPORTED' && (
                        <button onClick={(e) => handleStatusChange(e, issue.id, 'IN_PROGRESS')} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200">Iniciar Reparo</button>
                      )}
                      <button onClick={(e) => handleStatusChange(e, issue.id, 'RESOLVED')} className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-bold hover:bg-green-200">Marcar Resolvido</button>
                   </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REPORT/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{editingId ? 'Editar Problema' : 'Reportar Problema Estrutural'}</h3><button onClick={() => setShowModal(false)}><X/></button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                    <input required value={newIssue.title} onChange={e => setNewIssue({...newIssue, title: e.target.value})} className="w-full p-2 border rounded" placeholder="Ex: Rachadura na fachada"/>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Localização</label>
                       <input required value={newIssue.location} onChange={e => setNewIssue({...newIssue, location: e.target.value})} className="w-full p-2 border rounded" placeholder="Ex: Bloco A - Térreo"/>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridade</label>
                       <select value={newIssue.priority} onChange={e => setNewIssue({...newIssue, priority: e.target.value as any})} className="w-full p-2 border rounded">
                          <option value="LOW">Baixa</option>
                          <option value="MEDIUM">Média</option>
                          <option value="HIGH">Alta</option>
                          <option value="CRITICAL">Crítica</option>
                       </select>
                    </div>
                 </div>
                 
                 {editingId && (
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                      <select value={newIssue.status} onChange={e => setNewIssue({...newIssue, status: e.target.value as any})} className="w-full p-2 border rounded bg-slate-50">
                          <option value="REPORTED">Reportado</option>
                          <option value="IN_PROGRESS">Em Andamento</option>
                          <option value="RESOLVED">Resolvido</option>
                       </select>
                   </div>
                 )}

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                    <textarea value={newIssue.description} onChange={e => setNewIssue({...newIssue, description: e.target.value})} className="w-full p-2 border rounded h-24" placeholder="Descreva o problema..."/>
                 </div>
                 
                 {/* Notify Toggle */}
                 <div className="flex items-center gap-3 py-2 bg-yellow-50 rounded-lg px-3 border border-yellow-100">
                    <div className={`p-1.5 rounded-full ${newIssue.notifyAdmin ? 'bg-yellow-200 text-yellow-700' : 'bg-slate-200 text-slate-400'}`}>
                      <Bell size={16}/>
                    </div>
                    <div className="flex-1">
                       <label htmlFor="notifyAdminToggle" className="text-sm font-bold text-slate-700 cursor-pointer select-none">Notificar Administração</label>
                       <p className="text-[10px] text-slate-500">Enviar alerta por e-mail.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input id="notifyAdminToggle" type="checkbox" checked={newIssue.notifyAdmin} onChange={e => setNewIssue({...newIssue, notifyAdmin: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                 </div>

                 {/* PHOTOS MANAGEMENT */}
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fotos (Máx 5)</label>
                    <div className="flex gap-2 mb-2">
                       <button type="button" onClick={() => galleryInputRef.current?.click()} className="px-3 py-2 border rounded bg-slate-50 text-sm flex items-center gap-2"><ImageIcon size={16}/> Galeria</button>
                       <button type="button" onClick={() => cameraInputRef.current?.click()} className="px-3 py-2 border rounded bg-slate-50 text-sm flex items-center gap-2"><Camera size={16}/> Câmera</button>
                       <input type="file" ref={galleryInputRef} accept="image/*" multiple className="hidden" onChange={handleAddPhoto}/>
                       <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleAddPhoto}/>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                       {/* Existing Photos */}
                       {existingPhotos.map((p, i) => (
                          <div key={p.id} onClick={() => setViewerImageIndex(i)} className="w-16 h-16 bg-slate-100 rounded border relative cursor-pointer hover:opacity-80 transition">
                             <img src={p.url} className="w-full h-full object-cover rounded"/>
                             <button type="button" onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p.id); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm" title="Excluir Foto"><X size={10}/></button>
                          </div>
                       ))}
                       {/* New Pending Photos */}
                       {newPhotos.map((p, i) => (
                          <div key={i} onClick={() => setViewerImageIndex(existingPhotos.length + i)} className="w-16 h-16 bg-slate-100 rounded border relative border-blue-400 cursor-pointer hover:opacity-80 transition">
                             <img src={p} className="w-full h-full object-cover rounded"/>
                             <button type="button" onClick={(e) => { e.stopPropagation(); setNewPhotos(prev => prev.filter((_, idx) => idx !== i)); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"><X size={10}/></button>
                             <div className="absolute bottom-0 right-0 bg-blue-500 text-white text-[8px] px-1 rounded-tl">Novo</div>
                          </div>
                       ))}
                    </div>
                 </div>

                 <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2">
                    {isSubmitting && <Loader2 className="animate-spin" size={16}/>} {editingId ? 'Salvar Alterações' : 'Registrar Problema'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* IMAGE VIEWER MODAL */}
      {viewerImageIndex !== null && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewerImageIndex(null)}>
           <button onClick={() => setViewerImageIndex(null)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-[80]"><X size={32}/></button>
           
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
    </div>
  );
};