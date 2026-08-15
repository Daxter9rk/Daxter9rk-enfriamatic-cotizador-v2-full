import {useEffect, useState} from 'react';
import {collection, limit, onSnapshot, query, type QueryConstraint} from 'firebase/firestore';
import {db} from '../services/firebase/config';

export function useRealtimeCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  pageSize = 30,
  enabled = true,
) {
  const [data, setData] = useState<Array<T & {id: string}>>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, collectionName), ...constraints, limit(pageSize)),
      (snapshot) => {
        setData(snapshot.docs.map((item) => ({id: item.id, ...item.data()}) as T & {id: string}));
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError('No fue posible mantener la información actualizada.');
      },
    );
    return unsubscribe;
  }, [collectionName, constraints, pageSize, enabled]);

  return {data, loading, error};
}
