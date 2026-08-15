import {useMemo, useState} from 'react';
import {Link} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Icon, type IconName} from '../../components/Icon';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import type {Quote} from '../../models/domain';
import {constraints} from '../../services/firebase/data';
import {useCollection} from '../../hooks/useCollection';
import {formatCurrency, formatDate} from '../../utils/format';

const quoteStatusLabels: Record<Quote['status'], string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  expired: 'Vencida',
};

export function DashboardPage() {
  const {profile} = useAuth();
  const quoteConstraints = useMemo(
    () => [
      ...(profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : []),
      constraints.newestUpdated(),
    ],
    [profile],
  );
  const quotes = useCollection<Quote>('quotes', quoteConstraints, 20);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(new Date());

  const refresh = async () => {
    setRefreshing(true);
    await quotes.reload();
    setUpdatedAt(new Date());
    setRefreshing(false);
  };

  if (quotes.loading) return <StatePanel kind="loading" title="Preparando tu panel…" />;
  if (quotes.error) {
    return (
      <StatePanel kind="error" title="No fue posible cargar el panel">
        <p>{quotes.error}</p>
        <button className="button button--secondary" onClick={() => void refresh()}>
          Reintentar
        </button>
      </StatePanel>
    );
  }

  const recentQuotes = quotes.data.slice(0, 7);
  const drafts = quotes.data.filter((item) => item.status === 'draft').length;
  const failed = quotes.data.filter((item) => item.documentStatus === 'failed').length;
  const issued = quotes.data.filter((item) => item.status === 'issued');
  const issuedTotal = issued.reduce((sum, item) => sum + item.grandTotal, 0);

  return (
    <>
      <PageHeader
        eyebrow="Centro comercial"
        title={`Buen día, ${profile?.displayName.split(' ')[0] ?? ''}`}
        description={
          profile?.role === 'admin'
            ? 'Supervisión comercial y seguimiento de cotizaciones.'
            : 'Preparación y seguimiento de tus cotizaciones.'
        }
        actions={
          <div className="refresh-control">
            <button
              className="button button--secondary"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <Icon name="refresh" />
              {refreshing ? 'Actualizando…' : 'Actualizar datos'}
            </button>
            <small>Actualizado {relativeTime(updatedAt)}</small>
          </div>
        }
      />
      <section className="dashboard-actions" aria-label="Acciones rápidas">
        <QuickAction href="/quotes?new=1" icon="quote" label="Nueva cotización" />
        <QuickAction href="/quotes" icon="quote" label="Cotizaciones" />
        <QuickAction href="/clients" icon="client" label="Clientes" />
        <QuickAction href="/commercial-catalog" icon="catalog" label="Catálogo comercial" />
        <QuickAction href="/support" icon="support" label="Manual / Soporte" />
      </section>
      {failed > 0 && (
        <Link href="/quotes?documentStatus=failed" className="dashboard-alert">
          <span>
            <strong>
              {failed} documento{failed === 1 ? '' : 's'} reciente{failed === 1 ? '' : 's'} con
              fallo
            </strong>
            <small>El folio se conserva; abre la cotización para reintentar.</small>
          </span>
          <span>Revisar →</span>
        </Link>
      )}
      <section
        className="metrics-grid metrics-grid--operational"
        aria-label="Resumen comercial reciente"
      >
        <Metric
          href="/quotes?status=draft"
          icon="quote"
          label="Borradores recientes"
          value={drafts}
          caption="En las últimas cotizaciones"
          tone="warning"
        />
        <Metric
          href="/quotes?status=issued"
          icon="quote"
          label="Emitidas recientes"
          value={issued.length}
          caption="En las últimas cotizaciones"
          tone="success"
        />
        <Metric
          href="/quotes"
          icon="quote"
          label="Monto emitido reciente"
          value={formatCurrency(issuedTotal)}
          caption="No representa un total histórico"
          wide
        />
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Actividad comercial</p>
              <h2>Cotizaciones recientes</h2>
            </div>
            <Link href="/quotes">Ver cotizaciones</Link>
          </div>
          {recentQuotes.length === 0 ? (
            <p className="empty-copy">No hay cotizaciones recientes.</p>
          ) : (
            <div className="stack-list">
              {recentQuotes.map((quote) => (
                <Link href={`/quotes/${quote.id}`} className="stack-row" key={quote.id}>
                  <div>
                    <strong>{quote.folio || 'Borrador sin folio'}</strong>
                    <span>
                      Cliente {quote.clientId} · {quoteStatusLabels[quote.status]} ·{' '}
                      {formatCurrency(quote.grandTotal)} · {formatDate(quote.updatedAt)}
                    </span>
                  </div>
                  <span>→</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Enfoque</p>
              <h2>Qué atender ahora</h2>
            </div>
          </div>
          <div className="focus-list">
            <FocusItem
              value={drafts}
              label="cotizaciones recientes en borrador"
              href="/quotes?status=draft"
            />
            <FocusItem
              value={failed}
              label="documentos recientes con fallo"
              href="/quotes?documentStatus=failed"
            />
            <FocusItem
              value={recentQuotes.length}
              label="cotizaciones recientes visibles"
              href="/quotes"
            />
          </div>
        </section>
      </div>
      <Link className="support-fab" href="/support">
        <Icon name="support" />
        <span>Ayuda</span>
      </Link>
    </>
  );

  function QuickAction({href, icon, label}: {href: string; icon: IconName; label: string}) {
    return (
      <Link href={href}>
        <span>
          <Icon name={icon} />
        </span>
        <strong>{label}</strong>
      </Link>
    );
  }
}

function Metric({
  href,
  icon,
  label,
  value,
  caption,
  tone = 'blue',
  wide = false,
}: {
  href: string;
  icon: IconName;
  label: string;
  value: string | number;
  caption?: string;
  tone?: 'blue' | 'warning' | 'success';
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`metric metric--link metric--${tone}${wide ? ' metric--wide' : ''}`}
    >
      <span className="metric__icon">
        <Icon name={icon} />
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}
    </Link>
  );
}

function FocusItem({value, label, href}: {value: number; label: string; href: string}) {
  return (
    <Link href={href}>
      <strong>{value}</strong>
      <span>{label}</span>
      <b>→</b>
    </Link>
  );
}

function relativeTime(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return 'hace unos segundos';
  return `hace ${Math.floor(seconds / 60)} min`;
}
