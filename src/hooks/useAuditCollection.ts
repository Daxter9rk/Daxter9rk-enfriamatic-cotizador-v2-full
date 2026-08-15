import {useCallback, useEffect, useMemo, useState} from 'react';
import type {QueryConstraint} from 'firebase/firestore';
import {listAuditLogs, type AuditLogCursor} from '../services/firebase/data';

export function useAuditCollection<T>(constraints: QueryConstraint[] = [], pageSize = 50) {
  const [data, setData] = useState<Array<T & {id: string}>>([]);
  const [cursor, setCursor] = useState<AuditLogCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const constraintKey = useMemo(
    () => constraints.map((item) => item.type).join('|'),
    [constraints],
  );

  const load = useCallback(
    async (append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const page = await listAuditLogs<T>(constraints, pageSize, append ? cursor : null);
        setData((current) => (append ? [...current, ...page.data] : page.data));
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      } catch {
        setError('No fue posible cargar la información. Revisa tu conexión e inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    },
    // QueryConstraint has no public serializable representation. Callers pass stable arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [constraintKey, cursor, pageSize],
  );

  const reload = useCallback(async () => {
    setCursor(null);
    await load(false);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !cursor) return;
    await load(true);
  }, [cursor, hasMore, load, loading]);

  useEffect(() => {
    setCursor(null);
    void load(false);
    // The constraint key changes when the actor scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constraintKey, pageSize]);

  return {data, error, hasMore, loading, loadMore, reload};
}
