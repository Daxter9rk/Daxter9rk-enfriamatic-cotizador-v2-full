// @vitest-environment node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

let environment: RulesTestEnvironment;
const projectId = 'demo-enfriamatic';

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => environment.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/admin'), profile('admin', 'admin')),
      setDoc(doc(db, 'users/promoted-admin'), profile('promoted-admin', 'admin')),
      setDoc(doc(db, 'users/operator'), profile('operator', 'operator')),
      setDoc(doc(db, 'users/other'), profile('other', 'operator')),
      setDoc(doc(db, 'users/inactive'), profile('inactive', 'operator', 'inactive')),
      setDoc(doc(db, 'users/reader'), profile('reader', 'reader')),
      setDoc(doc(db, 'clients/authorized'), client(['operator'])),
      setDoc(doc(db, 'clients/private'), client([])),
      setDoc(doc(db, 'sites/site'), site(['operator'])),
      setDoc(doc(db, 'sites/private-site'), site([])),
      setDoc(doc(db, 'equipment/equipment'), equipment(['operator'])),
      setDoc(doc(db, 'requests/assigned'), serviceRequest('operator', 'assigned')),
      setDoc(doc(db, 'requests/assigned-invalid'), serviceRequest('operator', 'assigned')),
      setDoc(doc(db, 'requests/other'), serviceRequest('other', 'assigned')),
      setDoc(doc(db, 'quotes/issued'), quote('operator', 'issued', true)),
      setDoc(doc(db, 'quotes/draft'), quote('operator', 'draft', false)),
      setDoc(doc(db, 'quotes/other-draft'), quote('other', 'draft', false, 'other')),
      setDoc(doc(db, 'catalogItems/PROD-ACTIVE'), catalogItem('PROD-ACTIVE', 'active')),
      setDoc(doc(db, 'catalogItems/PROD-INACTIVE'), catalogItem('PROD-INACTIVE', 'inactive')),
      setDoc(doc(db, 'catalogs/priority-high'), internalCatalog('priority', 'Alta', 'high')),
      setDoc(doc(db, 'settings/companyProfile'), companyProfile()),
      setDoc(doc(db, 'settings/quoteDefaults'), quoteDefaults()),
      setDoc(doc(db, 'settings/internalSecret'), {secret: 'backend-only'}),
      setDoc(doc(db, 'notifications/operator-note'), notification('operator')),
      setDoc(doc(db, 'notifications/other-note'), notification('other')),
      setDoc(doc(db, 'auditLogs/operator-log'), auditLog('operator')),
      setDoc(doc(db, 'auditLogs/other-log'), auditLog('other')),
      setDoc(doc(db, 'documents/issued'), {quoteId: 'issued', status: 'ready'}),
      setDoc(doc(db, 'counters/quotes-2026'), {value: 1}),
      setDoc(doc(db, 'quotes/issued/issuanceAttempts/known-attempt'), {
        status: 'ready',
      }),
    ]);
  });
});

