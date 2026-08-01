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
const RequestsPage = lazy(() =>
  import('../features/requests/RequestsPage').then((module) => ({default: module.RequestsPage})),
);
const QuotesPage = lazy(() =>
  import('../features/quotes/QuotesPage').then((module) => ({default: module.QuotesPage})),
);
const CatalogsPage = lazy(() =>
  import('../features/catalogs/CatalogsPage').then((module) => ({default: module.CatalogsPage})),
);
const CommercialCatalogPage = lazy(() =>
  import('../features/commercial-catalog/CommercialCatalogPage').then((module) => ({
    default: module.CommercialCatalogPage,
  })),
);
const ActivityPage = lazy(() =>
  import('../features/activity/ActivityPage').then((module) => ({default: module.ActivityPage})),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({default: module.SettingsPage})),
);
const ManualPage = lazy(() =>
  import('../features/manual/ManualPage').then((module) => ({default: module.ManualPage})),
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
          <Route path="/clients">
            <MasterDataPage kind="clients" />
          </Route>
          <Route path="/sites">
            <MasterDataPage kind="sites" />
          </Route>
          <Route path="/equipment">
            <MasterDataPage kind="equipment" />
          </Route>
          <Route path="/requests/:requestId" component={RequestsPage} />
          <Route path="/requests" component={RequestsPage} />
          <Route path="/quotes" component={QuotesPage} />
          <Route path="/commercial-catalog" component={CommercialCatalogPage} />
          <Route path="/activity" component={ActivityPage} />
          <Route path="/manual" component={ManualPage} />
          <Route path="/users">
            {profile?.role === 'admin' ? <UsersPage /> : <Redirect to="/" replace />}
          </Route>
          <Route path="/catalogs">
            {profile?.role === 'admin' ? <CatalogsPage /> : <Redirect to="/" replace />}
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
