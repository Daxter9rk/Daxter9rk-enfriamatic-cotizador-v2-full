import {Link} from 'react-router-dom';
import {StatePanel} from '../components/StatePanel';

export function NotFoundPage() {
  return (
    <StatePanel kind="error" title="Ruta no encontrada">
      <p>La dirección solicitada no forma parte del cotizador.</p>
      <Link className="button button--primary" to="/">
        Volver al inicio
      </Link>
    </StatePanel>
  );
}
