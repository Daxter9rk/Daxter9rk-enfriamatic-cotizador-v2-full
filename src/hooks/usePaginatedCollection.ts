import {useCallback, useEffect, useRef, useState} from 'react';
import type {QueryConstraint} from 'firebase/firestore';
import {
  listDocumentsPage,
  type CollectionCursor,
  type CollectionOrder,
} from '../services/firebase/data';

export function usePaginatedCollection<T>(
  collectionName: Parameters<typeof listDocumentsPage>[0],
  queryConstraints: QueryConstraint[] = [],
  order: CollectionOrder[],
  pageSize = 25,
  enabled = true,
  queryKey = '',
) {
  const [data, setData] = useState<Array<T & {id: string}>>([]);
  const [cursor, setCursor] = useState<CollectionCursor | null>(null);
  const [previousCursors, setPreviousCursors] = useState<CollectionCursor[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const constraintKey = `${queryKey}|${queryConstraints.map((item) => item.type).join('|')}`;
  const orderKey = order.map((item) => `${item.field}:${item.direction}`).join('|');

  const load = useCallback(
    async (nextCursor: CollectionCursor | null, history: CollectionCursor[]) => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      setError(null);
      if (!enabled) {
        setData([]);
        setCursor(null);
        setPreviousCursors([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      try {
        const page = await listDocumentsPage<T>(
          collectionName,
          queryConstraints,
          order,
          pageSize,
          nextCursor,
        );
        if (currentRequest !== requestId.current) return;
        setData(page.data);
        setCursor(page.cursor);
        setPreviousCursors(history);
        setHasMore(page.hasMore);
      } catch {
        if (currentRequest === requestId.current)
          setError(
            'No fue posible cargar la información. Revisa tu conexión e inténtalo de nuevo.',
          );
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    // QueryConstraint has no public serializable representation; callers pass stable arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionName, constraintKey, orderKey, pageSize, enabled],
  );

  useEffect(() => {
    void load(null, []);
  }, [load]);

  return {
    data,
    loading,
    error,
    hasMore,
    page: previousCursors.length + 1,
    nextPage: () => (cursor ? load(cursor, [...previousCursors, cursor]) : Promise.resolve()),
    previousPage: () => {
      const history = previousCursors.slice(0, -1);
      return load(previousCursors.at(-2) ?? null, history);
    },
    reload: () => load(previousCursors.at(-1) ?? null, previousCursors),
  };
}
