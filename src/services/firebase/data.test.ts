import {beforeEach, describe, expect, it, vi} from 'vitest';

const firestore = vi.hoisted(() => ({
  getDoc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(() => ({path: 'equipmentFiles/file-1'})),
  collection: vi.fn(() => ({path: 'equipmentFiles'})),
  serverTimestamp: vi.fn(() => 'server-time'),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: firestore.collection,
  deleteDoc: vi.fn(),
  doc: firestore.doc,
  getDoc: firestore.getDoc,
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: firestore.serverTimestamp,
  setDoc: firestore.setDoc,
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock('./config', () => ({db: {}, functions: {}}));
vi.mock('firebase/functions', () => ({httpsCallable: vi.fn()}));

import {createKnownDocument} from './data';

describe('createKnownDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea metadata nueva sin leer primero un documento inexistente', async () => {
    await createKnownDocument(
      'equipmentFiles',
      'file-1',
      {equipmentId: 'equipment-1', status: 'pending'},
      'admin-1',
    );

    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        schemaVersion: 1,
      }),
    );
  });
});
