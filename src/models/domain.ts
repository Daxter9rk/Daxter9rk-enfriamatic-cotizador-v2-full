import type {Timestamp} from 'firebase/firestore';
import type {
  DiscountDisplayMode,
  DocumentStatus,
  QuoteStatus,
} from '../modules/quotes/domain/types';

export type {
  DiscountDisplayMode,
  DocumentStatus,
  QuoteStatus,
} from '../modules/quotes/domain/types';

export type UserRole = 'admin' | 'operator';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';
export type RequestStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type CatalogItemType = 'product' | 'service';
export type CatalogItemStatus = 'active' | 'inactive';

export interface AuditFields {
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  schemaVersion: number;
}

export interface Address {
  street: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  neighborhood?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp;
  createdBy: string | null;
  updatedAt: Timestamp;
  updatedBy: string | null;
  lastLoginAt?: Timestamp | null;
  lastActivityAt?: Timestamp | null;
  isPrimaryAdmin?: boolean;
  schemaVersion: number;
}

export interface Client extends AuditFields {
  id: string;
  name: string;
  legalName?: string;
  rfc?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: Address;
  status: 'active' | 'inactive';
  notes?: string;
}

export interface Site extends AuditFields {
  id: string;
  clientId: string;
  name: string;
  type?: 'plant' | 'ranch' | 'branch' | 'warehouse' | 'other';
  address: Address;
  contactName?: string;
  contactPhone?: string;
  accessSchedule?: string;
  accessInstructions?: string;
  latitude?: number | null;
  longitude?: number | null;
  primaryPlanFileId?: string | null;
  status: 'active' | 'inactive';
}

export interface Equipment extends AuditFields {
  id: string;
  clientId: string;
  siteId: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  capacity?: string;
  refrigerant?: string;
  technicalNotes?: string;
  locationReference?: string;
  operationalStatus?: 'operational' | 'limited' | 'out_of_service' | 'unknown';
  latestDiagnosis?: string;
  lastInterventionAt?: Timestamp | null;
  status: 'active' | 'inactive' | 'retired';
}

export interface SiteFile extends AuditFields {
  id: string;
  siteId: string;
  type: 'plan' | 'sketch' | 'photo' | 'document';
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description?: string;
  isPrimary: boolean;
  status: 'pending' | 'ready' | 'failed';
}

export interface EquipmentFile extends AuditFields {
  id: string;
  equipmentId: string;
  type: 'photo' | 'document';
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description?: string;
  status: 'pending' | 'ready' | 'failed';
}

export interface EquipmentIntervention extends AuditFields {
  id: string;
  equipmentId: string;
  siteId: string;
  requestId?: string | null;
  interventionType: 'inspection' | 'maintenance' | 'repair' | 'installation' | 'other';
  diagnosis: string;
  actions: string;
  partsUsed: string[];
  partsRecommended: string[];
  resultingStatus: 'operational' | 'limited' | 'out_of_service' | 'unknown';
  notes?: string;
  responsibleName?: string;
  responsibleRole?: UserRole;
}

export interface ServiceRequest extends AuditFields {
  id: string;
  clientId: string;
  siteId: string;
  equipmentId?: string | null;
  scope?: 'site' | 'equipment';
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: RequestStatus;
  assignedTo?: string | null;
  assignedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  finalNote?: string | null;
  reopenedAt?: Timestamp | null;
  reopenedBy?: string | null;
  reopenReason?: string | null;
  cancellationReason?: string | null;
  workNotes?: string;
  assignmentHistory?: Array<{
    assignedTo: string;
    assignedBy: string;
    assignedAt: Timestamp;
    note?: string | null;
  }>;
  correctionOfRequestId?: string | null;
  correctionOfQuoteId?: string | null;
}

