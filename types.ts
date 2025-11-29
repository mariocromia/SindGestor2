
export enum UserRole {
  ADMIN = 'ADMIN',
  RESIDENT = 'RESIDENT',
  STAFF = 'STAFF'
}

export enum PermissionLevel {
  NONE = 'NONE',         // Não vê o módulo no menu
  READ_ONLY = 'READ_ONLY', // Apenas visualiza
  READ_WRITE = 'READ_WRITE', // Visualiza e Cadastra (Não edita/exclui)
  FULL_ACCESS = 'FULL_ACCESS' // Tudo (Editar, Excluir)
}

export interface Enterprise {
  id: string;
  name: string;
}

export interface Membership {
  enterpriseId: string;
  enterpriseName: string;
  role: UserRole;
  permissions: Record<string, PermissionLevel>;
  // New: Notification preferences per module (true = send email)
  notifications: Record<string, boolean>; 
}

export interface User {
  id: string; // usually email
  name: string;
  email: string;
  memberships: Membership[];
}

export interface AuditLog {
  id: string;
  enterpriseId: string;
  userEmail: string;
  action: string;     // ex: "CRIAR_TAREFA"
  details: string;    // ex: "Tarefa: Limpar Piscina"
  createdAt: string;
}

export interface WaterReading {
  id: string;
  enterpriseId: string;
  unit: string; // e.g., "Apto 101"
  date: string;
  reading: number; // m³
  previousReading: number;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  type: 'IMAGE';
  url: string; // Base64 for this demo
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userEmail: string;
  userName: string;
  content: string; // Text or Base64 Audio
  contentType: 'TEXT' | 'AUDIO';
  createdAt: string;
}

export interface Task {
  id: string;
  enterpriseId: string;
  enterpriseName?: string; // For unified view
  title: string;
  assignedTo: string; // email
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  description: string;
  audioDescription?: string; // Base64 Audio
  notifyAssignee?: boolean; // New V11: Toggle notification
  createdAt?: string; // New: Creation Date
}

export interface EquipmentImage {
  id: string;
  equipmentId: string;
  url: string; // Base64
  createdAt: string;
}

export interface Equipment {
  id: string;
  enterpriseId: string;
  name: string;
  category: string;
  location: string;
  description?: string;
  acquisitionDate?: string; // New V12
  installDate: string;
  lastMaintenance: string;
  nextMaintenance: string;
  qrCodeUrl?: string;
  status: 'OPERATIONAL' | 'NEEDS_REPAIR' | 'OUT_OF_ORDER';
  createdAt?: string;
}

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  date: string;
  technician: string;
  description: string;
  type: 'PREVENTIVE' | 'CORRECTIVE';
  signatureUrl?: string; // New V14: Base64 Signature
}

export interface Supplier {
  id: string;
  enterpriseId: string;
  name: string;
  serviceType: string;
  contact: string;
  rating: number;
}

export interface Document {
  id: string;
  enterpriseId: string;
  title: string;
  category: string;
  url: string; // Base64
  fileType?: string; // PDF, IMG, etc.
  date: string;
}

// New V15: Structural
export interface StructuralPhoto {
  id: string;
  issueId: string;
  url: string;
}

export interface StructuralIssue {
  id: string;
  enterpriseId: string;
  title: string;
  description: string;
  location: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'REPORTED' | 'IN_PROGRESS' | 'RESOLVED';
  reportedBy: string;
  notifyAdmin?: boolean; // New V16
  createdAt: string;
  resolvedAt?: string;
  coverPhoto?: string; // New: For displaying in list view
}

// Module Constants
export const MODULES = {
  WATER: 'module_water',
  TASKS: 'module_tasks',
  DOCUMENTS: 'module_documents',
  EQUIPMENT: 'module_equipment',
  STRUCTURAL: 'module_structural',
  SUPPLIERS: 'module_suppliers',
  ADMIN_PANEL: 'module_admin_panel'
};
