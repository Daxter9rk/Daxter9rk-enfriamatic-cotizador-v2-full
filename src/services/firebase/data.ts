import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import {httpsCallable} from 'firebase/functions';
import {db, functions} from './config';

export type DomainCollection =
  | 'clients'
  | 'sites'
  | 'equipment'
  | 'requests'
  | 'quotes'
  | 'catalogs'
  | 'catalogItems'
  | 'settings'
  | 'notifications'
  | 'supportRequests'
  | 'siteFiles'
  | 'equipmentFiles'
  | 'equipmentInterventions';

export async function listDocuments<T>(
  collectionName: DomainCollection | 'users' | 'notifications' | 'auditLogs' | 'documents',
  constraints: QueryConstraint[] = [],
  pageSize = 50,
): Promise<Array<T & {id: string}>> {
  const ref = collection(db, collectionName);
  const snapshot = await getDocs(query(ref, ...constraints, limit(pageSize)));
  return snapshot.docs.map((item) => ({id: item.id, ...item.data()}) as T & {id: string});
}

export async function getDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const snapshot = await getDoc(doc(db, collectionName, id));
  return snapshot.exists() ? ({id: snapshot.id, ...snapshot.data()} as T) : null;
}

export async function createDocument(
  collectionName: DomainCollection,
  data: DocumentData,
  actorId: string,
): Promise<string> {
  const nowFields = {
    createdAt: serverTimestamp(),
    createdBy: actorId,
    updatedAt: serverTimestamp(),
    updatedBy: actorId,
    schemaVersion: 1,
  };
  const result = await addDoc(collection(db, collectionName), {...data, ...nowFields});
  return result.id;
}

export async function updateDocument(
  collectionName: DomainCollection,
  id: string,
  data: DocumentData,
  actorId: string,
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: actorId,
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true,
    readAt: serverTimestamp(),
  });
}

export async function setKnownDocument(
  collectionName: DomainCollection,
  id: string,
  data: DocumentData,
  actorId: string,
): Promise<void> {
  const reference = doc(db, collectionName, id);
  const existing = await getDoc(reference);
  await setDoc(
    reference,
    {
      ...data,
      ...(existing.exists()
        ? {}
        : {createdAt: serverTimestamp(), createdBy: actorId, schemaVersion: 1}),
      updatedAt: serverTimestamp(),
      updatedBy: actorId,
    },
    {merge: true},
  );
}

export async function saveQuoteItem(
  quoteId: string,
  itemId: string | null,
  data: DocumentData,
): Promise<string> {
  const itemRef = itemId
    ? doc(db, 'quotes', quoteId, 'items', itemId)
    : doc(collection(db, 'quotes', quoteId, 'items'));
  await setDoc(
    itemRef,
    {
      ...data,
      ...(itemId ? {} : {createdAt: serverTimestamp()}),
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
  return itemRef.id;
}

export async function listQuoteItems<T>(quoteId: string): Promise<Array<T & {id: string}>> {
  const snapshot = await getDocs(
    query(collection(db, 'quotes', quoteId, 'items'), orderBy('position'), limit(100)),
  );
  return snapshot.docs.map((item) => ({id: item.id, ...item.data()}) as T & {id: string});
}

export async function deleteQuoteItem(quoteId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'quotes', quoteId, 'items', itemId));
}

export const constraints = {
  newest: () => orderBy('createdAt', 'desc'),
  byClient: (clientId: string) => where('clientId', '==', clientId),
  bySite: (siteId: string) => where('siteId', '==', siteId),
  byEquipment: (equipmentId: string) => where('equipmentId', '==', equipmentId),
  assignedTo: (uid: string) => where('assignedTo', '==', uid),
  authorizedFor: (uid: string) => where('operatorIds', 'array-contains', uid),
  notificationsFor: (uid: string) => where('userId', '==', uid),
  auditFor: (uid: string) => where('actorId', '==', uid),
  activeOnly: () => where('status', '==', 'active'),
  createdBy: (uid: string) => where('createdBy', '==', uid),
};

export async function callFunction<TInput, TOutput>(name: string, data: TInput): Promise<TOutput> {
  const callable = httpsCallable<TInput, TOutput>(functions, name);
  const result = await callable(data);
  return result.data;
}