describe('Firestore rules — commercial catalog', () => {
  it('lets operators read only active items with a constrained query', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertSucceeds(getDoc(doc(db, 'catalogItems/PROD-ACTIVE')));
    await assertFails(getDoc(doc(db, 'catalogItems/PROD-INACTIVE')));
    await assertSucceeds(
      getDocs(query(collection(db, 'catalogItems'), where('status', '==', 'active'), limit(100))),
    );
    await assertFails(getDocs(query(collection(db, 'catalogItems'), limit(100))));
    await assertFails(updateDoc(doc(db, 'catalogItems/PROD-ACTIVE'), {basePrice: 1}));
  });

  it('lets admins create and edit valid items but never change code or delete', async () => {
    const db = environment.authenticatedContext('admin').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'catalogItems/SERV-NEW'), {
        ...catalogItem('SERV-NEW', 'active', 'service'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'admin',
        updatedBy: 'admin',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'catalogItems/SERV-NEW'), {
        basePrice: 250,
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'catalogItems/SERV-NEW'), {
        code: 'SERV-HIJACK',
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'catalogItems/SERV-NEW'), {
        imageStoragePath: 'catalog-items/SERV-NEW/images/client-path.png',
        imageFileName: 'client.png',
        imageMimeType: 'image/png',
        imageSizeBytes: 3,
        imageStatus: 'ready',
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'catalogItems/SERV-WITH-IMAGE'), {
        ...catalogItem('SERV-WITH-IMAGE', 'active', 'service'),
        imageStoragePath: 'catalog-items/SERV-WITH-IMAGE/images/client-path.png',
        imageFileName: 'client.png',
        imageMimeType: 'image/png',
        imageSizeBytes: 3,
        imageStatus: 'ready',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'admin',
        updatedBy: 'admin',
      }),
    );
    await assertFails(deleteDoc(doc(db, 'catalogItems/SERV-NEW')));
  });

  it('requires an active catalog snapshot on create and preserves it on later edits', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    const snapshot = catalogSnapshot('PROD-ACTIVE');
    const reference = doc(db, 'quotes/draft/items/from-catalog');
    await assertSucceeds(
      setDoc(reference, {
        ...item(),
        catalogItemId: 'PROD-ACTIVE',
        catalogCode: 'PROD-ACTIVE',
        catalogType: 'product',
        catalogSnapshot: snapshot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'catalogItems/PROD-ACTIVE'), {status: 'inactive'});
    });
    await assertSucceeds(
      updateDoc(reference, {description: 'Descripción editada', updatedAt: serverTimestamp()}),
    );
    await assertFails(
      updateDoc(reference, {
        catalogSnapshot: {...snapshot, basePrice: 1},
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('Firestore rules — internal catalogs', () => {
  it('allows active operators to read but never mutate internal catalogs', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertSucceeds(getDoc(doc(db, 'catalogs/priority-high')));
    await assertSucceeds(getDocs(query(collection(db, 'catalogs'), limit(100))));
    await assertFails(
      updateDoc(doc(db, 'catalogs/priority-high'), {
        status: 'inactive',
        updatedAt: serverTimestamp(),
        updatedBy: 'operator',
      }),
    );
  });

  it('lets admins create, edit, activate and deactivate without changing the reserved type', async () => {
    const db = environment.authenticatedContext('admin').firestore();
    const reference = doc(db, 'catalogs/site-type-store');
    await assertSucceeds(
      setDoc(reference, {
        ...internalCatalog('site_type', 'Tienda', 'store'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        name: 'Sucursal comercial',
        status: 'inactive',
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        status: 'active',
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(
      updateDoc(reference, {
        type: 'priority',
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(deleteDoc(reference));
  });
});

describe('Firestore rules — identity and roles', () => {
  it('denies every domain read to an unauthenticated visitor', async () => {
    const db = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users/admin')));
    await assertFails(getDoc(doc(db, 'clients/authorized')));
    await assertFails(getDoc(doc(db, 'quotes/issued')));
    await assertFails(getDoc(doc(db, 'settings/companyProfile')));
    await assertFails(getDoc(doc(db, 'auditLogs/operator-log')));
  });

  it('lets a signed-in account probe only its own missing profile and denies domain data', async () => {
    const db = environment.authenticatedContext('missing-profile').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/missing-profile')));
    await assertFails(getDoc(doc(db, 'users/admin')));
    await assertFails(getDoc(doc(db, 'clients/authorized')));
    await assertFails(getDoc(doc(db, 'settings/companyProfile')));
  });

  it('denies inactive and unsupported reader profiles outside their own profile', async () => {
    for (const uid of ['inactive', 'reader']) {
      const db = environment.authenticatedContext(uid).firestore();
      await assertSucceeds(getDoc(doc(db, `users/${uid}`)));
      await assertFails(getDoc(doc(db, 'clients/authorized')));
      await assertFails(getDoc(doc(db, 'quotes/issued')));
      await assertFails(getDoc(doc(db, 'settings/quoteDefaults')));
    }
  });

  it('keeps profiles backend-only and prevents self-activation or role escalation', async () => {
    const operatorDb = environment.authenticatedContext('operator').firestore();
    const adminDb = environment.authenticatedContext('admin').firestore();
    await assertFails(
      updateDoc(doc(operatorDb, 'users/operator'), {role: 'admin', status: 'active'}),
    );
    await assertFails(updateDoc(doc(operatorDb, 'users/inactive'), {status: 'active'}));
    await assertFails(setDoc(doc(operatorDb, 'users/attacker'), profile('attacker', 'admin')));
    await assertFails(updateDoc(doc(adminDb, 'users/operator'), {role: 'admin'}));
    await assertSucceeds(getDocs(query(collection(adminDb, 'users'), limit(100))));
    await assertFails(getDocs(query(collection(operatorDb, 'users'), limit(100))));
  });
});

describe('Firestore rules — ownership, scope, and known IDs', () => {
  it('limits operator master-data reads to assignment ACLs, including direct IDs', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertSucceeds(getDoc(doc(db, 'clients/authorized')));
    await assertFails(getDoc(doc(db, 'clients/private')));
    await assertSucceeds(getDoc(doc(db, 'sites/site')));
    await assertFails(getDoc(doc(db, 'sites/private-site')));
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'clients'),
          where('operatorIds', 'array-contains', 'operator'),
          limit(50),
        ),
      ),
    );
    await assertFails(
      getDocs(query(collection(db, 'clients'), where('operatorIds', 'array-contains', 'operator'))),
    );
  });

  it('denies direct access to another operator request, quote, document, and audit log', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertFails(getDoc(doc(db, 'requests/other')));
    await assertFails(getDoc(doc(db, 'quotes/other-draft')));
    await assertFails(getDoc(doc(db, 'documents/other-draft')));
    await assertFails(getDoc(doc(db, 'auditLogs/other-log')));
    await assertSucceeds(getDoc(doc(db, 'auditLogs/operator-log')));
  });

  it('exposes only known settings documents to active operators', async () => {
    const operatorDb = environment.authenticatedContext('operator').firestore();
    await assertSucceeds(getDoc(doc(operatorDb, 'settings/companyProfile')));
    await assertSucceeds(getDoc(doc(operatorDb, 'settings/quoteDefaults')));
    await assertFails(getDoc(doc(operatorDb, 'settings/internalSecret')));
    await assertFails(getDocs(query(collection(operatorDb, 'settings'), limit(20))));
  });

  it('allows both administrator profiles to update known settings and denies operators', async () => {
    for (const uid of ['admin', 'promoted-admin']) {
      const db = environment.authenticatedContext(uid).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'settings/companyProfile'), {
          companyName: `Enfriamatic ${uid}`,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        }),
      );
    }

    const operatorDb = environment.authenticatedContext('operator').firestore();
    await assertFails(
      updateDoc(doc(operatorDb, 'settings/quoteDefaults'), {
        validityDays: 30,
        updatedAt: serverTimestamp(),
        updatedBy: 'operator',
      }),
    );
    await assertFails(
      setDoc(doc(operatorDb, 'settings/unknown'), {
        value: true,
        ...audit(),
      }),
    );
  });
});