export interface Quote extends AuditFields {
  id: string;
  folio: string;
  requestId: string;
  assignedTo?: string | null;
  clientId: string;
  siteId: string;
  equipmentId?: string | null;
  status: QuoteStatus;
  documentStatus: DocumentStatus;
  currency: 'MXN';
  taxRate: number;
  discountDisplayMode: DiscountDisplayMode;
  subtotalOriginal: number;
  discountTotal: number;
  subtotalFinal: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  validityDays: number;
  validUntil?: Timestamp | null;
  issuedAt?: Timestamp | null;
  issuedBy?: string | null;
  originalQuoteId?: string | null;
  revisionNumber: number;
  locked: boolean;
  commercialTransition?: QuoteCommercialTransition | null;
  commercialHistory?: QuoteCommercialTransition[];
  lastRejectionReason?: string | null;
  lastRejectedAt?: Timestamp | null;
  lastRejectedBy?: string | null;
  lastRejectedByName?: string | null;
  lastRejectedByRole?: UserRole | null;
}

export interface CatalogItem extends AuditFields {
  id: string;
  code: string;
  type: CatalogItemType;
  name: string;
  description: string;
  category: string;
  unit: string;
  brand?: string | null;
  model?: string | null;
  basePrice: number;
  taxable: boolean;
  status: CatalogItemStatus;
  searchTokens: string[];
  imageStoragePath?: string | null;
  imageFileName?: string | null;
  imageMimeType?: string | null;
  imageSizeBytes?: number | null;
  imageStatus?: 'pending' | 'ready' | 'failed' | null;
}

export interface CatalogItemSnapshot {
  code: string;
  type: CatalogItemType;
  name: string;
  description: string;
  category: string;
  unit: string;
  brand: string | null;
  model: string | null;
  basePrice: number;
  taxable: boolean;
}

export interface QuoteCommercialTransition {
  from: QuoteStatus;
  to: QuoteStatus;
  actorId: string;
  actorName?: string;
  actorRole?: UserRole;
  at: Timestamp;
  reason?: string | null;
}

export interface QuoteItem {
  id: string;
  position: number;
  catalogItemId?: string | null;
  catalogCode?: string | null;
  catalogType?: CatalogItemType | null;
  catalogSnapshot?: CatalogItemSnapshot | null;
  quantity: number;
  unit: string;
  equipmentOrService?: string;
  brand?: string;
  model?: string;
  description: string;
  originalUnitPrice: number;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  finalUnitPrice: number;
  lineSubtotal: number;
  taxable: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  read: boolean;
  createdAt: Timestamp;
  readAt?: Timestamp | null;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: UserRole;
  actorUid?: string;
  actorDisplayNameSnapshot?: string | null;
  actorRoleSnapshot?: UserRole | null;
  action: string;
  eventCode?: string;
  sourceEventId?: string;
  resourceType: string;
  resourceId: string;
  requestId?: string | null;
  quoteId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  result?: 'success' | 'denied' | 'failed';
  resourceLabelSnapshot?: string | null;
  route?: string | null;
  reason?: string | null;
  occurredAt?: Timestamp;
  schemaVersion?: number;
  createdAt: Timestamp;
}

export interface SupportRequest extends AuditFields {
  id: string;
  category: 'technical' | 'access' | 'data' | 'question';
  subject: string;
  description: string;
  module: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  appVersion: string;
  status: 'open' | 'in_progress' | 'needs_information' | 'resolved' | 'closed';
  blocked?: boolean;
  route?: string;
  browser?: string;
  reporterRole?: UserRole;
  attachmentStoragePath?: string | null;
  attachmentFileName?: string | null;
  attachmentMimeType?: string | null;
  attachmentSizeBytes?: number | null;
  attachmentStatus?: 'pending' | 'ready' | 'failed' | null;
}

export type AuthState =
  | 'loading'
  | 'anonymous'
  | 'missing-profile'
  | 'inactive'
  | 'pending'
  | 'suspended'
  | 'invalid-role'
  | 'authenticated'
  | 'error';
