// @vitest-environment node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {doc, setDoc, Timestamp, updateDoc} from 'firebase/firestore';
import {deleteObject, getBytes, ref, uploadBytes} from 'firebase/storage';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

let environment: RulesTestEnvironment;
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const pdfPath = 'quotes/quote-1/documents/document-1.pdf';

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-enfriamatic',
    firestore: {
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(resolve('storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => environment?.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), pdfPath), pdfBytes, {
      contentType: 'application/pdf',
    });
    const now = Timestamp.now();
    await Promise.all([
      setDoc(doc(context.firestore(), 'users/admin'), {role: 'admin', status: 'active'}),
      setDoc(doc(context.firestore(), 'users/promoted-admin'), {
        role: 'admin',
        status: 'active',
      }),
      setDoc(doc(context.firestore(), 'users/operator'), {
        role: 'operator',
        status: 'active',
      }),
      setDoc(doc(context.firestore(), 'users/other'), {
        role: 'operator',
        status: 'active',
      }),
      setDoc(doc(context.firestore(), 'sites/site-1'), {operatorIds: ['operator']}),
      setDoc(doc(context.firestore(), 'equipment/equipment-1'), {
        operatorIds: ['operator'],
      }),
      setDoc(doc(context.firestore(), 'siteFiles/file-1'), {
        siteId: 'site-1',
        storagePath: 'sites/site-1/file-1/file-1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: pdfBytes.byteLength,
        status: 'pending',
        createdBy: 'admin',
        createdAt: now,
        isPrimary: false,
      }),
      setDoc(doc(context.firestore(), 'equipmentFiles/equipment-file-1'), {
        equipmentId: 'equipment-1',
        storagePath: 'equipment/equipment-1/equipment-file-1/equipment-file-1.png',
        mimeType: 'image/png',
        sizeBytes: 3,
        status: 'pending',
        createdBy: 'operator',
        createdAt: now,
      }),
      setDoc(doc(context.firestore(), 'catalogItems/CAT-1'), {
        status: 'active',
        imageStoragePath: 'catalog/CAT-1/catalog-file/catalog-file.png',
        imageMimeType: 'image/png',
        imageSizeBytes: 3,
        imageStatus: 'pending',
      }),
      setDoc(doc(context.firestore(), 'supportRequests/support-1'), {
        createdBy: 'operator',
        attachmentStoragePath: 'support/support-1/support-file/support-file.png',
        attachmentMimeType: 'image/png',
        attachmentSizeBytes: 3,
        attachmentStatus: 'pending',
      }),
    ]);
  });
});

describe('Storage rules — private backend-only documents', () => {
  it('denies direct PDF reads by anonymous, admin, operator, inactive, and reader identities', async () => {
    const contexts = [
      environment.unauthenticatedContext(),
      environment.authenticatedContext('admin'),
      environment.authenticatedContext('operator'),
      environment.authenticatedContext('inactive'),
      environment.authenticatedContext('reader'),
    ];
    for (const context of contexts) {
      await assertFails(getBytes(ref(context.storage(), pdfPath)));
    }
  });

  it('denies direct create, overwrite, and delete even to authenticated admins', async () => {
    const storage = environment.authenticatedContext('admin').storage();
    await assertFails(
      uploadBytes(ref(storage, 'quotes/quote-2/documents/document-2.pdf'), pdfBytes, {
        contentType: 'application/pdf',
      }),
    );
    await assertFails(
      uploadBytes(ref(storage, pdfPath), new TextEncoder().encode('not-a-pdf'), {
        contentType: 'text/plain',
      }),
    );
    await assertFails(deleteObject(ref(storage, pdfPath)));
  });

  it('denies known-ID access and every path outside the quote document namespace', async () => {
    const storage = environment.authenticatedContext('operator').storage();
    await assertFails(getBytes(ref(storage, pdfPath)));
    await assertFails(uploadBytes(ref(storage, 'public/file.txt'), new TextEncoder().encode('x')));
    await assertFails(
      uploadBytes(ref(storage, 'quotes/quote-1/preview.png'), new Uint8Array([1, 2, 3])),
    );
  });
});