describe('Firestore rules — create, update, delete, and immutable fields', () => {
  it('allows valid admin master-data writes but freezes ACL and denies deletion', async () => {
    const db = environment.authenticatedContext('admin').firestore();
    const reference = doc(db, 'clients/new-client');
    await assertSucceeds(
      setDoc(reference, {
        ...client([]),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'admin',
        updatedBy: 'admin',
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        name: 'Cliente actualizado',
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(
      updateDoc(reference, {
        operatorIds: ['operator'],
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(
      updateDoc(reference, {
        notes: 'x'.repeat(2001),
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(deleteDoc(reference));
  });

  it('allows only explicit request transitions and immutable ownership', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'requests/assigned'), {
        status: 'in_progress',
        updatedAt: serverTimestamp(),
        updatedBy: 'operator',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'requests/assigned-invalid'), {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'operator',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'requests/assigned-invalid'), {
        assignedTo: 'other',
        updatedAt: serverTimestamp(),
        updatedBy: 'operator',
      }),
    );
    await assertFails(deleteDoc(doc(db, 'requests/assigned-invalid')));
  });

  it('allows admin request creation and assignment but denies physical deletion', async () => {
    const db = environment.authenticatedContext('admin').firestore();
    const reference = doc(db, 'requests/new-request');
    await assertSucceeds(
      setDoc(reference, {
        ...serviceRequest(null, 'pending'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'admin',
        updatedBy: 'admin',
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        status: 'assigned',
        assignedTo: 'operator',
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(deleteDoc(reference));
  });

  it('enforces active client, site, equipment, scope, and assignee relationships', async () => {
    const db = environment.authenticatedContext('admin').firestore();
    const base = {
      ...serviceRequest(null, 'pending'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: 'admin',
      updatedBy: 'admin',
    };
    await assertSucceeds(setDoc(doc(db, 'requests/general-scope'), base));
    await assertSucceeds(
      setDoc(doc(db, 'requests/equipment-scope'), {
        ...base,
        scope: 'equipment',
        equipmentId: 'equipment',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'requests/cross-client'), {
        ...base,
        clientId: 'private',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'requests/missing-equipment'), {
        ...base,
        scope: 'equipment',
        equipmentId: null,
      }),
    );
    await assertFails(
      setDoc(doc(db, 'requests/inactive-assignee'), {
        ...base,
        status: 'assigned',
        assignedTo: 'inactive',
        assignedAt: serverTimestamp(),
      }),
    );
  });

  it('allows file metadata only to the expected admin/operator scope and supports cleanup', async () => {
    const adminDb = environment.authenticatedContext('promoted-admin').firestore();
    const operatorDb = environment.authenticatedContext('operator').firestore();
    const siteFile = {
      siteId: 'site',
      type: 'photo',
      storagePath: 'sites/site/site-file/site-file.png',
      fileName: 'foto.png',
      mimeType: 'image/png',
      sizeBytes: 3,
      description: '',
      isPrimary: false,
      status: 'pending',
      createdAt: serverTimestamp(),
      createdBy: 'promoted-admin',
      updatedAt: serverTimestamp(),
      updatedBy: 'promoted-admin',
      schemaVersion: 1,
    };
    await assertSucceeds(setDoc(doc(adminDb, 'siteFiles/site-file'), siteFile));
    await assertFails(
      setDoc(doc(operatorDb, 'siteFiles/operator-site-file'), {
        ...siteFile,
        storagePath: 'sites/site/operator-site-file/operator-site-file.png',
        createdBy: 'operator',
        updatedBy: 'operator',
      }),
    );
    await assertSucceeds(deleteDoc(doc(adminDb, 'siteFiles/site-file')));

    const equipmentFile = {
      equipmentId: 'equipment',
      type: 'photo',
      storagePath: 'equipment/equipment/equipment-file/equipment-file.png',
      fileName: 'foto.png',
      mimeType: 'image/png',
      sizeBytes: 3,
      description: '',
      status: 'pending',
      createdAt: serverTimestamp(),
      createdBy: 'operator',
      updatedAt: serverTimestamp(),
      updatedBy: 'operator',
      schemaVersion: 1,
    };
    await assertSucceeds(setDoc(doc(operatorDb, 'equipmentFiles/equipment-file'), equipmentFile));
    await assertSucceeds(deleteDoc(doc(operatorDb, 'equipmentFiles/equipment-file')));
  });

  it('keeps completion, reopening, cancellation, and assignment history backend-owned', async () => {
    const db = environment.authenticatedContext('admin').firestore();
    await assertFails(
      setDoc(doc(db, 'requests/forged-completion'), {
        ...serviceRequest(null, 'completed'),
        finalNote: 'Resultado falsificado desde el cliente.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'admin',
        updatedBy: 'admin',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'requests/assigned'), {
        assignmentHistory: [{assignedTo: 'other'}],
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'requests/assigned'), {
        status: 'cancelled',
        cancellationReason: 'Mutación directa no autorizada.',
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      }),
    );
  });
});

describe('Firestore rules — quotes and line items', () => {
  it('allows a valid initial draft only when it exactly matches the linked request', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'quotes/new-valid'), {
        ...quote('operator', 'draft', false),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'operator',
        updatedBy: 'operator',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'quotes/cross-client'), {
        ...quote('operator', 'draft', false),
        clientId: 'private',
        siteId: 'private-site',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'operator',
        updatedBy: 'operator',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'quotes/forged-owner'), {
        ...quote('operator', 'draft', false),
        assignedTo: 'other',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'operator',
        updatedBy: 'operator',
      }),
    );
  });

  it('blocks forged issuance and correction metadata on client-created drafts', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertFails(
      setDoc(doc(db, 'quotes/forged-correction'), {
        ...quote('operator', 'draft', false),
        originalQuoteId: 'issued',
        revisionNumber: 999,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'operator',
        updatedBy: 'operator',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'quotes/forged-issuance'), {
        ...quote('operator', 'draft', false),
        issuedBy: 'operator',
        issuanceKey: 'attacker-controlled',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'operator',
        updatedBy: 'operator',
      }),
    );
  });

  it('freezes quote ownership and issued quotes', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertFails(
      updateDoc(doc(db, 'quotes/draft'), {
        clientId: 'private',
        updatedAt: serverTimestamp(),
        updatedBy: 'operator',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'quotes/issued'), {
        notes: 'Intento de alteración',
        updatedAt: serverTimestamp(),
        updatedBy: 'operator',
      }),
    );
    await assertFails(deleteDoc(doc(db, 'quotes/draft')));
  });

  it('validates line-item bounds and permits deletion only while the parent is editable', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    const validItem = item();
    const itemRef = doc(db, 'quotes/draft/items/valid');
    await assertSucceeds(
      setDoc(itemRef, {
        ...validItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(db, 'quotes/draft/items/excessive-percent'), {
        ...validItem,
        discountType: 'percentage',
        discountValue: 101,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(db, 'quotes/draft/items/excessive-fixed'), {
        ...validItem,
        discountType: 'fixed',
        discountValue: 101,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(db, 'quotes/draft/items/oversized'), {
        ...validItem,
        description: 'x'.repeat(2001),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(itemRef));
    await assertFails(
      setDoc(doc(db, 'quotes/issued/items/new'), {
        ...validItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('Firestore rules — minimum privilege and backend-owned data', () => {
  it('lets notification owners mark read and nothing else', async () => {
    const db = environment.authenticatedContext('operator').firestore();
    await assertSucceeds(getDoc(doc(db, 'notifications/operator-note')));
    await assertFails(getDoc(doc(db, 'notifications/other-note')));
    await assertSucceeds(
      updateDoc(doc(db, 'notifications/operator-note'), {
        read: true,
        readAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'notifications/operator-note'), {
        message: 'Contenido alterado',
      }),
    );
    await assertFails(setDoc(doc(db, 'notifications/fake'), notification('operator')));
    await assertFails(deleteDoc(doc(db, 'notifications/operator-note')));
  });

  it('denies all client mutations of audit, document, counter, and issuance records', async () => {
    for (const uid of ['admin', 'operator']) {
      const db = environment.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, 'auditLogs/fake'), auditLog(uid)));
      await assertFails(updateDoc(doc(db, 'auditLogs/operator-log'), {action: 'fake'}));
      await assertFails(deleteDoc(doc(db, 'auditLogs/operator-log')));
      await assertFails(setDoc(doc(db, 'documents/fake'), {status: 'ready'}));
      await assertFails(setDoc(doc(db, 'counters/quotes-2026'), {value: 999}));
      await assertFails(setDoc(doc(db, 'quotes/issued/issuanceAttempts/fake'), {status: 'ready'}));
      await assertFails(getDoc(doc(db, 'quotes/issued/issuanceAttempts/known-attempt')));
    }
  });
});

function profile(
  uid: string,
  role: 'admin' | 'operator' | 'reader',
  status: 'active' | 'inactive' = 'active',
) {
  return {
    uid,
    email: `${uid}@example.test`,
    displayName: uid,
    role,
    status,
    createdAt: new Date(),
    createdBy: 'admin',
    updatedAt: new Date(),
    updatedBy: 'admin',
    lastLoginAt: null,
    schemaVersion: 1,
  };
}

function audit() {
  return {
    createdAt: new Date(),
    createdBy: 'admin',
    updatedAt: new Date(),
    updatedBy: 'admin',
    schemaVersion: 1,
  };
}

function internalCatalog(type: string, name: string, value: string) {
  return {type, name, value, status: 'active', ...audit()};
}

function client(operatorIds: string[]) {
  return {
    name: 'Cliente de prueba',
    status: 'active',
    operatorIds,
    ...audit(),
  };
}

function site(operatorIds: string[]) {
  return {
    clientId: 'authorized',
    name: 'Planta',
    type: 'plant',
    address: {
      street: 'Industrial',
      city: 'Querétaro',
      state: 'Querétaro',
      postalCode: '76000',
      country: 'México',
    },
    status: 'active',
    operatorIds,
    ...audit(),
  };
}

function equipment(operatorIds: string[]) {
  return {
    clientId: 'authorized',
    siteId: 'site',
    name: 'Chiller',
    category: 'HVAC',
    status: 'active',
    operatorIds,
    ...audit(),
  };
}

function serviceRequest(
  assignedTo: string | null,
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled',
) {
  return {
    clientId: 'authorized',
    siteId: 'site',
    equipmentId: null,
    scope: 'site',
    title: 'Solicitud',
    description: 'Diagnóstico',
    priority: 'normal',
    status,
    assignedTo,
    assignedAt: assignedTo ? new Date() : null,
    completedAt: null,
    correctionOfRequestId: null,
    correctionOfQuoteId: null,
    ...audit(),
  };
}

function quote(
  assignedTo: string,
  status: 'draft' | 'issued',
  locked: boolean,
  requestId = 'assigned',
) {
  return {
    folio: status === 'issued' ? 'COT-2026-000001' : '',
    requestId,
    assignedTo,
    clientId: 'authorized',
    siteId: 'site',
    equipmentId: null,
    status,
    documentStatus: status === 'issued' ? 'ready' : 'not_generated',
    currency: 'MXN',
    taxRate: 0.16,
    discountDisplayMode: 'detailed',
    subtotalOriginal: 100,
    discountTotal: 0,
    subtotalFinal: 100,
    taxTotal: 16,
    grandTotal: 116,
    notes: '',
    validityDays: 15,
    validUntil: status === 'issued' ? new Date() : null,
    issuedAt: status === 'issued' ? new Date() : null,
    issuedBy: status === 'issued' ? assignedTo : null,
    originalQuoteId: null,
    revisionNumber: 1,
    locked,
    ...audit(),
  };
}

function item() {
  return {
    position: 0,
    quantity: 1,
    unit: 'servicio',
    description: 'Diagnóstico',
    originalUnitPrice: 100,
    discountType: 'none',
    discountValue: 0,
    discountAmount: 0,
    finalUnitPrice: 100,
    lineSubtotal: 100,
    taxable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function catalogSnapshot(code: string) {
  return {
    code,
    type: 'product',
    name: 'Producto de prueba',
    description: 'Descripción del producto de prueba',
    category: 'Repuestos',
    unit: 'pieza',
    brand: 'Marca Demo',
    model: 'Modelo Demo',
    basePrice: 100,
    taxable: true,
  };
}

function catalogItem(
  code: string,
  status: 'active' | 'inactive',
  type: 'product' | 'service' = 'product',
) {
  return {
    ...catalogSnapshot(code),
    type,
    status,
    searchTokens: ['producto', 'prueba'],
    ...audit(),
  };
}

function companyProfile() {
  return {
    companyName: 'Enfriamatic',
    ...audit(),
  };
}

function quoteDefaults() {
  return {
    taxRate: 0.16,
    validityDays: 15,
    currency: 'MXN',
    folioPrefix: 'COT',
    ...audit(),
  };
}

function notification(userId: string) {
  return {
    userId,
    type: 'request_assigned',
    title: 'Asignación',
    message: 'Nueva solicitud',
    resourceType: 'request',
    resourceId: 'assigned',
    read: false,
    readAt: null,
    createdAt: new Date(),
  };
}

function auditLog(actorId: string) {
  return {
    actorId,
    actorRole: 'operator',
    action: 'requests.updated',
    resourceType: 'requests',
    resourceId: 'assigned',
    requestId: 'assigned',
    quoteId: null,
    before: null,
    after: {status: 'assigned'},
    metadata: {},
    createdAt: new Date(),
  };
}
