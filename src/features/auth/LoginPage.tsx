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
        <p className="eyebrow">Control industrial</p>
        <h1>Cotizaciones técnicas, bajo control</h1>
        <p>Acceso exclusivo para personal autorizado de Enfriamatic.</p>
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
          <span>ENFRIAMATIC</span>
          <strong>Precisión que mantiene la industria en movimiento.</strong>
        </div>
      </aside>
    </main>
  );
}
