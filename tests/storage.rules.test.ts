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
      setDoc(doc(context.firestore(), 'users/operator'), {
        role: 'operator',
        status: 'active',
      }),
      setDoc(doc(context.firestore(), 'users/other'), {
        role: 'operator',
        status: 'active',
      }),
      setDoc(doc(context.firestore(), 'sites/site-1'), {operatorIds: ['operator']}),
      setDoc(doc(context.firestore(), 'siteFiles/file-1'), {
        siteId: 'site-1',
        storagePath: 'sites/site-1/file-1/plano.pdf',
        mimeType: 'application/pdf',
        sizeBytes: pdfBytes.byteLength,
        status: 'pending',
        createdBy: 'operator',
        createdAt: now,
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
  const path = 'sites/site-1/file-1/plano.pdf';

  it('allows only an assigned active user to upload matching metadata and read a ready file', async () => {
    const operatorStorage = environment.authenticatedContext('operator').storage();
    await assertSucceeds(
      uploadBytes(ref(operatorStorage, path), pdfBytes, {contentType: 'application/pdf'}),
    );
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'siteFiles/file-1'), {status: 'ready'});
    });
    await assertSucceeds(getBytes(ref(operatorStorage, path)));
    await assertFails(getBytes(ref(environment.authenticatedContext('other').storage(), path)));
    await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), path)));
  });

  it('rejects a path, MIME type, size, or uploader that disagrees with metadata', async () => {
    const operatorStorage = environment.authenticatedContext('operator').storage();
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
});
