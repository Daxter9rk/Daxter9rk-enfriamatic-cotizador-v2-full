import {z} from 'zod';

const shortText = z.string().trim().min(1).max(120);
const optionalText = z.string().trim().max(2000).optional();
const optionalContact = z.string().trim().max(160).optional();

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const clientInputSchema = z.object({
  name: shortText,
  legalName: optionalContact,
  rfc: z.string().trim().toUpperCase().max(13).optional(),
  contactName: optionalContact,
  email: z.union([emailSchema, z.literal('')]).optional(),
  phone: z.string().trim().max(30).optional(),
  status: z.enum(['active', 'inactive']),
  notes: optionalText,
});

export const siteInputSchema = z.object({
  clientId: z.string().trim().min(1).max(128),
  name: shortText,
  type: z.enum(['plant', 'ranch', 'branch', 'warehouse', 'other']),
  address: z.object({
    street: z.string().trim().min(1).max(160),
    exteriorNumber: z.string().trim().max(20).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(4).max(10),
    country: z.string().trim().min(1).max(80),
  }),
  contactName: optionalContact,
  contactPhone: z.string().trim().max(30).optional(),
  status: z.enum(['active', 'inactive']),
});

export const equipmentInputSchema = z.object({
  clientId: z.string().trim().min(1).max(128),
  siteId: z.string().trim().min(1).max(128),
  name: shortText,
  category: shortText,
  brand: optionalContact,
  model: optionalContact,
  serialNumber: optionalContact,
  capacity: optionalContact,
  refrigerant: optionalContact,
  technicalNotes: optionalText,
  status: z.enum(['active', 'inactive', 'retired']),
});

export const requestInputSchema = z.object({
  clientId: z.string().trim().min(1).max(128),
  siteId: z.string().trim().min(1).max(128),
  equipmentId: z.string().trim().max(128).nullable().optional(),
  title: shortText,
  description: z.string().trim().min(1).max(4000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  assignedTo: z.string().trim().max(128).nullable().optional(),
});

export const quoteItemInputSchema = z.object({
  position: z.number().int().min(0).max(999),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(40),
  equipmentOrService: z.string().trim().max(160).optional(),
  brand: optionalContact,
  model: optionalContact,
  description: z.string().trim().min(1).max(2000),
  originalUnitPrice: z.number().min(0).max(1_000_000_000),
  discountType: z.enum(['none', 'percentage', 'fixed']),
  discountValue: z.number().min(0).max(1_000_000_000),
  taxable: z.boolean(),
});

export const createUserInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(['admin', 'operator']),
  status: z.enum(['active', 'inactive', 'pending', 'suspended']),
});

export type ClientInput = z.infer<typeof clientInputSchema>;
export type SiteInput = z.infer<typeof siteInputSchema>;
export type EquipmentInput = z.infer<typeof equipmentInputSchema>;
export type RequestInput = z.infer<typeof requestInputSchema>;
export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
