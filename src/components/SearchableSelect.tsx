import {useEffect, useMemo, useRef, useState} from 'react';

export interface SearchableOption {
  value: string;
  label: string;
  keywords?: string;
}

export function SearchableSelect({
  name,
  label,
  options,
  value = '',
  placeholder = 'Buscar…',
  required = false,
  disabled = false,
  onChange,
}: {
  name: string;
  label: string;
  options: SearchableOption[];
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?(value: string): void;
}) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
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
    const term = query.trim().toLocaleLowerCase('es-MX');
    if (!term || selected?.label === query) return options.slice(0, 30);
    return options
      .filter((option) =>
        `${option.label} ${option.keywords ?? ''}`.toLocaleLowerCase('es-MX').includes(term),
      )
      .slice(0, 30);
  }, [options, query, selected?.label]);

  const choose = (option: SearchableOption) => {
    setQuery(option.label);
    setOpen(false);
    onChange?.(option.value);
  };

  return (
    <label className="searchable-select">
      {label}
      <input type="hidden" name={name} value={value} />
      <input
        type="search"
        value={query}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (event.target.value !== selected?.label) {
            keepTypedQuery.current = true;
            onChange?.('');
          }
        }}
      />
      {open && !disabled && (
        <span className="searchable-select__options" role="listbox">
          {visible.length === 0 ? (
            <span className="searchable-select__empty">Sin coincidencias</span>
          ) : (
            visible.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
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
