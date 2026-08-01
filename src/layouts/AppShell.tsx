import {useState, type ReactNode} from 'react';
import {Link, useLocation} from 'wouter';
import {useAuth} from '../app/providers/AuthProvider';
import logo from '../assets/brand/enfriamatic-logo-transparent.png';

const adminLinks = [
  ['/', 'Inicio'],
  ['/users', 'Usuarios'],
  ['/clients', 'Clientes'],
  ['/sites', 'Instalaciones'],
  ['/equipment', 'Equipos'],
  ['/requests', 'Solicitudes'],
  ['/quotes', 'Cotizaciones'],
  ['/commercial-catalog', 'Catálogo comercial'],
  ['/catalogs', 'Catálogos'],
  ['/activity', 'Actividad'],
  ['/settings', 'Configuración'],
  ['/manual', 'Manual'],
] as const;

const operatorLinks = [
  ['/', 'Inicio'],
  ['/requests', 'Mis solicitudes'],
  ['/clients', 'Clientes'],
  ['/sites', 'Instalaciones'],
  ['/equipment', 'Equipos'],
  ['/quotes', 'Cotizaciones'],
  ['/commercial-catalog', 'Catálogo comercial'],
  ['/activity', 'Historial'],
  ['/manual', 'Manual'],
] as const;

export function AppShell({children}: {children: ReactNode}) {
  const {profile, logout} = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const links = profile?.role === 'admin' ? adminLinks : operatorLinks;

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <img src={logo} alt="Enfriamatic" />
        <button
          className="icon-button"
          aria-label="Abrir navegación"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          ☰
        </button>
      </header>
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="brand-block">
          <img src={logo} alt="Enfriamatic" />
          <span>Cotizador V2</span>
        </div>
        <nav aria-label="Navegación principal">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={
                location === href || (href !== '/' && location.startsWith(`${href}/`))
                  ? 'active'
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar__account">
          <strong>{profile?.displayName}</strong>
          <span>{profile?.role === 'admin' ? 'Administrador' : 'Operador'}</span>
          <button className="button button--ghost" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setOpen(false)}
        />
      )}
      <main className="app-main">{children}</main>
    </div>
  );
}
