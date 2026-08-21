import {useEffect, useMemo, useRef, useState} from 'react';

export interface SearchableOption {
  value: string;
  label: string;
  keywords?: string;
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX');
}

export function SearchableSelect({
  name,
  label,
  options,
  value = '',
  placeholder = 'Buscar…',
  required = false,
  disabled = false,
  loading = false,
  onChange,
}: {
  name: string;
  label: string;
  options: SearchableOption[];
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange?(value: string): void;
}) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = `${name}-options`;
  const inputId = `${name}-search`;
  const keepTypedQuery = useRef(false);
  useEffect(() => {
    if (keepTypedQuery.current && value === '') {
      keepTypedQuery.current = false;
      return;
    }
    keepTypedQuery.current = false;
    setQuery(selected?.label ?? '');
  }, [selected?.label, value]);
  const visible = useMemo(() => {
    const term = normalizeSearch(query.trim());
    if (!term) return options.slice(0, 8);
    return options
      .filter((option) =>
        normalizeSearch(`${option.label} ${option.keywords ?? ''}`).includes(term),
      )
      .slice(0, 8);
  }, [options, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const choose = (option: SearchableOption) => {
    setQuery(option.label);
    setOpen(false);
    onChange?.(option.value);
  };

  return (
    <label className="searchable-select" htmlFor={inputId}>
      {label}
      <input type="hidden" name={name} value={value} />
      <input
        id={inputId}
        data-testid={name}
        type="search"
        value={query}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={
          open && visible[activeIndex] ? `${listboxId}-${visible[activeIndex].value}` : undefined
        }
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (event.target.value !== selected?.label) {
            keepTypedQuery.current = true;
            onChange?.('');
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((index) =>
              visible.length ? (index + direction + visible.length) % visible.length : 0,
            );
          }
          if (event.key === 'Enter' && open && visible[activeIndex]) {
            event.preventDefault();
            choose(visible[activeIndex]);
          }
        }}
      />
      {open && !disabled && (
        <span id={listboxId} className="searchable-select__options" role="listbox">
          {loading ? (
            <span className="searchable-select__empty">Cargando opciones…</span>
          ) : visible.length === 0 ? (
            <span className="searchable-select__empty">Sin coincidencias</span>
          ) : (
            visible.map((option, index) => (
              <button
                type="button"
                role="option"
                id={`${listboxId}-${option.value}`}
                aria-selected={option.value === value}
                className={index === activeIndex ? 'is-active' : undefined}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.label}
              </button>
            ))
          )}
        </span>
      )}
    </label>
  );
}
