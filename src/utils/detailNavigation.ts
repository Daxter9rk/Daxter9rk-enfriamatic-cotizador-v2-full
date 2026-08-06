export function detailIdFromSearch(search: string, key: string): string | null {
  const value = new URLSearchParams(search).get(key)?.trim();
  return value || null;
}

export function closeDetailSearch(search: string, key: string): string {
  const parameters = new URLSearchParams(search);
  parameters.delete(key);
  const value = parameters.toString();
  return value ? `?${value}` : '';
}

export function openDetailSearch(search: string, key: string, id: string): string {
  const parameters = new URLSearchParams(search);
  parameters.set(key, id);
  return `?${parameters.toString()}`;
}
