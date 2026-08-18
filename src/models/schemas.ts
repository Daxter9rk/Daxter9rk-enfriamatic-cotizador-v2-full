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
  addressFull: z.string().trim().max(500).optional(),
  postalCode: z.union([z.string().regex(/^\d{5}$/), z.literal('')]).optional(),
  billingAddress: z
    .object({
      street: z.string().trim().min(1).max(160),
      exteriorNumber: z.string().trim().max(20).optional(),
      interiorNumber: z.string().trim().max(20).optional(),
      neighborhood: z.string().trim().max(120).optional(),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(1).max(100),
      postalCode: z.string().trim().min(4).max(10),
      country: z.string().trim().min(1).max(80),
    })
    .optional(),
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
  accessSchedule: z.string().trim().max(500).optional(),
  accessInstructions: z.string().trim().max(2000).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
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
  locationReference: z.string().trim().max(500).optional(),
  operationalStatus: z.enum(['operational', 'limited', 'out_of_service', 'unknown']).optional(),
  latestDiagnosis: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'inactive', 'retired']),
});

export const equipmentInterventionInputSchema = z.object({
  equipmentId: z.string().trim().min(1).max(128),
  siteId: z.string().trim().min(1).max(128),
  requestId: z.string().trim().max(128).nullable().optional(),
  interventionType: z.enum(['inspection', 'maintenance', 'repair', 'installation', 'other']),
  diagnosis: z.string().trim().min(1).max(2000),
  actions: z.string().trim().min(1).max(4000),
  partsUsed: z.array(z.string().trim().min(1).max(160)).max(50),
  partsRecommended: z.array(z.string().trim().min(1).max(160)).max(50),
  resultingStatus: z.enum(['operational', 'limited', 'out_of_service', 'unknown']),
  notes: optionalText,
  responsibleName: z.string().trim().min(1).max(120),
  responsibleRole: z.enum(['admin', 'operator']),
});

export const requestInputSchema = z.object({
  clientId: z.string().trim().min(1).max(128),
  siteId: z.string().trim().min(1).max(128),
  equipmentId: z.string().trim().max(128).nullable().optional(),
  scope: z.enum(['site', 'equipment']),
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
  catalogItemId: z.string().trim().max(128).nullable().optional(),
  catalogCode: z.string().trim().max(40).nullable().optional(),
  catalogType: z.enum(['product', 'service']).nullable().optional(),
  catalogSnapshot: z
    .object({
      code: z.string().trim().min(1).max(40),
      type: z.enum(['product', 'service']),
      name: z.string().trim().min(1).max(160),
      description: z.string().trim().min(1).max(2000),
      category: z.string().trim().min(1).max(120),
      unit: z.string().trim().min(1).max(40),
      brand: z.string().trim().max(160).nullable(),
      model: z.string().trim().max(160).nullable(),
      basePrice: z.number().min(0).max(1_000_000_000),
      taxable: z.boolean(),
    })
    .nullable()
    .optional(),
});

export const catalogItemInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
  type: z.enum(['product', 'service']),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(40),
  brand: z.string().trim().max(160).nullable().optional(),
  model: z.string().trim().max(160).nullable().optional(),
  basePrice: z.number().min(0).max(1_000_000_000),
  taxable: z.boolean(),
  status: z.enum(['active', 'inactive']),
  searchTokens: z.array(z.string().trim().min(1).max(80)).max(50),
});

export const createUserInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(['admin', 'operator']),
  status: z.enum(['active', 'inactive', 'pending', 'suspended']),
});

export const supportRequestInputSchema = z.object({
  category: z.enum(['technical', 'access', 'data', 'question']),
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(4000),
  module: z.string().trim().min(1).max(80),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  appVersion: z.string().trim().min(1).max(40),
  status: z.literal('open'),
  blocked: z.boolean(),
  route: z.string().trim().min(1).max(300),
  browser: z.string().trim().min(1).max(300),
  reporterRole: z.enum(['admin', 'operator']),
});

export type ClientInput = z.infer<typeof clientInputSchema>;
export type SiteInput = z.infer<typeof siteInputSchema>;
export type EquipmentInput = z.infer<typeof equipmentInputSchema>;
export type RequestInput = z.infer<typeof requestInputSchema>;
export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>;
export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
