import {useCallback, useEffect, useState} from 'react';
import type {QueryConstraint} from 'firebase/firestore';
import {listDocuments} from '../services/firebase/data';

interface CollectionState<T> {
  data: Array<T & {id: string}>;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
}

export function useCollection<T>(
  collectionName: Parameters<typeof listDocuments>[0],
  queryConstraints: QueryConstraint[] = [],
  pageSize = 50,
  enabled = true,
): CollectionState<T> {
  const [data, setData] = useState<Array<T & {id: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const constraintKey = queryConstraints.map((item) => item.type).join('|');

  const reload = useCallback(async () => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await listDocuments<T>(collectionName, queryConstraints, pageSize));
    } catch {
      setError('No fue posible cargar la información. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
    // QueryConstraint has no public serializable representation. Callers pass stable arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, constraintKey, pageSize, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {data, loading, error, reload};
}
