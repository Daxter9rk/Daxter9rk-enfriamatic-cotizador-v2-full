import {Timestamp} from 'firebase/firestore';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NotificationCenter} from './NotificationCenter';

const {markNotificationRead, navigate} = vi.hoisted(() => ({
  markNotificationRead: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('wouter', () => ({useLocation: () => ['/', navigate]}));
vi.mock('../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'admin', role: 'admin'}}),
}));
vi.mock('../hooks/useRealtimeCollection', () => ({
  useRealtimeCollection: () => ({
    data: [
      {
        id: 'notification-1',
        userId: 'admin',
        type: 'request.assigned',
        title: 'Solicitud asignada',
        message: 'Tienes una solicitud nueva.',
        resourceType: 'request',
        resourceId: 'request-1',
        read: false,
        createdAt: Timestamp.fromMillis(1_700_000_000_000),
      },
    ],
    loading: false,
    error: null,
  }),
}));
vi.mock('../services/firebase/data', () => ({
  constraints: {notificationsFor: vi.fn(), newest: vi.fn()},
  markNotificationRead,
}));

describe('NotificationCenter', () => {
  beforeEach(() => {
    markNotificationRead.mockReset().mockResolvedValue(undefined);
    navigate.mockReset();
  });

  it('marca como leída y abre el recurso permitido con un solo clic', async () => {
    const user = userEvent.setup();
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', {name: /notificaciones, 1 sin leer/i}));
    await user.click(screen.getByRole('button', {name: /solicitud asignada/i}));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('notification-1'));
    expect(navigate).toHaveBeenCalledWith('/requests/request-1');
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
