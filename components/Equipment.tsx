
import React, { useEffect, useState, useRef } from 'react';
import { db, fileToBase64 } from '../services/db';
import { Equipment, MaintenanceLog, EquipmentImage, PermissionLevel } from '../types';
import { Wrench, Plus, ClipboardCheck, X, History, QrCode, Scan, Camera, Image as ImageIcon, Trash2, Calendar, Loader2, Search, Filter, Pencil, Printer, Settings, PenTool } from 'lucide-react';

interface EquipmentManagerProps {
  currentEnterpriseId: string;
  userEmail: string;
  readOnly: boolean;
  permissionLevel: PermissionLevel;
  initialEquipmentId?: string;
}

// Internal Component for Signature
const SignaturePad: React.FC<{
  onSave: (base64: string) => void;
  initialSignature?: string;
  readOnly?: boolean;
}> = ({ onSave, initialSignature, readOnly = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (initialSignature) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialSignature;
      setHasSignature(true);
    } else {
      // Setup
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
    }
  }, [initialSignature]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        onSave(canvas.toDataURL());
      }
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    if ((e as React.TouchEvent).touches) {
      const touch = (e as React.TouchEvent).touches[0];
      const rect = canvas.getBoundingClientRect();
      return { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };
    } else {
      return { offsetX: (e as React.MouseEvent).nativeEvent.offsetX, offsetY: (e as React.MouseEvent).nativeEvent.offsetY };
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onSave('');
    }
  };

  if (readOnly && initialSignature) {
    return <img src={initialSignature} alt="Assinatura" className="border rounded w-full h-32 object-contain bg-white" />;
  }

  return (
    <div className="border rounded bg-white relative">
      <canvas
        ref={canvasRef}
        width={350}
        height={150}
        className="w-full touch-none cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      {!readOnly && (
        <button type="button" onClick={clear} className="absolute top-2 right-2 text-xs text-red-500 bg-white border border-red-200 px-2 py-1 rounded shadow-sm hover:bg-red-50">Limpar</button>
      )}
      {!hasSignature && !readOnly && (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-sm">Assine aqui</span>
      )}
    </div>
  );
};

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({ currentEnterpriseId, userEmail, readOnly, permissionLevel, initialEquipmentId }) => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [images, setImages] = useState<EquipmentImage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showFullscreenSignature, setShowFullscreenSignature] = useState(false);

  // Delete Modals
  const [showDeleteEqModal, setShowDeleteEqModal] = useState(false);
  const [showDeleteLogModal, setShowDeleteLogModal] = useState(false);
  const [eqToDelete, setEqToDelete] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);

  // Settings / Attributes Management State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'CATEGORY' | 'LOCATION'>('CATEGORY');
  const [newAttributeName, setNewAttributeName] = useState('');
  const [editingAttribute, setEditingAttribute] = useState<{ original: string, current: string, type: 'CATEGORY' | 'LOCATION' } | null>(null);
  const [attributeToDelete, setAttributeToDelete] = useState<{ name: string, type: 'CATEGORY' | 'LOCATION' } | null>(null);

  // Edit State
  const [editingEqId, setEditingEqId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // State for New/Edit Equipment
  const [newEq, setNewEq] = useState({
    name: '', category: '', location: '', description: '',
    installDate: new Date().toISOString().split('T')[0],
    acquisitionDate: new Date().toISOString().split('T')[0],
    status: 'OPERATIONAL' as any
  });
  const [newImages, setNewImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Maintenance
  const [newMaint, setNewMaint] = useState({
    date: new Date().toISOString().split('T')[0],
    technician: '',
    description: '',
    type: 'PREVENTIVE' as any,
    signatureUrl: ''
  });

  // Permissions
  const canScan = permissionLevel === PermissionLevel.READ_WRITE || permissionLevel === PermissionLevel.FULL_ACCESS;
  const canEdit = permissionLevel === PermissionLevel.FULL_ACCESS;
  const canWrite = permissionLevel === PermissionLevel.READ_WRITE || permissionLevel === PermissionLevel.FULL_ACCESS;

  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const fetchData = async () => {
    setEquipmentList(await db.getEquipment(currentEnterpriseId));
    setCategories(await db.getEquipmentCategories(currentEnterpriseId));
    setLocations(await db.getEquipmentLocations(currentEnterpriseId));
  };

  useEffect(() => { fetchData(); }, [currentEnterpriseId]);

  useEffect(() => {
    if (initialEquipmentId && equipmentList.length > 0) {
      const eq = equipmentList.find(e => e.id === initialEquipmentId);
      if (eq) setSelectedEq(eq);
    }
  }, [initialEquipmentId, equipmentList]);

  useEffect(() => {
    if (selectedEq) {
      db.getMaintenanceLogs(selectedEq.id).then(setLogs);
      db.getEquipmentImages(selectedEq.id).then(setImages);
    }
  }, [selectedEq]);

  // Scanner Effect
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showScanner && canScan) {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        alert('Para usar a câmera, acesse via HTTPS.');
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          const BD = (window as any).BarcodeDetector;
          if (BD) {
            try {
              detectorRef.current = new BD({ formats: ['qr_code'] });
            } catch {}
            const scan = async () => {
              if (!detectorRef.current || !videoRef.current) {
                rafRef.current = requestAnimationFrame(scan);
                return;
              }
              try {
                const codes: any[] = await detectorRef.current.detect(videoRef.current);
                if (codes && codes.length > 0) {
                  const raw = (codes[0] as any).rawValue || '';
                  const id = parseEquipmentId(raw);
                  if (id) {
                    simulateScan(id);
                    return;
                  }
                }
              } catch {}
              rafRef.current = requestAnimationFrame(scan);
            };
            scan();
          }
        })
        .catch(err => alert("Erro ao acessar câmera: " + err));
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detectorRef.current = null;
    };
  }, [showScanner]);

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (newImages.length + files.length > 3) {
        alert("Máximo de 3 imagens.");
        return;
      }
      const promises = Array.from(files).map(file => fileToBase64(file as File));
      const results = await Promise.all(promises);
      setNewImages(prev => [...prev, ...results]);
    }
  };

  const openNewEqModal = () => {
    setEditingEqId(null);
    setNewEq({ name: '', category: '', location: '', description: '', installDate: new Date().toISOString().split('T')[0], acquisitionDate: new Date().toISOString().split('T')[0], status: 'OPERATIONAL' });
    setNewImages([]);
    setShowAddModal(true);
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (editingEqId) {
        // Update
        await db.updateEquipment(editingEqId, newEq, currentEnterpriseId, userEmail);
        if (newImages.length > 0) {
          for (const img of newImages) await db.addEquipmentImage(editingEqId, img);
        }
        if (selectedEq?.id === editingEqId) {
          // Refresh selected if we edited it
          const updated = { ...selectedEq, ...newEq };
          setSelectedEq(updated as Equipment);
          db.getEquipmentImages(editingEqId).then(setImages);
        }
      } else {
        // Create
        const createdEq = await db.addEquipment({
          ...newEq,
          enterpriseId: currentEnterpriseId,
          lastMaintenance: newEq.installDate,
          nextMaintenance: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // +90 days default
        }, userEmail);

        if (createdEq && newImages.length > 0) {
          for (const img of newImages) {
            await db.addEquipmentImage(createdEq.id, img);
          }
        }
      }

      setShowAddModal(false);
      setEditingEqId(null);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const openEditEqModal = (e: React.MouseEvent, eq: Equipment) => {
    e.stopPropagation();
    setEditingEqId(eq.id);
    setNewEq({
      name: eq.name,
      category: eq.category,
      location: eq.location,
      description: eq.description || '',
      installDate: eq.installDate ? eq.installDate.split('T')[0] : '',
      acquisitionDate: eq.acquisitionDate ? eq.acquisitionDate.split('T')[0] : '',
      status: eq.status
    });
    setNewImages([]);
    setShowAddModal(true);
  };

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq) return;

    if (editingLogId) {
      await db.updateMaintenanceLog(editingLogId, newMaint, currentEnterpriseId, userEmail);
    } else {
      await db.addMaintenanceLog({ equipmentId: selectedEq.id, ...newMaint }, userEmail, currentEnterpriseId);
    }

    setShowMaintModal(false);
    setEditingLogId(null);
    setLogs(await db.getMaintenanceLogs(selectedEq.id));
  };

  const openNewMaintModal = () => {
    setEditingLogId(null);
    setNewMaint({
      date: new Date().toISOString().split('T')[0],
      technician: '',
      description: '',
      type: 'PREVENTIVE',
      signatureUrl: ''
    });
    setShowMaintModal(true);
  };

  const openEditLogModal = (log: MaintenanceLog) => {
    // Allow any authorized user to view the log details
    setEditingLogId(log.id);
    setNewMaint({
      date: log.date.split('T')[0],
      technician: log.technician,
      description: log.description,
      type: log.type,
      signatureUrl: log.signatureUrl || ''
    });
    setShowMaintModal(true);
  };

  const handlePrintLabel = (eq: Equipment) => {
    const appUrl = `${location.origin}${location.pathname}#/equipment/${eq.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(appUrl)}`;
    const printWindow = window.open('', '_blank', 'width=400,height=400');

    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Etiqueta - ${eq.name}</title>
            <style>
              body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .label-container { border: 2px solid #000; padding: 20px; border-radius: 10px; text-align: center; width: 250px; }
              h2 { margin: 10px 0 5px; font-size: 18px; font-weight: bold; }
              .meta { font-size: 12px; color: #555; margin-bottom: 5px; }
              .id { font-family: monospace; background: #eee; padding: 2px 5px; border-radius: 4px; font-size: 14px; }
              img { margin-bottom: 10px; }
              .footer { margin-top: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
            </style>
          </head>
          <body>
            <div class="label-container">
              <img src="${qrUrl}" alt="QR Code" width="150" height="150"/>
              <h2>${eq.name}</h2>
              <p class="meta">${eq.location}</p>
              <span class="id">${eq.id.substring(0, 8)}</span>
              <div class="footer">SindGestor</div>
            </div>
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Delete Handlers
  const handleDeleteEquipmentClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent selection
    setEqToDelete(id);
    setShowDeleteEqModal(true);
  };

  const confirmDeleteEquipment = async () => {
    if (eqToDelete) {
      await db.deleteEquipment(eqToDelete, currentEnterpriseId, userEmail);
      if (selectedEq?.id === eqToDelete) setSelectedEq(null);
      setEqToDelete(null);
      setShowDeleteEqModal(false);
      fetchData();
    }
  };

  const handleDeleteLogClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLogToDelete(id);
    setShowDeleteLogModal(true);
  };

  const confirmDeleteLog = async () => {
    if (logToDelete && selectedEq) {
      await db.deleteMaintenanceLog(logToDelete, currentEnterpriseId, userEmail);
      setLogToDelete(null);
      setShowDeleteLogModal(false);
      setLogs(await db.getMaintenanceLogs(selectedEq.id));
    }
  };

  // Settings / Attributes Management Handlers
  const handleAddAttribute = async () => {
    if (!newAttributeName.trim()) return;
    if (settingsTab === 'CATEGORY') {
      await db.addEquipmentCategory(newAttributeName.trim(), currentEnterpriseId);
    } else {
      await db.addEquipmentLocation(newAttributeName.trim(), currentEnterpriseId);
    }
    setNewAttributeName('');
    fetchData();
  };

  const handleUpdateAttribute = async () => {
    if (!editingAttribute || !editingAttribute.current.trim()) return;
    if (editingAttribute.type === 'CATEGORY') {
      await db.updateEquipmentCategory(editingAttribute.original, editingAttribute.current.trim(), currentEnterpriseId, userEmail);
    } else {
      await db.updateEquipmentLocation(editingAttribute.original, editingAttribute.current.trim(), currentEnterpriseId, userEmail);
    }
    setEditingAttribute(null);
    fetchData();
  };

  const confirmDeleteAttribute = async () => {
    if (!attributeToDelete) return;
    if (attributeToDelete.type === 'CATEGORY') {
      await db.deleteEquipmentCategory(attributeToDelete.name, currentEnterpriseId);
    } else {
      await db.deleteEquipmentLocation(attributeToDelete.name, currentEnterpriseId);
    }
    setAttributeToDelete(null);
    fetchData();
  };

  // Mock Scanning Functionality
  const simulateScan = (eqId: string) => {
    const eq = equipmentList.find(e => e.id === eqId);
    if (eq) {
      setSelectedEq(eq);
      setShowScanner(false);
    } else {
      alert("Equipamento não encontrado.");
    }
  };

  const parseEquipmentId = (text: string): string => {
    const prefix = 'app://equipment/';
    if (text && text.startsWith(prefix)) return text.slice(prefix.length);
    const match = text.match(/[0-9a-fA-F-]{36}/);
    return match ? match[0] : '';
  };

  // Filter Logic
  const filteredEquipment = equipmentList.filter(eq => {
    const matchesSearch =
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory ? eq.category === filterCategory : true;
    return matchesSearch && matchesCategory;
  });

  const isViewOnly = editingLogId && !canEdit;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-8rem)] gap-0 md:gap-6 relative">
      {/* LEFT LIST - Full width on mobile, 1/3 on desktop */}
      <div className={`${selectedEq ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-col`}>
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 pl-14 md:pl-0"><Wrench size={20} className="text-blue-600 hidden md:inline" /> Equipamentos</h2>
          <div className="flex gap-2 shrink-0">
            {canScan && (
              <button onClick={() => setShowScanner(true)} className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center justify-center" title="Ler QR Code"><Scan size={18} /></button>
            )}
            {canEdit && (
              <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-slate-100 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-200 flex items-center justify-center" title="Gerenciar Categorias e Locais"><Settings size={18} /></button>
            )}
            {!readOnly && (
              <button onClick={openNewEqModal} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center" title="Novo Equipamento"><Plus size={18} /></button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-white border-b border-slate-100 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-8 p-2 text-sm border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <select
              className="h-full px-2 py-2 text-sm border rounded-lg bg-slate-50 text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 max-w-[100px]"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">Todas</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {filteredEquipment.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">Nenhum equipamento encontrado.</p>
          )}
          {filteredEquipment.map(eq => (
            <div key={eq.id} onClick={() => setSelectedEq(eq)} className={`p-4 rounded-lg border cursor-pointer transition-all relative group ${selectedEq?.id === eq.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800">{eq.name}</h3>
                  <p className="text-xs text-slate-500">{eq.category} • {eq.location}</p>
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <button onClick={(e) => openEditEqModal(e, eq)} className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition p-1" title="Editar">
                      <Pencil size={16} />
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={(e) => handleDeleteEquipmentClick(e, eq.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1" title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className={`mt-2 text-[10px] font-bold px-2 py-1 rounded inline-block ${eq.status === 'OPERATIONAL' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {eq.status === 'OPERATIONAL' ? 'Operacional' : 'Manutenção'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Backdrop */}
      {selectedEq && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setSelectedEq(null)}
        />
      )}

      {/* RIGHT DETAILS - Slide-in panel on mobile, 2/3 width on desktop */}
      <div className={`
        ${selectedEq ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        fixed md:relative inset-0 md:inset-auto
        w-full md:w-2/3
        bg-white rounded-xl shadow-sm border border-slate-200 
        flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        z-50 md:z-auto
      `}>
        {selectedEq ? (
          <div className="p-6 overflow-y-auto flex-1">
            {/* Mobile Close Button */}
            <button
              onClick={() => setSelectedEq(null)}
              className="md:hidden absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg z-10"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>

            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedEq.name}</h2>
                <p className="text-slate-500 text-sm flex gap-4 mt-1">
                  <span>ID: {selectedEq.id.substring(0, 8)}</span>
                  <span>Cadastro: {new Date(selectedEq.createdAt || Date.now()).toLocaleDateString()}</span>
                </p>
              </div>

              {/* QR Code Display */}
              <div className="flex flex-col items-center p-2 bg-white border rounded shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=app://equipment/${selectedEq.id}`}
                  alt="QR Code"
                  className="w-20 h-20"
                />
                <span className="text-[10px] text-slate-400 mt-1">Scan ID</span>
              </div>
            </div>

            {/* Images Gallery */}
            {(images.length > 0) && (
              <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                {images.map(img => (
                  <div key={img.id} className="w-32 h-32 flex-shrink-0 bg-slate-100 rounded-lg border overflow-hidden">
                    <img src={img.url} className="w-full h-full object-cover" alt="Equipamento" />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-lg text-sm">
              <div><span className="font-bold text-slate-500 block text-xs uppercase">Categoria</span>{selectedEq.category}</div>
              <div><span className="font-bold text-slate-500 block text-xs uppercase">Localização</span>{selectedEq.location}</div>
              <div><span className="font-bold text-slate-500 block text-xs uppercase">Aquisição</span>{selectedEq.acquisitionDate ? new Date(selectedEq.acquisitionDate).toLocaleDateString() : '-'}</div>
              <div><span className="font-bold text-slate-500 block text-xs uppercase">Instalação</span>{new Date(selectedEq.installDate).toLocaleDateString()}</div>
              <div className="col-span-2"><span className="font-bold text-slate-500 block text-xs uppercase">Descrição</span>{selectedEq.description || "Sem descrição."}</div>
            </div>

            <div className="mb-6">
              {canWrite && (
                <div className="flex gap-2 mb-4">
                  <button onClick={openNewMaintModal} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition"><ClipboardCheck size={16} /> Registrar Manutenção</button>
                  <button onClick={() => handlePrintLabel(selectedEq)} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition"><Printer size={16} /> Imprimir Etiqueta</button>
                </div>
              )}

              <h4 className="font-bold text-slate-800 mt-6 mb-3 flex items-center gap-2 text-lg border-b pb-2"><History size={20} /> Histórico de Manutenções</h4>
              <div className="space-y-3">
                {logs.length === 0 && <p className="text-slate-400 text-sm">Nenhuma manutenção registrada.</p>}
                {logs.map(log => (
                  <div
                    key={log.id}
                    onClick={() => openEditLogModal(log)}
                    className={`border-l-4 border-blue-500 pl-4 py-2 bg-slate-50 rounded-r-lg group relative transition hover:bg-blue-50 cursor-pointer`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-700">{new Date(log.date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${log.type === 'PREVENTIVE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{log.type}</span>
                        {canEdit && (
                          <button onClick={(e) => handleDeleteLogClick(e, log.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{log.description}</p>

                    <div className="flex justify-between items-end mt-1">
                      <p className="text-xs text-slate-400">Técnico: {log.technician}</p>
                      {log.signatureUrl && (
                        <div className="text-[10px] flex items-center gap-1 text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-100">
                          <PenTool size={10} /> Assinado
                        </div>
                      )}
                    </div>
                    {!canEdit && <span className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 text-xs text-slate-400">Clique para ver</span>}
                    {canEdit && <span className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 text-xs text-blue-500">Clique para editar</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Wrench size={48} className="mb-4 opacity-20" />
            <p>Selecione um equipamento ou escaneie um QR Code.</p>
          </div>
        )}
      </div>

      {/* DELETE MODALS */}
      {showDeleteEqModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2"><Trash2 size={20} /> Excluir Equipamento?</h3>
            <p className="text-slate-600 mb-6 text-sm">Tem certeza? Isso apagará o equipamento e todo o seu histórico de manutenções.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteEqModal(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={confirmDeleteEquipment} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2"><Trash2 size={20} /> Excluir Log?</h3>
            <p className="text-slate-600 mb-6 text-sm">Confirma a exclusão deste registro de manutenção?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteLogModal(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={confirmDeleteLog} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ATTRIBUTE DELETE CONFIRMATION MODAL */}
      {attributeToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80]">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border-red-100 border">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2"><Trash2 size={20} /> Excluir {attributeToDelete.type === 'CATEGORY' ? 'Categoria' : 'Localização'}?</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Tem certeza que deseja excluir <b>"{attributeToDelete.name}"</b>?
              <br /><br />
              <span className="text-xs text-red-500">Atenção: Equipamentos que usam este atributo não serão excluídos, mas podem ficar com o campo desatualizado ou inconsistente. Recomenda-se atualizar os equipamentos antes.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setAttributeToDelete(null)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={confirmDeleteAttribute} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold">Confirmar Exclusão</button>
            </div>
          </div>
        </div>
      )}

      {/* ATTRIBUTES MANAGEMENT MODAL (SETTINGS) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Gerenciar Atributos</h3>
              <button onClick={() => { setShowSettingsModal(false); setEditingAttribute(null); }}><X /></button>
            </div>

            <div className="flex border-b mb-4">
              <button
                onClick={() => setSettingsTab('CATEGORY')}
                className={`flex-1 py-2 font-medium text-sm border-b-2 transition ${settingsTab === 'CATEGORY' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
              >Categorias</button>
              <button
                onClick={() => setSettingsTab('LOCATION')}
                className={`flex-1 py-2 font-medium text-sm border-b-2 transition ${settingsTab === 'LOCATION' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
              >Localizações</button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder={`Nova ${settingsTab === 'CATEGORY' ? 'Categoria' : 'Localização'}...`}
                value={newAttributeName}
                onChange={e => setNewAttributeName(e.target.value)}
                className="flex-1 p-2 border rounded text-sm"
              />
              <button onClick={handleAddAttribute} disabled={!newAttributeName.trim()} className="bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-50"><Plus size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {(settingsTab === 'CATEGORY' ? categories : locations).map(item => (
                <div key={item} className="flex justify-between items-center bg-slate-50 p-2 rounded group">
                  {editingAttribute?.original === item && editingAttribute.type === settingsTab ? (
                    <div className="flex flex-1 gap-2 items-center">
                      <input
                        autoFocus
                        className="flex-1 p-1 text-sm border rounded"
                        value={editingAttribute.current}
                        onChange={e => setEditingAttribute({ ...editingAttribute, current: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateAttribute(); }}
                      />
                      <button onClick={handleUpdateAttribute} className="text-green-600 bg-green-100 p-1 rounded"><ClipboardCheck size={14} /></button>
                      <button onClick={() => setEditingAttribute(null)} className="text-red-500 bg-red-100 p-1 rounded"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-700">{item}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setEditingAttribute({ original: item, current: item, type: settingsTab })} className="text-slate-400 hover:text-blue-600 p-1"><Pencil size={14} /></button>
                        <button onClick={() => setAttributeToDelete({ name: item, type: settingsTab })} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCANNER OVERLAY */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md aspect-[3/4] bg-black overflow-hidden rounded-lg">
            <video ref={videoRef} className="w-full h-full object-cover"></video>
            <div className="qr-scanner-overlay"></div>
            <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white"><X size={24} /></button>
            <div className="absolute bottom-10 left-0 right-0 flex justify-center">
              <p className="text-white bg-black/50 px-3 py-1 rounded text-sm">Aponte para o QR Code</p>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">{editingEqId ? 'Editar Equipamento' : 'Novo Equipamento'}</h3><button onClick={() => setShowAddModal(false)}><X /></button></div>
            <form onSubmit={handleAddEquipment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                <input required value={newEq.name} onChange={e => setNewEq({ ...newEq, name: e.target.value })} className="w-full p-2 border rounded" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                  <select required value={newEq.category} onChange={e => setNewEq({ ...newEq, category: e.target.value })} className="w-full p-2 border rounded bg-white"><option value="">Selecione...</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Localização</label>
                  <select required value={newEq.location} onChange={e => setNewEq({ ...newEq, location: e.target.value })} className="w-full p-2 border rounded bg-white"><option value="">Selecione...</option>{locations.map(l => <option key={l} value={l}>{l}</option>)}</select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Aquisição</label>
                  <input type="date" required value={newEq.acquisitionDate} onChange={e => setNewEq({ ...newEq, acquisitionDate: e.target.value })} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Instalação</label>
                  <input type="date" required value={newEq.installDate} onChange={e => setNewEq({ ...newEq, installDate: e.target.value })} className="w-full p-2 border rounded" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select value={newEq.status} onChange={e => setNewEq({ ...newEq, status: e.target.value as any })} className="w-full p-2 border rounded bg-white">
                    <option value="OPERATIONAL">Operacional</option>
                    <option value="NEEDS_REPAIR">Precisa de Reparo</option>
                    <option value="OUT_OF_ORDER">Fora de Uso</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                <textarea value={newEq.description} onChange={e => setNewEq({ ...newEq, description: e.target.value })} className="w-full p-2 border rounded h-20" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Imagens (Adicionar)</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 border rounded bg-slate-50 hover:bg-slate-100 text-sm flex items-center gap-2"><ImageIcon size={16} /> Galeria</button>
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="px-3 py-2 border rounded bg-slate-50 hover:bg-slate-100 text-sm flex items-center gap-2"><Camera size={16} /> Câmera</button>
                  <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handleAddImage} />
                  <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleAddImage} />
                </div>
                <div className="flex gap-2">
                  {newImages.map((img, idx) => (
                    <div key={idx} className="w-16 h-16 bg-slate-100 rounded border relative">
                      <img src={img} className="w-full h-full object-cover rounded" />
                      <button type="button" onClick={() => setNewImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2">
                {isSubmitting && <Loader2 className="animate-spin" size={16} />} {editingEqId ? 'Atualizar' : 'Salvar'} Equipamento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MAINTENANCE ADD/EDIT/VIEW MODAL */}
      {showMaintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4"><h3 className="font-bold">{editingLogId ? (canEdit ? 'Editar Manutenção' : 'Detalhes da Manutenção') : 'Nova Manutenção'}</h3><button onClick={() => setShowMaintModal(false)}><X /></button></div>
            <form onSubmit={handleAddMaintenance} className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase">Data</label><input type="date" disabled={!!(editingLogId && !canEdit)} value={newMaint.date} onChange={e => setNewMaint({ ...newMaint, date: e.target.value })} className="w-full p-2 border rounded disabled:bg-slate-100" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Tipo</label><select disabled={!!(editingLogId && !canEdit)} value={newMaint.type} onChange={e => setNewMaint({ ...newMaint, type: e.target.value as any })} className="w-full p-2 border rounded disabled:bg-slate-100"><option value="PREVENTIVE">Preventiva</option><option value="CORRECTIVE">Corretiva</option></select></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Técnico</label><input type="text" disabled={!!(editingLogId && !canEdit)} value={newMaint.technician} onChange={e => setNewMaint({ ...newMaint, technician: e.target.value })} className="w-full p-2 border rounded disabled:bg-slate-100" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Descrição</label><textarea disabled={!!(editingLogId && !canEdit)} value={newMaint.description} onChange={e => setNewMaint({ ...newMaint, description: e.target.value })} className="w-full p-2 border rounded h-24 disabled:bg-slate-100" /></div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Assinatura</label>

                {/* Desktop: Inline Signature Pad */}
                <div className="hidden md:block">
                  <SignaturePad
                    onSave={(sign) => setNewMaint({ ...newMaint, signatureUrl: sign })}
                    initialSignature={newMaint.signatureUrl}
                    readOnly={!!(editingLogId && !canEdit)}
                  />
                </div>

                {/* Mobile: Button to open fullscreen signature */}
                <div className="md:hidden">
                  {newMaint.signatureUrl ? (
                    <div className="relative">
                      <img src={newMaint.signatureUrl} alt="Assinatura" className="border rounded w-full h-32 object-contain bg-white" />
                      {!(editingLogId && !canEdit) && (
                        <button
                          type="button"
                          onClick={() => setShowFullscreenSignature(true)}
                          className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowFullscreenSignature(true)}
                      disabled={!!(editingLogId && !canEdit)}
                      className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-slate-400 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <PenTool size={20} />
                      <span>Assinar</span>
                    </button>
                  )}
                </div>
              </div>

              {(canEdit || !editingLogId) && (
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">{editingLogId ? 'Atualizar' : 'Salvar'} Manutenção</button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN SIGNATURE MODAL (Mobile Only) */}
      {showFullscreenSignature && (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col landscape:flex-row">
          {/* Landscape Orientation Hint (Portrait Only) */}
          <div className="portrait:block landscape:hidden signature-landscape-hint">
            📱 Vire o celular para o lado para melhor experiência
          </div>

          {/* Header - Top on portrait, Left on landscape */}
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center landscape:flex-col landscape:justify-start landscape:w-20 landscape:gap-4">
            <h3 className="font-bold text-lg landscape:hidden">Assinatura do Técnico</h3>
            <h3 className="hidden landscape:block font-bold text-sm writing-mode-vertical transform rotate-180 text-center">Assinatura</h3>
            <button
              onClick={() => setShowFullscreenSignature(false)}
              className="p-2 hover:bg-slate-800 rounded"
            >
              <X size={24} />
            </button>
          </div>

          {/* Signature Area - Optimized for landscape */}
          <div className="flex-1 flex items-center justify-center p-4 bg-slate-50 landscape:p-2">
            <div className="w-full h-full max-w-4xl flex items-center justify-center">
              <div className="w-full landscape:w-full landscape:h-full">
                <SignaturePad
                  onSave={(sign) => setNewMaint({ ...newMaint, signatureUrl: sign })}
                  initialSignature={newMaint.signatureUrl}
                  readOnly={false}
                />
              </div>
            </div>
          </div>

          {/* Footer - Bottom on portrait, Right on landscape */}
          <div className="p-4 bg-white border-t landscape:border-t-0 landscape:border-l landscape:w-24 landscape:flex landscape:items-center">
            <button
              onClick={() => setShowFullscreenSignature(false)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg landscape:py-6 landscape:text-sm landscape:writing-mode-vertical landscape:transform landscape:rotate-180"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
