// @vitest-environment node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {deleteObject, getBytes, ref, uploadBytes} from 'firebase/storage';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

let environment: RulesTestEnvironment;
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const pdfPath = 'quotes/quote-1/documents/document-1.pdf';

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-enfriamatic',
    storage: {
      rules: readFileSync(resolve('storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => environment?.cleanup());
beforeEach(async () => {
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), pdfPath), pdfBytes, {
      contentType: 'application/pdf',
    });
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
