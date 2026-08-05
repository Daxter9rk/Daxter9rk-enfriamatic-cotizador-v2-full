import {z} from 'zod';

export const userRoleSchema = z.enum(['admin', 'operator']);
export const userStatusSchema = z.enum(['active', 'inactive', 'pending', 'suspended']);

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(120),
  role: userRoleSchema,
  status: userStatusSchema,
});

export const updateUserSchema = z.object({
  uid: z.string().min(1).max(128),
  displayName: z.string().trim().min(2).max(120),
  role: userRoleSchema,
  status: userStatusSchema,
});

export const issueQuoteSchema = z.object({
  quoteId: z.string().min(1).max(128),
  idempotencyKey: z.string().uuid(),
});

export const quoteIdSchema = z.object({
  quoteId: z.string().min(1).max(128),
});

export const transitionQuoteSchema = z
  .object({
    quoteId: z.string().min(1).max(128),
    to: z.enum(['sent', 'accepted', 'rejected', 'cancelled']),
    reason: z.string().trim().min(5).max(1000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if ((value.to === 'rejected' || value.to === 'cancelled') && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required for rejection or cancellation.',
      });
    }
  });

export const transitionRequestSchema = z
  .object({
    requestId: z.string().min(1).max(128),
    to: z.enum(['in_progress', 'completed', 'cancelled']),
    reason: z.string().trim().min(5).max(1000).nullable().optional(),
    finalNote: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.to === 'in_progress' && value.reason === null) return;
    if (value.to === 'cancelled' && !value.reason) {
      context.addIssue({code: 'custom', path: ['reason'], message: 'A reason is required.'});
    }
  });

export const assignRequestSchema = z.object({
  requestId: z.string().min(1).max(128),
  assignedTo: z.string().min(1).max(128),
  note: z.string().trim().max(500).nullable().optional(),
});

export const quoteItemSchema = z.object({
  position: z.number().int().min(0).max(999),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(40),
  equipmentOrService: z.string().trim().max(160).optional(),
  brand: z.string().trim().max(160).optional(),
  model: z.string().trim().max(160).optional(),
  description: z.string().trim().min(1).max(2000),
  originalUnitPrice: z.number().min(0).max(1_000_000_000),
  discountType: z.enum(['none', 'percentage', 'fixed']),
  discountValue: z.number().min(0).max(1_000_000_000),
  taxable: z.boolean(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
