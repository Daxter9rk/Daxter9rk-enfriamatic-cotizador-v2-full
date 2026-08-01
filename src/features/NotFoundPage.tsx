import {Link} from 'wouter';
import {StatePanel} from '../components/StatePanel';

export function NotFoundPage() {
  return (
    <StatePanel kind="error" title="Ruta no encontrada">
      <p>La dirección solicitada no forma parte del cotizador.</p>
      <Link className="button button--primary" href="/">
        Volver al inicio
      </Link>
    </StatePanel>
  );
}
