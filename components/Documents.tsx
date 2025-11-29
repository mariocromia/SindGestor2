import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/db';
import { Document, PermissionLevel } from '../types';
import { FileText, Download, Calendar, Upload, Search, Filter, Trash2, X, Plus, Settings, Pencil, ClipboardCheck } from 'lucide-react';

interface DocumentsProps {
  currentEnterpriseId: string;
  permissionLevel: PermissionLevel;
  userEmail: string;
}

export const Documents: React.FC<DocumentsProps> = ({ currentEnterpriseId, permissionLevel, userEmail }) => {
  const [docs, setDocs] = useState<Document[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Date Range Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Upload/Edit Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  // Category Management State
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<{ original: string, current: string } | null>(null);
  const [catToDelete, setCatToDelete] = useState<string | null>(null);

  // Form State
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('');
  const [newDocDate, setNewDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canWrite = permissionLevel === PermissionLevel.READ_WRITE || permissionLevel === PermissionLevel.FULL_ACCESS;
  const canDelete = permissionLevel === PermissionLevel.FULL_ACCESS;
  const canEdit = permissionLevel === PermissionLevel.FULL_ACCESS; // Managing categories requires full access

  useEffect(() => {
    fetchDocs();
    fetchCategories();
  }, [currentEnterpriseId]);

  const fetchDocs = async () => {
    const data = await db.getDocuments(currentEnterpriseId);
    setDocs(data);
  };

  const fetchCategories = async () => {
    const cats = await db.getDocumentCategories(currentEnterpriseId);
    setCategories(cats);
    if (cats.length > 0 && !newDocCategory) setNewDocCategory(cats[0]);
  };

  const handleDownload = (url: string) => {
    if (url && url !== '#') {
      const link = document.createElement("a");
      link.href = url;
      link.download = "documento_sindgestor";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    else alert("Arquivo indisponível.");
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja excluir este documento?")) {
      await db.deleteDocument(id, currentEnterpriseId, userEmail);
      fetchDocs();
    }
  };

  const openUploadModal = () => {
    setEditingDocId(null);
    setNewDocTitle('');
    setNewDocCategory(categories[0] || '');
    setNewDocDate(new Date().toISOString().split('T')[0]);
    setNewDocFile(null);
    setShowUploadModal(true);
  };

  const openEditDocModal = (doc: Document) => {
    setEditingDocId(doc.id);
    setNewDocTitle(doc.title);
    setNewDocCategory(doc.category);
    setNewDocDate(doc.date.split('T')[0]);
    setNewDocFile(null); // Editing doesn't require re-uploading file
    setShowUploadModal(true);
  };

  const handleUploadOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle || !newDocCategory) return;

    setIsUploading(true);

    if (editingDocId) {
      // Update existing document metadata
      await db.updateDocument(editingDocId, {
        title: newDocTitle,
        category: newDocCategory,
        date: newDocDate
      }, currentEnterpriseId, userEmail);
    } else {
      // Create new document
      if (!newDocFile) { alert("Selecione um arquivo."); setIsUploading(false); return; }
      await db.addDocument({
        title: newDocTitle,
        category: newDocCategory,
        file: newDocFile,
        date: newDocDate
      }, currentEnterpriseId, userEmail);
    }

    setIsUploading(false);
    setShowUploadModal(false);
    fetchDocs();
  };

  // Category Management Handlers
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    await db.addDocumentCategory(newCatName.trim(), currentEnterpriseId);
    setNewCatName('');
    fetchCategories();
  };

  const handleUpdateCategory = async () => {
    if (!editingCat || !editingCat.current.trim()) return;
    await db.updateDocumentCategory(editingCat.original, editingCat.current.trim(), currentEnterpriseId, userEmail);
    setEditingCat(null);
    fetchCategories();
    fetchDocs(); // Refresh docs as category names might have changed
  };

  const confirmDeleteCategory = async () => {
    if (!catToDelete) return;
    await db.deleteDocumentCategory(catToDelete, currentEnterpriseId);
    setCatToDelete(null);
    fetchCategories();
  };

  const filteredDocs = docs.filter(doc => {
    const matchSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCategory ? doc.category === filterCategory : true;

    let matchDate = true;
    const docDate = doc.date.split('T')[0];
    if (filterStartDate) matchDate = docDate >= filterStartDate;
    if (filterEndDate && matchDate) matchDate = docDate <= filterEndDate;

    return matchSearch && matchCat && matchDate;
  });

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-lg md:text-2xl font-bold text-slate-800 pl-14 md:pl-0">Documentação do Condomínio</h2>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <button onClick={() => setShowCatModal(true)} className="bg-slate-100 border border-slate-300 text-slate-600 p-2 md:px-3 md:py-2 rounded-lg hover:bg-slate-200 transition flex items-center justify-center" title="Gerenciar Categorias">
              <Settings size={18} className="md:hidden" />
              <Settings size={20} className="hidden md:block" />
            </button>
          )}
          {canWrite && (
            <button
              onClick={openUploadModal}
              className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Upload size={16} className="md:hidden" />
              <Upload size={18} className="hidden md:block" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 flex-wrap items-end">
        <div className="flex-1 relative min-w-[200px] w-full">
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Nome do documento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-2.5 border rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>
        </div>
        <div className="relative w-full md:w-48">
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoria</label>
          <div className="relative">
            <Filter className="absolute left-3 top-3 text-slate-400" size={18} />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full pl-10 p-2.5 border rounded-lg bg-slate-50 focus:bg-white appearance-none"
            >
              <option value="">Todas</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="relative w-full md:w-auto flex gap-2">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">De</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="w-full p-2.5 border rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Até</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="w-full p-2.5 border rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>
        </div>
        {(searchTerm || filterCategory || filterStartDate || filterEndDate) && (
          <button onClick={() => { setSearchTerm(''); setFilterCategory(''); setFilterStartDate(''); setFilterEndDate(''); }} className="p-2.5 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-100 mb-[1px]"><X /></button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-medium border-b border-slate-200">
            <tr>
              <th className="px-3 md:px-6 py-3">Documento</th>
              <th className="px-2 md:px-6 py-3 text-center">Categoria</th>
              {/* Mobile: Combined Date+Action column */}
              <th className="px-1 py-3 md:hidden">Data/Ação</th>
              {/* Desktop: Separate Date and Action columns */}
              <th className="hidden md:table-cell px-6 py-3">Data Doc.</th>
              <th className="hidden md:table-cell px-6 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDocs.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Nenhum documento encontrado.</td></tr>
            )}
            {filteredDocs.map(doc => (
              <tr key={doc.id} className="hover:bg-slate-50 transition group">
                <td className="px-3 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                      <FileText size={16} className="md:hidden" />
                      <FileText size={20} className="hidden md:block" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700 block text-xs md:text-sm leading-tight truncate">{doc.title}</span>
                      <span className="text-[9px] md:text-[10px] text-slate-400 uppercase">{doc.fileType || 'FILE'}</span>
                    </div>
                  </div>
                </td>
                <td className="px-2 md:px-6 py-3 md:py-4">
                  <div className="flex justify-center">
                    <span className="bg-slate-100 text-slate-600 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-center leading-tight max-w-[80px] md:max-w-none">{doc.category}</span>
                  </div>
                </td>
                {/* Mobile: Date + Download in same cell */}
                <td className="px-1 py-3 md:hidden">
                  <div className="flex items-center gap-1 justify-between">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Calendar size={12} className="shrink-0" />
                      <span className="text-[10px] whitespace-nowrap">{new Date(doc.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                    </div>
                    <button onClick={() => handleDownload(doc.url)} className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50 transition shrink-0" title="Baixar">
                      <Download size={16} />
                    </button>
                  </div>
                </td>
                {/* Desktop: Separate Date and Actions columns */}
                <td className="hidden md:table-cell px-6 py-4 text-slate-500">
                  <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                    <Calendar size={14} className="shrink-0" />
                    <span>{new Date(doc.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                  </div>
                </td>
                <td className="hidden md:table-cell px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleDownload(doc.url)} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition" title="Baixar">
                      <Download size={20} />
                    </button>
                    {canEdit && (
                      <button onClick={() => openEditDocModal(doc)} className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition opacity-0 group-hover:opacity-100" title="Editar">
                        <Pencil size={20} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(doc.id)} className="text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition opacity-0 group-hover:opacity-100" title="Excluir">
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{editingDocId ? 'Editar Documento' : 'Upload de Documento'}</h3><button onClick={() => setShowUploadModal(false)}><X /></button></div>
            <form onSubmit={handleUploadOrUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                <input type="text" required value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} className="w-full p-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                  <select required value={newDocCategory} onChange={e => setNewDocCategory(e.target.value)} className="w-full p-2 border rounded-lg">
                    <option value="">Selecione...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data do Documento</label>
                  <input type="date" required value={newDocDate} onChange={e => setNewDocDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                </div>
              </div>

              {!editingDocId && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Arquivo</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:bg-slate-50" onClick={() => fileInputRef.current?.click()}>
                    {newDocFile ? (
                      <div className="text-sm font-bold text-blue-600">{newDocFile.name}</div>
                    ) : (
                      <div className="text-slate-400 flex flex-col items-center">
                        <Upload size={24} className="mb-2" />
                        <span className="text-sm">Clique para selecionar</span>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" onChange={e => e.target.files && setNewDocFile(e.target.files[0])} />
                  </div>
                </div>
              )}

              <button type="submit" disabled={isUploading} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold disabled:opacity-50">{isUploading ? 'Processando...' : (editingDocId ? 'Atualizar Documento' : 'Salvar Documento')}</button>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MANAGEMENT MODAL */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Gerenciar Categorias</h3>
              <button onClick={() => { setShowCatModal(false); setEditingCat(null); }}><X /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Nova Categoria..."
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                className="flex-1 p-2 border rounded text-sm"
              />
              <button onClick={handleAddCategory} disabled={!newCatName.trim()} className="bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-50"><Plus size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {categories.map(cat => (
                <div key={cat} className="flex justify-between items-center bg-slate-50 p-2 rounded group">
                  {editingCat?.original === cat ? (
                    <div className="flex flex-1 gap-2 items-center">
                      <input
                        autoFocus
                        className="flex-1 p-1 text-sm border rounded"
                        value={editingCat.current}
                        onChange={e => setEditingCat({ ...editingCat, current: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateCategory(); }}
                      />
                      <button onClick={handleUpdateCategory} className="text-green-600 bg-green-100 p-1 rounded"><ClipboardCheck size={14} /></button>
                      <button onClick={() => setEditingCat(null)} className="text-red-500 bg-red-100 p-1 rounded"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-700">{cat}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setEditingCat({ original: cat, current: cat })} className="text-slate-400 hover:text-blue-600 p-1"><Pencil size={14} /></button>
                        <button onClick={() => setCatToDelete(cat)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY CONFIRMATION */}
      {catToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border-red-100 border">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2"><Trash2 size={20} /> Excluir Categoria?</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Confirma a exclusão de <b>"{catToDelete}"</b>?
              <br /><br />
              <span className="text-xs text-red-500">Documentos vinculados não serão apagados, mas ficarão com a categoria desatualizada.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCatToDelete(null)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={confirmDeleteCategory} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
