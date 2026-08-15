import {describe, expect, it} from 'vitest';
import {notificationActionLabel, notificationRoute} from './notifications';

describe('notification routes', () => {
  it('builds only allowlisted routes from bounded identifiers', () => {
    expect(notificationRoute({resourceType: 'request', resourceId: 'REQ-1'})).toBe(
      '/requests/REQ-1',
    );
    expect(notificationRoute({resourceType: 'quote', resourceId: 'Q 1'})).toBeNull();
    expect(notificationRoute({resourceType: 'https', resourceId: 'example'})).toBeNull();
  });

  it('uses a concrete action label', () => {
    expect(notificationActionLabel('equipment')).toBe('Ver equipo');
  });
});
