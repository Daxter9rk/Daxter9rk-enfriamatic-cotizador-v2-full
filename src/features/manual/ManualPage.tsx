import {useMemo, useState} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {administratorManual, operatorManual} from '../../content/manuals';

export function ManualPage() {
  const {profile} = useAuth();
  const [search, setSearch] = useState('');
  const sections = profile?.role === 'admin' ? administratorManual : operatorManual;
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-MX');
    if (!term) return sections;
    return sections.filter((section) =>
      [section.title, section.summary, ...section.steps]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(term),
    );
  }, [search, sections]);
  return (
    <>
      <PageHeader
        eyebrow="Ayuda operativa"
        title={`Manual de ${profile?.role === 'admin' ? 'administrador' : 'operador'}`}
        description="Procedimientos completos, restricciones y recuperación para operar con seguridad."
      />
      <label className="search-field manual-search">
        Buscar en el manual
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej. PDF, corrección, catálogo…"
        />
      </label>
      <section className="manual-grid" aria-label={`${visible.length} temas del manual`}>
        {visible.map((section, index) => (
          <details key={section.title} open={index === 0 && !search}>
            <summary>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{section.title}</strong>
            </summary>
            <p>{section.summary}</p>
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        ))}
      </section>
      {visible.length === 0 && (
        <p className="empty-copy">No hay temas que coincidan con la búsqueda.</p>
      )}
    </>
  );
}
