import {describe, expect, it} from 'vitest';
import {closeDetailSearch, detailIdFromSearch, openDetailSearch} from './detailNavigation';

describe('navegación de detalle', () => {
  it('elimina sólo el detalle y conserva filtros al cerrar', () => {
    expect(closeDetailSearch('?quote=q-1&status=rejected&view=table', 'quote')).toBe(
      '?status=rejected&view=table',
    );
    expect(detailIdFromSearch('?quote=q-1&status=rejected', 'quote')).toBe('q-1');
  });

  it('normaliza una ruta sin detalle sin crear ciclos', () => {
    expect(closeDetailSearch('?status=issued', 'quote')).toBe('?status=issued');
    expect(detailIdFromSearch('?quote=', 'quote')).toBeNull();
  });

  it('abre un detalle conservando el resto del estado de la URL', () => {
    expect(openDetailSearch('?status=issued&view=table', 'quote', 'q-2')).toBe(
      '?status=issued&view=table&quote=q-2',
    );
  });
});
