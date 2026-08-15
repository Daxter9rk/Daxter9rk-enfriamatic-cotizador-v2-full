import {lazy, Suspense} from 'react';
import {Redirect, Route, Switch} from 'wouter';
import {useAuth} from './providers/AuthProvider';
import {StatePanel} from '../components/StatePanel';
import {AppShell} from '../layouts/AppShell';
import {LoginPage} from '../features/auth/LoginPage';
import {BlockedPage} from '../features/auth/BlockedPage';
import {NotFoundPage} from '../features/NotFoundPage';

const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((module) => ({default: module.DashboardPage})),
);
const UsersPage = lazy(() =>
  import('../features/users/UsersPage').then((module) => ({default: module.UsersPage})),
);
const MasterDataPage = lazy(() =>
  import('../features/master-data/MasterDataPage').then((module) => ({
    default: module.MasterDataPage,
  })),
);
const ClientDetailPage = lazy(() =>
  import('../features/master-data/EntityDetailPages').then((module) => ({
    default: module.ClientDetailPage,
  })),
);
const QuotesPage = lazy(() =>
  import('../features/quotes/QuotesPage').then((module) => ({default: module.QuotesPage})),
);
const CommercialCatalogPage = lazy(() =>
  import('../features/commercial-catalog/CommercialCatalogPage').then((module) => ({
    default: module.CommercialCatalogPage,
  })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({default: module.SettingsPage})),
);
const ManualPage = lazy(() =>
  import('../features/manual/ManualPage').then((module) => ({default: module.ManualPage})),
);
const SupportPage = lazy(() =>
  import('../features/support/SupportPage').then((module) => ({default: module.SupportPage})),
);

export function App() {
  const {state, profile} = useAuth();

  if (state === 'loading') {
    return (
      <main className="centered-page">
        <StatePanel kind="loading" title="Validando acceso seguro…" />
      </main>
    );
  }
  if (state === 'anonymous') {
    return <LoginPage />;
  }
  if (state !== 'authenticated') {
    return <BlockedPage />;
  }

  return (
    <Suspense
      fallback={
        <main className="centered-page">
          <StatePanel kind="loading" title="Cargando módulo…" />
        </main>
      }
    >
      <AppShell>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/clients/:clientId">
            {(params) => <ClientDetailPage clientId={params.clientId} />}
          </Route>
          <Route path="/clients">
            <MasterDataPage kind="clients" />
          </Route>
          <Route path="/sites/:siteId">
            <Redirect to="/quotes" replace />
          </Route>
          <Route path="/sites">
            <Redirect to="/quotes" replace />
          </Route>
          <Route path="/equipment/:equipmentId">
            <Redirect to="/quotes" replace />
          </Route>
          <Route path="/equipment">
            <Redirect to="/quotes" replace />
          </Route>
          <Route path="/requests/:requestId">
            <Redirect to="/quotes" replace />
          </Route>
          <Route path="/requests">
            <Redirect to="/quotes" replace />
          </Route>
          <Route path="/quotes" component={QuotesPage} />
          <Route path="/commercial-catalog" component={CommercialCatalogPage} />
          <Route path="/activity">
            <Redirect to="/quotes" replace />
          </Route>
          <Route path="/manual" component={ManualPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/users">
            {profile?.role === 'admin' ? <UsersPage /> : <Redirect to="/" replace />}
          </Route>
          <Route path="/catalogs">
            <Redirect to={profile?.role === 'admin' ? '/settings' : '/'} replace />
          </Route>
          <Route path="/settings">
            {profile?.role === 'admin' ? <SettingsPage /> : <Redirect to="/" replace />}
          </Route>
          <Route component={NotFoundPage} />
        </Switch>
      </AppShell>
    </Suspense>
  );
}