describe('Storage rules — private site files', () => {
  const path = 'sites/site-1/file-1/file-1.pdf';

  it('allows both admin variants to upload and assigned operators only to read a ready file', async () => {
    const operatorStorage = environment.authenticatedContext('operator').storage();
    const adminStorage = environment.authenticatedContext('admin').storage();
    await assertSucceeds(
      uploadBytes(ref(adminStorage, path), pdfBytes, {contentType: 'application/pdf'}),
    );
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'siteFiles/file-1'), {status: 'ready'});
    });
    await assertSucceeds(getBytes(ref(operatorStorage, path)));
    await assertFails(
      uploadBytes(ref(operatorStorage, path), pdfBytes, {contentType: 'application/pdf'}),
    );
    await assertFails(getBytes(ref(environment.authenticatedContext('other').storage(), path)));
    await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), path)));
  });

  it('rejects a path, MIME type, size, or uploader that disagrees with metadata', async () => {
    const operatorStorage = environment.authenticatedContext('admin').storage();
    await assertFails(
      uploadBytes(ref(operatorStorage, path), pdfBytes, {contentType: 'image/png'}),
    );
    await assertFails(
      uploadBytes(ref(operatorStorage, 'sites/site-1/file-1/otro.pdf'), pdfBytes, {
        contentType: 'application/pdf',
      }),
    );
    await assertFails(
      uploadBytes(ref(environment.authenticatedContext('other').storage(), path), pdfBytes, {
        contentType: 'application/pdf',
      }),
    );
    await assertFails(
      uploadBytes(ref(operatorStorage, path), new Uint8Array(pdfBytes.byteLength + 1), {
        contentType: 'application/pdf',
      }),
    );
  });

  it('lets an admin delete a non-primary object while an operator cannot', async () => {
    const creatorStorage = environment.authenticatedContext('admin').storage();
    const promotedAdminStorage = environment.authenticatedContext('promoted-admin').storage();
    await assertSucceeds(
      uploadBytes(ref(creatorStorage, path), pdfBytes, {contentType: 'application/pdf'}),
    );
    await assertFails(
      deleteObject(ref(environment.authenticatedContext('operator').storage(), path)),
    );
    await assertSucceeds(deleteObject(ref(promotedAdminStorage, path)));
  });
});

describe('Storage rules — equipment, catalog, and support', () => {
  const image = new Uint8Array([1, 2, 3]);

  it('allows an assigned operator to manage its equipment object but denies an unrelated operator', async () => {
    const path = 'equipment/equipment-1/equipment-file-1/equipment-file-1.png';
    const operatorStorage = environment.authenticatedContext('operator').storage();
    await assertSucceeds(
      uploadBytes(ref(operatorStorage, path), image, {contentType: 'image/png'}),
    );
    await assertSucceeds(deleteObject(ref(operatorStorage, path)));
    await assertFails(
      uploadBytes(ref(environment.authenticatedContext('other').storage(), path), image, {
        contentType: 'image/png',
      }),
    );
  });

  it('keeps legacy and backend catalog paths inaccessible to every browser identity', async () => {
    const path = 'catalog/CAT-1/catalog-file/catalog-file.png';
    const backendPath = 'catalog-items/CAT-1/images/backend-operation.png';
    await environment.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), path), image, {contentType: 'image/png'});
      await uploadBytes(ref(context.storage(), backendPath), image, {contentType: 'image/png'});
    });
    await assertFails(
      uploadBytes(ref(environment.authenticatedContext('promoted-admin').storage(), path), image, {
        contentType: 'image/png',
      }),
    );
    await assertFails(
      uploadBytes(ref(environment.authenticatedContext('operator').storage(), path), image, {
        contentType: 'image/png',
      }),
    );
    await assertFails(
      uploadBytes(ref(environment.authenticatedContext('admin').storage(), path), image, {
        contentType: 'image/svg+xml',
      }),
    );
    await assertFails(getBytes(ref(environment.authenticatedContext('admin').storage(), path)));
    await assertFails(deleteObject(ref(environment.authenticatedContext('admin').storage(), path)));
    await assertFails(
      getBytes(ref(environment.authenticatedContext('promoted-admin').storage(), backendPath)),
    );
    await assertFails(
      deleteObject(ref(environment.authenticatedContext('promoted-admin').storage(), backendPath)),
    );
    await assertFails(
      uploadBytes(
        ref(
          environment.authenticatedContext('admin').storage(),
          'catalog-items/CAT-1/images/client-controlled.png',
        ),
        image,
        {contentType: 'image/png'},
      ),
    );
  });

  it('keeps support captures private to the reporter and admins', async () => {
    const path = 'support/support-1/support-file/support-file.png';
    const operatorStorage = environment.authenticatedContext('operator').storage();
    await assertSucceeds(
      uploadBytes(ref(operatorStorage, path), image, {contentType: 'image/png'}),
    );
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'supportRequests/support-1'), {
        attachmentStatus: 'ready',
      });
    });
    await assertSucceeds(getBytes(ref(operatorStorage, path)));
    await assertSucceeds(getBytes(ref(environment.authenticatedContext('admin').storage(), path)));
    await assertFails(getBytes(ref(environment.authenticatedContext('other').storage(), path)));
  });
});
