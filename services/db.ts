import { supabase } from './supabaseClient';
import { User, UserRole, PermissionLevel, Equipment, Task, WaterReading, Supplier, Document, MaintenanceLog, Membership, AuditLog, MODULES, TaskComment, TaskAttachment, EquipmentImage, StructuralIssue, StructuralPhoto } from '../types';

// --- SECURITY UTILS ---
const hashPassword = async (password: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper for generic error handling
const handleError = (error: any, context: string) => {
  if (!error) return;
  
  let errorMessage = 'Erro desconhecido';
  
  try {
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object') {
      // Safely extract message from object
      errorMessage = error.message || error.error_description || error.details || (error.code ? `Código SQL: ${error.code}` : JSON.stringify(error));
    }
  } catch (e) {
    errorMessage = "Erro ao processar mensagem de erro";
  }

  console.error(`Error in ${context}:`, errorMessage, error);
  
  // Specific Error Traps
  if (errorMessage.includes("schema cache") || errorMessage.includes("acquisition_date") || errorMessage.includes("equipment_images") || errorMessage.includes("signature_url") || errorMessage.includes("structural_issues") || errorMessage.includes("notify_admin") || errorMessage.includes("document_categories")) {
    alert(`ERRO DE SCHEMA: O banco de dados está desatualizado.\n\nPor favor, vá ao Dashboard, baixe o Script de Migração V17 e execute-o no Supabase.`);
  } else if (errorMessage.includes("Could not find the table") || errorMessage.includes("does not exist") || errorMessage.includes("42P01")) {
    alert(`ERRO DE BANCO DE DADOS: Tabela não encontrada.\n\nExecute o script de migração no Supabase.`);
  } else if (errorMessage.includes("duplicate key")) {
    alert(`Erro ao ${context}: Já existe um registro com este identificador.`);
  } else {
    // Ensure we alert a string
    alert(`Erro ao ${context}: ${String(errorMessage)}`);
  }
};

// --- AUDIT LOGGING ---
const logAction = async (enterpriseId: string, userEmail: string, action: string, details: string) => {
  try {
    supabase.from('audit_logs').insert([{
      enterprise_id: enterpriseId,
      user_email: userEmail,
      action: action,
      details: details
    }]).then(({ error }) => {
      if (error) console.error("Failed to write audit log:", error);
    });
  } catch (e) {
    console.error("Audit Log Exception:", e);
  }
};

// --- NOTIFICATIONS MOCK ---
const sendMockEmail = (to: string, subject: string, body: string) => {
  console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
};

// --- UTILS (OPTIMIZED IMAGE COMPRESSION) ---
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If it's an image, compress it
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize logic: Max 1024px dimension
          const MAX_SIZE = 1024;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // Draw resized image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            resolve(compressedBase64);
          } else {
            // Fallback if canvas fails
            resolve(event.target?.result as string);
          }
        };
        img.onerror = (e) => reject(e);
      };
      reader.onerror = (e) => reject(e);
    } else {
      // Normal file processing for non-images (PDFs, etc)
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    }
  });
};

// MAPPERS
const mapEquipment = (data: any): Equipment => ({
  id: data.id,
  enterpriseId: data.enterprise_id,
  name: data.name,
  category: data.category,
  location: data.location,
  description: data.description,
  installDate: data.install_date,
  acquisitionDate: data.acquisition_date,
  lastMaintenance: data.last_maintenance,
  nextMaintenance: data.next_maintenance,
  qrCodeUrl: data.qr_code_url,
  status: data.status,
  createdAt: data.created_at
});

const mapTask = (data: any): Task => ({
  id: data.id,
  enterpriseId: data.enterprise_id,
  enterpriseName: data.enterprises?.name,
  title: data.title,
  assignedTo: data.assigned_to,
  status: data.status,
  dueDate: data.due_date,
  description: data.description,
  audioDescription: data.audio_description,
  notifyAssignee: data.notify_assignee,
  createdAt: data.created_at
});

const mapWaterReading = (data: any): WaterReading => ({
  id: data.id,
  enterpriseId: data.enterprise_id,
  unit: data.unit,
  date: data.date,
  reading: data.reading,
  previousReading: data.previous_reading
});

const mapStructuralIssue = (data: any): StructuralIssue => ({
  id: data.id,
  enterpriseId: data.enterprise_id,
  title: data.title,
  description: data.description,
  location: data.location,
  priority: data.priority,
  status: data.status,
  reportedBy: data.reported_by,
  notifyAdmin: data.notify_admin,
  createdAt: data.created_at,
  resolvedAt: data.resolved_at
});

