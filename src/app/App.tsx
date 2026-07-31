import {lazy, Suspense} from 'react';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
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
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    );
  }
  if (state !== 'authenticated') {
    return <BlockedPage />;
  }

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <main className="centered-page">
            <StatePanel kind="loading" title="Cargando módulo…" />
          </main>
        }
      >
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="clients" element={<MasterDataPage kind="clients" />} />
            <Route path="sites" element={<MasterDataPage kind="sites" />} />
            <Route path="equipment" element={<MasterDataPage kind="equipment" />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="requests/:requestId" element={<RequestsPage />} />
            <Route path="quotes" element={<QuotesPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="manual" element={<ManualPage />} />
            {profile?.role === 'admin' ? (
              <>
                <Route path="users" element={<UsersPage />} />
                <Route path="catalogs" element={<CatalogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </>
            ) : (
              <>
                <Route path="users" element={<Navigate to="/" replace />} />
                <Route path="catalogs" element={<Navigate to="/" replace />} />
                <Route path="settings" element={<Navigate to="/" replace />} />
              </>
            )}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
