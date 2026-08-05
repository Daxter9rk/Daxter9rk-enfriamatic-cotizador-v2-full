import {useState, type ReactNode} from 'react';
import {Link, useLocation} from 'wouter';
import {useAuth} from '../app/providers/AuthProvider';
import logo from '../assets/brand/enfriamatic-logo-transparent.png';
import {Icon, type IconName} from '../components/Icon';
import {NotificationCenter} from '../components/NotificationCenter';

interface NavigationItem {
  href: string;
  label: string;
  icon: IconName;
}

const operationalLinks: NavigationItem[] = [
  {href: '/', label: 'Inicio', icon: 'home'},
  {href: '/clients', label: 'Clientes', icon: 'client'},
  {href: '/sites', label: 'Instalaciones', icon: 'site'},
  {href: '/equipment', label: 'Equipos', icon: 'equipment'},
  {href: '/requests', label: 'Solicitudes', icon: 'request'},
  {href: '/quotes', label: 'Cotizaciones', icon: 'quote'},
  {href: '/commercial-catalog', label: 'Catálogo comercial', icon: 'catalog'},
  {href: '/activity', label: 'Actividad', icon: 'activity'},
];

const helpLinks: NavigationItem[] = [
  {href: '/manual', label: 'Manual', icon: 'manual'},
  {href: '/support', label: 'Soporte', icon: 'support'},
];

const adminLinks: NavigationItem[] = [
  {href: '/settings', label: 'Configuración', icon: 'settings'},
  {href: '/users', label: 'Usuarios y permisos', icon: 'users'},
  {href: '/catalogs', label: 'Catálogos internos', icon: 'catalog'},
];

export function AppShell({children}: {children: ReactNode}) {
  const {profile, logout} = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const operationItems = operationalLinks.map((item) =>
    item.href === '/requests' && profile?.role === 'operator'
      ? {...item, label: 'Mis solicitudes'}
      : item,
  );

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <img src={logo} alt="Enfriamatic Cotizador V2.1" />
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
          <span>Cotizador V2.1 · DEV</span>
        </div>
        <NavigationGroup
          label="Operación"
          items={operationItems}
          location={location}
          close={() => setOpen(false)}
        />
        {profile?.role === 'admin' && (
          <NavigationGroup
            label="Administración"
            items={adminLinks}
            location={location}
            close={() => setOpen(false)}
          />
        )}
        <NavigationGroup
          label="Ayuda"
          items={helpLinks}
          location={location}
          close={() => setOpen(false)}
        />
        <div className="sidebar__account">
          <strong>{profile?.displayName}</strong>
          <span>
            {profile?.role === 'admin' ? 'Administrador' : 'Operador'}
            {profile?.isPrimaryAdmin ? ' principal' : ''}
          </span>
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
      <main className="app-main">
        <header className="desktop-topbar">
          <div>
            <strong>Enfriamatic</strong>
            <span>Operación DEV · V2.1</span>
          </div>
          <NotificationCenter />
        </header>
        <div className="page-content">{children}</div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Accesos móviles">
        {operationItems.slice(0, 5).map((item) => (
          <NavigationLink
            key={item.href}
            item={item}
            location={location}
            close={() => undefined}
            compact
          />
        ))}
      </nav>
    </div>
  );
}

function NavigationGroup({
  label,
  items,
  location,
  close,
}: {
  label: string;
  items: NavigationItem[];
  location: string;
  close(): void;
}) {
  return (
    <div className="nav-group">
      <span>{label}</span>
      <nav aria-label={label}>
        {items.map((item) => (
          <NavigationLink key={item.href} item={item} location={location} close={close} />
        ))}
      </nav>
    </div>
  );
}

function NavigationLink({
  item,
  location,
  close,
  compact = false,
}: {
  item: NavigationItem;
  location: string;
  close(): void;
  compact?: boolean;
}) {
  const active =
    location === item.href || (item.href !== '/' && location.startsWith(`${item.href}/`));
  return (
    <Link href={item.href} onClick={close} className={active ? 'active' : undefined}>
      <Icon name={item.icon} />
      {compact ? <span>{item.label.split(' ')[0]}</span> : item.label}
    </Link>
  );
}