export const db = {
  // --- AUTH & MEMBERSHIPS ---
  login: async (email: string, password: string): Promise<User | null> => {
    try {
      const hashedPassword = await hashPassword(password);
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Check Credentials in app_users
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('password_hash', hashedPassword)
        .single();

      if (userError || !userData) {
        if (userError?.code === '42P01') {
           alert("ERRO CRÍTICO: Tabelas de autenticação (app_users) não encontradas. Execute o Script de Migração V14.");
           return null;
        }
        return null;
      }

      // 2. Fetch Memberships
      const { data, error } = await supabase
        .from('memberships')
        .select('*, enterprises(name)')
        .eq('user_email', normalizedEmail);

      if (error) return null;
      if (!data || data.length === 0) return null;

      const memberships: Membership[] = data.map((m: any) => {
        let entName = m.enterprises?.name || 'Desconhecido';
        if (entName === 'Condomínio de Condominio') entName = 'Condomínio Assembleia 66';
        
        return {
          enterpriseId: m.enterprise_id,
          enterpriseName: entName,
          role: m.role as UserRole,
          permissions: m.permissions || {},
          notifications: m.notifications || {}
        };
      });

      // Log Login Action
      memberships.forEach(m => logAction(m.enterpriseId, normalizedEmail, 'LOGIN', 'Usuário acessou o sistema'));

      return {
        id: normalizedEmail,
        email: normalizedEmail,
        name: userData.name || normalizedEmail.split('@')[0],
        memberships
      };
    } catch (e) {
      console.error("Login Exception:", e);
      return null;
    }
  },

  registerSystemUser: async (name: string, email: string, password: string, enterpriseName?: string): Promise<{ success: boolean, message: string }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const hashedPassword = await hashPassword(password);

      const { data: existing } = await supabase.from('app_users').select('email').eq('email', normalizedEmail).single();
      if (existing) {
        return { success: false, message: "E-mail já cadastrado no sistema." };
      }

      const { error: userError } = await supabase.from('app_users').insert([{
        email: normalizedEmail,
        name: name,
        password_hash: hashedPassword
      }]);
      if (userError) throw userError;

      const finalEnterpriseName = enterpriseName && enterpriseName.trim() ? enterpriseName : `Condomínio Assembleia 66`;
      const { data: entData, error: entError } = await supabase
        .from('enterprises')
        .insert([{ name: finalEnterpriseName }])
        .select('id')
        .single();
      
      if (entError || !entData) throw new Error("Erro ao criar condomínio padrão.");
      const newEnterpriseId = entData.id;

      const adminPermissions: any = {};
      Object.values(MODULES).forEach(m => adminPermissions[m] = PermissionLevel.FULL_ACCESS);
      
      const adminNotifications: any = {};
      Object.values(MODULES).forEach(m => adminNotifications[m] = true);

      const { error: memError } = await supabase.from('memberships').insert([{
        enterprise_id: newEnterpriseId,
        user_email: normalizedEmail,
        user_name: name,
        role: UserRole.ADMIN,
        permissions: adminPermissions,
        notifications: adminNotifications
      }]);

      if (memError) throw memError;

      await db.addUnit('Unidade 101', newEnterpriseId, normalizedEmail);
      await db.addEquipmentCategory('Geral', newEnterpriseId);
      await db.addEquipmentLocation('Portaria', newEnterpriseId);
      // Seed default document categories
      ['Geral', 'Financeiro', 'Atas', 'Regimentos', 'Manuais', 'Plantas'].forEach(cat => db.addDocumentCategory(cat, newEnterpriseId));

      return { success: true, message: "Conta criada com sucesso! Faça login para continuar." };
    } catch (e: any) {
      return { success: false, message: e.message || "Erro ao criar conta." };
    }
  },

  resetPasswordRequest: async (email: string): Promise<boolean> => {
     const { data } = await supabase.from('app_users').select('email').eq('email', email.toLowerCase()).single();
     if (data) return true; 
     return false;
  },

  changePassword: async (email: string, newPassword: string): Promise<boolean> => {
    const hashedPassword = await hashPassword(newPassword);
    const { error } = await supabase
      .from('app_users')
      .update({ password_hash: hashedPassword })
      .eq('email', email);
    if (error) { handleError(error, "alterar senha"); return false; }
    return true;
  },

  registerMember: async (
    currentEnterpriseId: string, 
    currentUserEmail: string, 
    email: string, 
    name: string, 
    role: string, 
    permissions: Record<string, PermissionLevel>,
    notifications: Record<string, boolean>,
    password?: string
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    
    const { data: existingUser } = await supabase.from('app_users').select('email').eq('email', normalizedEmail).single();
    
    if (!existingUser) {
      if (!password) { alert("Senha é obrigatória para novos usuários."); return; }
      const hashedPassword = await hashPassword(password);
      const { error: createError } = await supabase.from('app_users').insert([{
        email: normalizedEmail,
        name: name,
        password_hash: hashedPassword
      }]);
      if (createError) { handleError(createError, "criar usuário base"); return; }
    } else if (password) {
      const hashedPassword = await hashPassword(password);
      await supabase.from('app_users').update({ name, password_hash: hashedPassword }).eq('email', normalizedEmail);
    }

    const { error } = await supabase.from('memberships').insert([{
      enterprise_id: currentEnterpriseId,
      user_email: normalizedEmail,
      user_name: name,
      role: role,
      permissions: permissions,
      notifications: notifications
    }]);
    
    if (!error) {
      logAction(currentEnterpriseId, currentUserEmail, 'CADASTRAR_USUARIO', `Cadastrou ${normalizedEmail} como ${role}`);
    } else {
      handleError(error, "cadastrar vínculo");
    }
  },

  updateMember: async (
    currentEnterpriseId: string, 
    currentUserEmail: string, 
    targetEmail: string, 
    name: string, 
    role: string, 
    permissions: Record<string, PermissionLevel>, 
    notifications: Record<string, boolean>,
    newPassword?: string
  ) => {
    if (newPassword) {
       const hashedPassword = await hashPassword(newPassword);
       await supabase.from('app_users').update({ name, password_hash: hashedPassword }).eq('email', targetEmail);
    } else {
       await supabase.from('app_users').update({ name }).eq('email', targetEmail);
    }

    const { error } = await supabase.from('memberships')
      .update({ 
        user_name: name,
        role: role,
        permissions: permissions,
        notifications: notifications
      })
      .eq('enterprise_id', currentEnterpriseId)
      .eq('user_email', targetEmail);

    if (!error) {
      logAction(currentEnterpriseId, currentUserEmail, 'ATUALIZAR_USUARIO', `Atualizou ${targetEmail}`);
    } else {
      handleError(error, "atualizar usuário");
    }
  },

  deleteMember: async (currentEnterpriseId: string, currentUserEmail: string, targetEmail: string) => {
    const { error } = await supabase.from('memberships')
      .delete()
      .eq('enterprise_id', currentEnterpriseId)
      .eq('user_email', targetEmail);

    if (!error) {
      logAction(currentEnterpriseId, currentUserEmail, 'EXCLUIR_USUARIO', `Removeu acesso de ${targetEmail}`);
    } else {
      handleError(error, "excluir usuário");
    }
  },

  getEnterpriseUsers: async (enterpriseId: string): Promise<Membership[]> => {
    const { data, error } = await supabase
      .from('memberships')
      .select('*')
      .eq('enterprise_id', enterpriseId);
      
    if (error) return [];
    
    return data.map((m: any) => ({
      enterpriseId: m.enterprise_id,
      enterpriseName: '',
      role: m.role as UserRole,
      permissions: m.permissions || {},
      notifications: m.notifications || {},
      userName: m.user_name,
      userEmail: m.user_email
    } as any));
  },

  getAuditLogs: async (enterpriseId: string, filters?: { user?: string, action?: string, startDate?: string, endDate?: string }): Promise<AuditLog[]> => {
    let query = supabase.from('audit_logs').select('*').eq('enterprise_id', enterpriseId).order('created_at', { ascending: false });
    if (filters) {
      if (filters.user) query = query.ilike('user_email', `%${filters.user}%`);
      if (filters.action) query = query.eq('action', filters.action);
      if (filters.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00`);
      if (filters.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59`);
      query = query.limit(500);
    } else { query = query.limit(50); }
    const { data, error } = await query;
    if (error) return [];
    return data.map((l: any) => ({
      id: l.id,
      enterpriseId: l.enterprise_id,
      userEmail: l.user_email,
      action: l.action,
      details: l.details,
      createdAt: l.created_at
    }));
  },
  
  // --- ENTERPRISE SETTINGS ---
  updateEnterpriseSettings: async (enterpriseId: string, userEmail: string, settings: any) => {
     const { error } = await supabase.from('enterprises').update({ settings }).eq('id', enterpriseId);
     if(!error) logAction(enterpriseId, userEmail, 'ATUALIZAR_CONFIG', 'Atualizou configurações do condomínio');
     else handleError(error, "atualizar configurações");
  },
  
  getEnterpriseSettings: async (enterpriseId: string): Promise<any> => {
     const { data } = await supabase.from('enterprises').select('settings').eq('id', enterpriseId).single();
     return data?.settings || {};
  },

  // --- GENERIC GETS (Filtered by Enterprise) ---
  
  getUnits: async (enterpriseId: string): Promise<string[]> => {
    const { data, error } = await supabase.from('units').select('name').eq('enterprise_id', enterpriseId).order('name');
    if (error) return [];
    return (data || []).map((u: any) => u.name);
  },

  addUnit: async (unitName: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error } = await supabase.from('units').insert([{ name: unitName, enterprise_id: enterpriseId }]);
    if (!error) logAction(enterpriseId, userEmail, 'CRIAR_UNIDADE', `Nova unidade: ${unitName}`);
    else handleError(error, "adicionar unidade");
  },

  deleteUnit: async (unitName: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error } = await supabase.from('units').delete().eq('name', unitName).eq('enterprise_id', enterpriseId);
    if (!error) logAction(enterpriseId, userEmail, 'EXCLUIR_UNIDADE', `Excluiu unidade: ${unitName}`);
    else handleError(error, "excluir unidade");
  },

  // --- WATER ---
  getWaterReadings: async (enterpriseId: string): Promise<WaterReading[]> => {
    const { data, error } = await supabase.from('water_readings').select('*').eq('enterprise_id', enterpriseId).order('date', { ascending: false });
    if (error) return [];
    return (data || []).map(mapWaterReading);
  },

  addWaterReading: async (reading: Omit<WaterReading, 'id' | 'previousReading'>, userEmail: string): Promise<void> => {
    try {
      // 1. Get Previous Reading
      const { data: lastReadings } = await supabase.from('water_readings').select('reading').eq('enterprise_id', reading.enterpriseId).eq('unit', reading.unit).order('date', { ascending: false }).limit(1);
      const previousReadingValue = lastReadings && lastReadings.length > 0 ? lastReadings[0].reading : reading.reading;

      // 2. Insert
      const { error } = await supabase.from('water_readings').insert([{
        enterprise_id: reading.enterpriseId,
        unit: reading.unit,
        date: reading.date,
        reading: reading.reading,
        previous_reading: previousReadingValue
      }]);
      if (error) throw error;
      
      const consumption = reading.reading - previousReadingValue;
      logAction(reading.enterpriseId, userEmail, 'REGISTRAR_LEITURA', `Unidade ${reading.unit}: ${reading.reading}m³`);

      // 3. CHECK ALERTS
      const { data: ent } = await supabase.from('enterprises').select('settings').eq('id', reading.enterpriseId).single();
      const limit = ent?.settings?.waterLimit || 999999;
      
      if (consumption > limit) {
         console.log(`[ALERT] High Consumption: ${consumption} > ${limit}`);
         sendMockEmail(userEmail, "Alerta de Consumo Elevado", `A unidade ${reading.unit} registrou um consumo de ${consumption.toFixed(2)}m³, acima do limite de ${limit}m³.`);
      }

    } catch (e: any) { handleError(e, "salvar leitura"); }
  },

  updateWaterReading: async (id: string, reading: { date: string, reading: number }, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error } = await supabase.from('water_readings').update(reading).eq('id', id);
    if (!error) logAction(enterpriseId, userEmail, 'EDITAR_LEITURA', `Atualizou leitura ID ${id.substring(0,6)}`);
    else handleError(error, "atualizar leitura");
  },

  deleteWaterReading: async (id: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error } = await supabase.from('water_readings').delete().eq('id', id);
    if (!error) logAction(enterpriseId, userEmail, 'EXCLUIR_LEITURA', `Removeu leitura ID ${id.substring(0,6)}`);
    else handleError(error, "excluir leitura");
  },

  // --- TASKS ---
  getTasks: async (userEmail: string, permissionLevel: PermissionLevel, currentEnterpriseId: string): Promise<Task[]> => {
    try {
      let query = supabase.from('tasks').select('*, enterprises(name)').eq('enterprise_id', currentEnterpriseId);
      if (permissionLevel !== PermissionLevel.FULL_ACCESS) { query = query.eq('assigned_to', userEmail.toLowerCase()); }
      const { data, error } = await query.order('due_date', { ascending: true });
      if (error) return [];
      return (data || []).map(mapTask);
    } catch (e) { return []; }
  },

  getUnifiedTasks: async (userEmail: string, memberships: Membership[]): Promise<Task[]> => {
    try {
      const promises = memberships.map(m => {
        const perm = m.permissions[MODULES.TASKS] || PermissionLevel.NONE;
        if (perm === PermissionLevel.NONE) return Promise.resolve([]);
        return db.getTasks(userEmail, perm, m.enterpriseId);
      });
      const results = await Promise.all(promises);
      const allTasks = results.flat();
      return allTasks.sort((a, b) => { const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0; const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0; return dateA - dateB; });
    } catch (e) { return []; }
  },

  addTask: async (task: Omit<Task, 'id' | 'enterpriseName'>, userEmail: string): Promise<Task | null> => {
    if (!task.assignedTo) { alert("Erro: Responsável é obrigatório."); return null; }
    const insertPayload: any = {
      enterprise_id: task.enterpriseId,
      title: task.title,
      description: task.description,
      assigned_to: task.assignedTo.toLowerCase(),
      status: task.status,
      due_date: task.dueDate,
      notify_assignee: task.notifyAssignee ?? true
    };
    if (task.audioDescription !== undefined) insertPayload.audio_description = task.audioDescription;
    const { data, error } = await supabase.from('tasks').insert([insertPayload]).select().single();

    if (!error && data) {
       logAction(task.enterpriseId, userEmail, 'CRIAR_TAREFA', `Tarefa: "${task.title}" para ${task.assignedTo}`);
       if (task.notifyAssignee !== false) {
         sendMockEmail(task.assignedTo, "Nova Tarefa Atribuída", `Você recebeu uma nova tarefa: ${task.title}`);
       }
       return mapTask(data);
    } else {
       handleError(error, "adicionar tarefa");
       return null;
    }
  },

  updateTask: async (id: string, task: Partial<Task>, enterpriseId: string, userEmail: string): Promise<void> => {
    let taskTitle = task.title;
    if (!taskTitle) {
      const { data } = await supabase.from('tasks').select('title').eq('id', id).single();
      taskTitle = data?.title || 'Desconhecida';
    }
    const updates: any = {};
    if (task.title !== undefined) updates.title = task.title;
    if (task.description !== undefined) updates.description = task.description;
    if (task.audioDescription !== undefined) updates.audio_description = task.audioDescription;
    if (task.assignedTo !== undefined) updates.assigned_to = task.assignedTo.toLowerCase();
    if (task.status !== undefined) updates.status = task.status;
    if (task.dueDate !== undefined) updates.due_date = task.dueDate;
    if (task.notifyAssignee !== undefined) updates.notify_assignee = task.notifyAssignee;
    
    const { error } = await supabase.from('tasks').update(updates).eq('id', id);
    
    if (!error) {
       let details = `Tarefa "${taskTitle}"`;
       if (task.status) details += ` -> Status: ${task.status}`;
       logAction(enterpriseId, userEmail, 'ATUALIZAR_TAREFA', details);

       if (task.notifyAssignee && task.assignedTo) {
         sendMockEmail(task.assignedTo, "Tarefa Atualizada", `A tarefa "${taskTitle}" foi atualizada.`);
       }
    }
    else handleError(error, "atualizar tarefa");
  },

  deleteTask: async (id: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { data: taskData } = await supabase.from('tasks').select('title').eq('id', id).single();
    const taskTitle = taskData?.title || id;

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      logAction(enterpriseId, userEmail, 'EXCLUIR_TAREFA', `Excluiu tarefa: "${taskTitle}"`);
    } else {
      handleError(error, "excluir tarefa");
    }
  },

  getTaskComments: async (taskId: string): Promise<TaskComment[]> => {
    const { data, error } = await supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
    if (error) return [];
    return data.map((c: any) => ({ id: c.id, taskId: c.task_id, userEmail: c.user_email, userName: c.user_name, content: c.content, contentType: c.content_type, createdAt: c.created_at }));
  },

  addTaskComment: async (taskId: string, userEmail: string, userName: string, content: string, type: 'TEXT' | 'AUDIO'): Promise<void> => {
    const { error } = await supabase.from('task_comments').insert([{ task_id: taskId, user_email: userEmail, user_name: userName, content: content, content_type: type }]);
    if (error) handleError(error, "adicionar comentário");
  },

  getTaskAttachments: async (taskId: string): Promise<TaskAttachment[]> => {
    const { data, error } = await supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map((a: any) => ({ id: a.id, taskId: a.task_id, type: a.type, url: a.url, createdAt: a.created_at }));
  },

  addTaskAttachment: async (taskId: string, base64Url: string): Promise<void> => {
     const { error } = await supabase.from('task_attachments').insert([{ task_id: taskId, type: 'IMAGE', url: base64Url }]);
     if (error) handleError(error, "adicionar anexo");
  },

  getAvailableUsers: async (enterpriseId: string): Promise<{name: string, id: string, type: 'USER' | 'CUSTOM'}[]> => {
    try {
      const { data: members } = await supabase.from('memberships').select('user_email, user_name').eq('enterprise_id', enterpriseId);
      const mappedMembers = (members || []).map((m: any) => ({ name: m.user_name || m.user_email, id: m.user_email, type: 'USER' as const }));
      const { data: custom } = await supabase.from('custom_assignees').select('name').eq('enterprise_id', enterpriseId);
      const mappedCustom = (custom || []).map((c: any) => ({ name: c.name, id: c.name, type: 'CUSTOM' as const }));
      return [...mappedMembers, ...mappedCustom];
    } catch (e) { return []; }
  },

  addCustomAssignee: async (name: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('custom_assignees').insert([{ name, enterprise_id: enterpriseId }]);
    handleError(error, "adicionar responsável");
  },

  deleteCustomAssignee: async (name: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('custom_assignees').delete().eq('name', name).eq('enterprise_id', enterpriseId);
    handleError(error, "excluir responsável");
  },

  // --- EQUIPMENT ---
  getEquipment: async (enterpriseId: string): Promise<Equipment[]> => {
    const { data, error } = await supabase.from('equipment').select('*').eq('enterprise_id', enterpriseId);
    if (error) return [];
    return (data || []).map(mapEquipment);
  },

  addEquipment: async (item: Omit<Equipment, 'id'>, userEmail: string): Promise<Equipment | null> => {
    const { data, error } = await supabase.from('equipment').insert([{
      enterprise_id: item.enterpriseId,
      name: item.name,
      category: item.category,
      location: item.location,
      description: item.description,
      install_date: item.installDate,
      acquisition_date: item.acquisitionDate,
      last_maintenance: item.lastMaintenance,
      next_maintenance: item.nextMaintenance,
      status: item.status
    }]).select().single();
    
    if (!error && data) {
       logAction(item.enterpriseId, userEmail, 'ADICIONAR_EQUIPAMENTO', `Equipamento: ${item.name}`);
       return mapEquipment(data);
    }
    else {
       handleError(error, "adicionar equipamento");
       return null;
    }
  },

  updateEquipment: async (id: string, updates: Partial<Equipment>, enterpriseId: string, userEmail: string): Promise<void> => {
     const payload: any = {
       name: updates.name,
       category: updates.category,
       location: updates.location,
       description: updates.description,
       install_date: updates.installDate,
       acquisition_date: updates.acquisitionDate,
       status: updates.status
     };
     Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

     const { error } = await supabase.from('equipment').update(payload).eq('id', id);
     if (!error) {
       logAction(enterpriseId, userEmail, 'ATUALIZAR_EQUIPAMENTO', `Atualizou equipamento ID ${id.substring(0,8)}`);
     } else {
       handleError(error, "atualizar equipamento");
     }
  },

  deleteEquipment: async (id: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { data: eqData } = await supabase.from('equipment').select('name').eq('id', id).single();
    const name = eqData?.name || id;

    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (!error) {
      logAction(enterpriseId, userEmail, 'EXCLUIR_EQUIPAMENTO', `Excluiu equipamento: ${name}`);
    } else {
      handleError(error, "excluir equipamento");
    }
  },

  getEquipmentImages: async (equipmentId: string): Promise<EquipmentImage[]> => {
    const { data, error } = await supabase.from('equipment_images').select('*').eq('equipment_id', equipmentId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map((i: any) => ({ id: i.id, equipmentId: i.equipment_id, url: i.url, createdAt: i.created_at }));
  },

  addEquipmentImage: async (equipmentId: string, base64Url: string): Promise<void> => {
    const { error } = await supabase.from('equipment_images').insert([{ equipment_id: equipmentId, url: base64Url }]);
    if (error) handleError(error, "adicionar imagem ao equipamento");
  },

  getEquipmentCategories: async (enterpriseId: string): Promise<string[]> => {
    const { data, error } = await supabase.from('equipment_categories').select('name').eq('enterprise_id', enterpriseId);
    if (error) return [];
    return (data || []).map((i: any) => i.name);
  },

  addEquipmentCategory: async (name: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('equipment_categories').insert([{ name, enterprise_id: enterpriseId }]);
    handleError(error, "adicionar categoria");
  },
  
  updateEquipmentCategory: async (oldName: string, newName: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error: catError } = await supabase.from('equipment_categories').update({ name: newName }).eq('enterprise_id', enterpriseId).eq('name', oldName);
    if (catError) { handleError(catError, "atualizar categoria"); return; }
    
    const { error: eqError } = await supabase.from('equipment').update({ category: newName }).eq('enterprise_id', enterpriseId).eq('category', oldName);
    if (!eqError) logAction(enterpriseId, userEmail, 'EDITAR_CATEGORIA', `Renomeou categoria "${oldName}" para "${newName}"`);
  },

  deleteEquipmentCategory: async (name: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('equipment_categories').delete().eq('name', name).eq('enterprise_id', enterpriseId);
    handleError(error, "excluir categoria");
  },

  getEquipmentLocations: async (enterpriseId: string): Promise<string[]> => {
    const { data, error } = await supabase.from('equipment_locations').select('name').eq('enterprise_id', enterpriseId);
    if (error) return [];
    return (data || []).map((i: any) => i.name);
  },

  addEquipmentLocation: async (name: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('equipment_locations').insert([{ name, enterprise_id: enterpriseId }]);
    handleError(error, "adicionar local");
  },
  
  updateEquipmentLocation: async (oldName: string, newName: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error: locError } = await supabase.from('equipment_locations').update({ name: newName }).eq('enterprise_id', enterpriseId).eq('name', oldName);
    if (locError) { handleError(locError, "atualizar localização"); return; }
    const { error: eqError } = await supabase.from('equipment').update({ location: newName }).eq('enterprise_id', enterpriseId).eq('location', oldName);
    if (!eqError) logAction(enterpriseId, userEmail, 'EDITAR_LOCAL', `Renomeou local "${oldName}" para "${newName}"`);
  },

  deleteEquipmentLocation: async (name: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('equipment_locations').delete().eq('name', name).eq('enterprise_id', enterpriseId);
    handleError(error, "excluir local");
  },

  addMaintenanceLog: async (log: Omit<MaintenanceLog, 'id'>, userEmail: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('maintenance_logs').insert([{ 
      equipment_id: log.equipmentId, 
      date: log.date, 
      technician: log.technician, 
      description: log.description, 
      type: log.type,
      signature_url: log.signatureUrl 
    }]);
    if (!error) {
      await supabase.from('equipment').update({ last_maintenance: log.date }).eq('id', log.equipmentId);
      logAction(enterpriseId, userEmail, 'REGISTRAR_MANUTENCAO', `Manutenção em equipamento ID ${log.equipmentId}`);
    } else { handleError(error, "registrar manutenção"); }
  },

  updateMaintenanceLog: async (id: string, updates: Partial<MaintenanceLog>, enterpriseId: string, userEmail: string): Promise<void> => {
     const payload: any = {
        date: updates.date,
        technician: updates.technician,
        description: updates.description,
        type: updates.type,
        signature_url: updates.signatureUrl 
     };
     Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
     
     const { error } = await supabase.from('maintenance_logs').update(payload).eq('id', id);
     if(!error) logAction(enterpriseId, userEmail, 'EDITAR_MANUTENCAO', `Editou log ID ${id.substring(0,8)}`);
     else handleError(error, "editar manutenção");
  },

  getMaintenanceLogs: async (equipmentId: string): Promise<MaintenanceLog[]> => {
    const { data, error } = await supabase.from('maintenance_logs').select('*').eq('equipment_id', equipmentId).order('date', { ascending: false });
    if (error) return [];
    return (data || []).map((d: any) => ({ 
      id: d.id, 
      equipmentId: d.equipment_id, 
      date: d.date, 
      technician: d.technician, 
      description: d.description, 
      type: d.type,
      signatureUrl: d.signature_url
    }));
  },

  deleteMaintenanceLog: async (id: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
    if (!error) {
      logAction(enterpriseId, userEmail, 'EXCLUIR_MANUTENCAO', `Excluiu log de manutenção ID ${id.substring(0,8)}`);
    } else {
      handleError(error, "excluir manutenção");
    }
  },

  getSuppliers: async (enterpriseId: string): Promise<Supplier[]> => {
    const { data, error } = await supabase.from('suppliers').select('*').eq('enterprise_id', enterpriseId);
    if (error) return [];
    return (data || []).map((s: any) => ({ id: s.id, enterpriseId: s.enterprise_id, name: s.name, serviceType: s.service_type, contact: s.contact, rating: s.rating }));
  },

  // --- DOCUMENTS ---
  getDocuments: async (enterpriseId: string): Promise<Document[]> => {
    const { data, error } = await supabase.from('documents').select('*').eq('enterprise_id', enterpriseId).order('date', { ascending: false });
    if (error) return [];
    return (data || []).map((d: any) => ({ id: d.id, enterpriseId: d.enterprise_id, title: d.title, category: d.category, url: d.url, fileType: d.file_type, date: d.date }));
  },

  addDocument: async (doc: { title: string, category: string, file: File, date: string }, enterpriseId: string, userEmail: string): Promise<void> => {
    try {
      const base64 = await fileToBase64(doc.file);
      const fileType = doc.file.type.split('/')[1]?.toUpperCase() || 'FILE';
      
      const { error } = await supabase.from('documents').insert([{
        enterprise_id: enterpriseId,
        title: doc.title,
        category: doc.category,
        url: base64,
        file_type: fileType,
        date: doc.date
      }]);
      
      if (!error) {
        logAction(enterpriseId, userEmail, 'UPLOAD_DOC', `Upload documento: ${doc.title}`);
      } else {
        handleError(error, "adicionar documento");
      }
    } catch (e: any) { handleError(e, "processar arquivo"); }
  },

  updateDocument: async (id: string, updates: { title?: string, category?: string, date?: string }, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error } = await supabase.from('documents').update(updates).eq('id', id);
    if (!error) {
      logAction(enterpriseId, userEmail, 'EDITAR_DOC', `Editou documento ID ${id.substring(0,8)}`);
    } else {
      handleError(error, "editar documento");
    }
  },

  deleteDocument: async (id: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { data } = await supabase.from('documents').select('title').eq('id', id).single();
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (!error) {
      logAction(enterpriseId, userEmail, 'EXCLUIR_DOC', `Excluiu documento: ${data?.title}`);
    } else {
      handleError(error, "excluir documento");
    }
  },

  // Document Categories (V17)
  getDocumentCategories: async (enterpriseId: string): Promise<string[]> => {
    const { data, error } = await supabase.from('document_categories').select('name').eq('enterprise_id', enterpriseId);
    if (error) return [];
    return (data || []).map((i: any) => i.name);
  },

  addDocumentCategory: async (name: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('document_categories').insert([{ name, enterprise_id: enterpriseId }]);
    if (error) handleError(error, "adicionar categoria de documento");
  },

  updateDocumentCategory: async (oldName: string, newName: string, enterpriseId: string, userEmail: string): Promise<void> => {
    const { error: catError } = await supabase.from('document_categories').update({ name: newName }).eq('enterprise_id', enterpriseId).eq('name', oldName);
    if (catError) { handleError(catError, "atualizar categoria de documento"); return; }
    
    // Update linked documents
    const { error: docError } = await supabase.from('documents').update({ category: newName }).eq('enterprise_id', enterpriseId).eq('category', oldName);
    if (!docError) logAction(enterpriseId, userEmail, 'EDITAR_CATEGORIA_DOC', `Renomeou categoria doc "${oldName}" para "${newName}"`);
  },

  deleteDocumentCategory: async (name: string, enterpriseId: string): Promise<void> => {
    const { error } = await supabase.from('document_categories').delete().eq('name', name).eq('enterprise_id', enterpriseId);
    if (error) handleError(error, "excluir categoria de documento");
  },

  // --- STRUCTURAL MAINTENANCE (V15/V16) ---
  getStructuralIssues: async (enterpriseId: string): Promise<StructuralIssue[]> => {
    // Join with structural_photos to get the cover image
    const { data, error } = await supabase
      .from('structural_issues')
      .select('*, structural_photos(url)')
      .eq('enterprise_id', enterpriseId)
      .order('priority', { ascending: false });
      
    if (error) return [];
    
    return (data || []).map((d: any) => ({
      ...mapStructuralIssue(d),
      coverPhoto: d.structural_photos?.[0]?.url || undefined
    }));
  },

  addStructuralIssue: async (issue: Omit<StructuralIssue, 'id' | 'createdAt' | 'resolvedAt' | 'coverPhoto'>, photos: string[], userEmail: string): Promise<void> => {
    const { data, error } = await supabase.from('structural_issues').insert([{
      enterprise_id: issue.enterpriseId,
      title: issue.title,
      description: issue.description,
      location: issue.location,
      priority: issue.priority,
      status: 'REPORTED',
      reported_by: issue.reportedBy,
      notify_admin: issue.notifyAdmin ?? true
    }]).select().single();

    if (error || !data) { handleError(error, "reportar problema estrutural"); return; }

    logAction(issue.enterpriseId, userEmail, 'REPORTAR_ESTRUTURAL', `Reportou: ${issue.title}`);

    if (photos.length > 0) {
      const photoPayload = photos.map(url => ({ issue_id: data.id, url }));
      await supabase.from('structural_photos').insert(photoPayload);
    }

    if (issue.notifyAdmin) {
       sendMockEmail("Admins", "Novo Problema Estrutural", `Problema "${issue.title}" reportado em ${issue.location} com prioridade ${issue.priority}.`);
    }
  },

  updateStructuralIssue: async (id: string, issue: Partial<StructuralIssue>, enterpriseId: string, userEmail: string): Promise<void> => {
    const payload: any = {
      title: issue.title,
      description: issue.description,
      location: issue.location,
      priority: issue.priority,
      status: issue.status,
      notify_admin: issue.notifyAdmin
    };
    if (issue.status === 'RESOLVED') payload.resolved_at = new Date().toISOString();
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const { error } = await supabase.from('structural_issues').update(payload).eq('id', id);
    if (!error) logAction(enterpriseId, userEmail, 'ATUALIZAR_ESTRUTURAL', `Atualizou problema ID ${id.substring(0,8)}`);
    else handleError(error, "atualizar problema estrutural");
  },

  addStructuralPhoto: async (issueId: string, url: string): Promise<void> => {
    const { error } = await supabase.from('structural_photos').insert([{ issue_id: issueId, url }]);
    if (error) handleError(error, "adicionar foto estrutural");
  },

  deleteStructuralPhoto: async (photoId: string): Promise<void> => {
    const { error } = await supabase.from('structural_photos').delete().eq('id', photoId);
    if (error) handleError(error, "excluir foto estrutural");
  },

  updateStructuralIssueStatus: async (id: string, status: StructuralIssue['status'], enterpriseId: string, userEmail: string): Promise<void> => {
    const updates: any = { status };
    if (status === 'RESOLVED') updates.resolved_at = new Date().toISOString();
    
    const { error } = await supabase.from('structural_issues').update(updates).eq('id', id);
    if (!error) logAction(enterpriseId, userEmail, 'ATUALIZAR_ESTRUTURAL_STATUS', `Status alterado para ${status}`);
    else handleError(error, "atualizar status estrutural");
  },

  deleteStructuralIssue: async (id: string, enterpriseId: string, userEmail: string): Promise<void> => {
    // 1. Manually delete linked photos first to avoid FK constraints if CASCADE is missing
    await supabase.from('structural_photos').delete().eq('issue_id', id);
    
    // 2. Delete the issue
    const { error } = await supabase.from('structural_issues').delete().eq('id', id);
    
    if (!error) {
      logAction(enterpriseId, userEmail, 'EXCLUIR_ESTRUTURAL', `Excluiu problema ID ${id.substring(0,8)}`);
    } else {
      handleError(error, "excluir problema estrutural");
    }
  },

  getStructuralPhotos: async (issueId: string): Promise<StructuralPhoto[]> => {
    const { data, error } = await supabase.from('structural_photos').select('*').eq('issue_id', issueId);
    if (error) return [];
    return (data || []).map((p: any) => ({ id: p.id, issueId: p.issue_id, url: p.url }));
  },

  getDashboardStats: async (enterpriseId: string) => {
    try {
      const { count: tasksCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId).eq('status', 'PENDING');
      const { count: waterCount } = await supabase.from('water_readings').select('*', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId);
      const { count: equipCount } = await supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId);
      return { pendingTasks: tasksCount || 0, waterReadings: waterCount || 0, equipmentCount: equipCount || 0, connected: true };
    } catch (e) {
      return { pendingTasks: 0, waterReadings: 0, equipmentCount: 0, connected: false };
    }
  }
};