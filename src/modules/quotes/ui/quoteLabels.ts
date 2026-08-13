import type {QuoteStatus} from '../domain/types';

export function quoteStatusLabel(status: QuoteStatus): string {
  return {
    draft: 'Borrador',
    issued: 'Emitida',
    sent: 'Enviada',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
    expired: 'Expirada',
  }[status];
}
