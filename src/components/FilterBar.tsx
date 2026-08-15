import type {ReactNode} from 'react';

export interface SortOption {
  value: string;
  label: string;
}

export function FilterBar({
  label = 'Filtros y orden',
  search,
  searchPlaceholder = 'Buscar…',
  sort,
  sortOptions,
  onSearch,
  onSort,
  onClear,
  children,
}: {
  label?: string;
  search: string;
  searchPlaceholder?: string;
  sort: string;
  sortOptions: SortOption[];
  onSearch(value: string): void;
  onSort(value: string): void;
  onClear(): void;
  children?: ReactNode;
}) {
  return (
    <section className="toolbar filter-bar" aria-label={label}>
      <label className="search-field">
        Buscar
        <input
          type="search"
          value={search}
          placeholder={searchPlaceholder}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      {children}
      <label>
        Orden
        <select value={sort} onChange={(event) => onSort(event.target.value)}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="button button--ghost" onClick={onClear}>
        Limpiar filtros
      </button>
    </section>
  );
}
