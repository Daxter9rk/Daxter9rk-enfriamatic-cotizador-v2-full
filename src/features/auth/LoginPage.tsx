import {useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import logo from '../../assets/brand/enfriamatic-logo-white-background.png';

export function LoginPage() {
  const {login, message, state} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await login(email, password);
  };

  return (
    <main className="auth-page">
      <section className="login-card">
        <img src={logo} alt="Enfriamatic" className="login-card__logo" />
        <p className="eyebrow">Enfriamatic Cotizador V2</p>
        <h1>Acceso al sistema</h1>
        <p>Ingresa tus credenciales para continuar.</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Correo electrónico
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="login-email"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="login-password"
            />
          </label>
          {message && <p className="form-message form-message--error">{message}</p>}
          <button
            className="button button--primary"
            disabled={state === 'loading'}
            data-testid="login-submit"
          >
            {state === 'loading' ? 'Validando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
      <aside className="auth-page__visual" aria-hidden="true">
        <div>
          <span>REFRIGERACIÓN INDUSTRIAL</span>
          <strong>La forma más rápida y precisa de cotizar soluciones industriales.</strong>
          <ul>
            <li>Cotizaciones profesionales en minutos</li>
            <li>Datos y trazabilidad de principio a fin</li>
            <li>Información privada y acceso por rol</li>
          </ul>
          <small>DEV · Los datos mostrados son ficticios y exclusivos para pruebas.</small>
        </div>
      </aside>
    </main>
  );
}
