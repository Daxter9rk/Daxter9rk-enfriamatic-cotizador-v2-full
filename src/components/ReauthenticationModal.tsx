import {useState, type FormEvent} from 'react';
import {EmailAuthProvider, reauthenticateWithCredential} from 'firebase/auth';
import {useAuth} from '../app/providers/AuthProvider';
import {Modal} from './Modal';

export function ReauthenticationModal({
  title = 'Confirma tu identidad',
  description,
  onClose,
  onConfirmed,
}: {
  title?: string;
  description: string;
  onClose(): void;
  onConfirmed(): Promise<void>;
}) {
  const {user} = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.email) {
      setError('La sesión no tiene un correo disponible para reautenticación.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const password = String(new FormData(event.currentTarget).get('password') ?? '');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      await user.getIdToken(true);
      await onConfirmed();
    } catch {
      setError(
        'No fue posible confirmar tu identidad. Verifica la contraseña e inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <p className="field-wide">{description}</p>
        <label className="field-wide">
          Contraseña actual
          <input
            name="password"
            type="password"
            required
            minLength={1}
            maxLength={128}
            autoComplete="current-password"
            autoFocus
          />
        </label>
        {error && <p className="form-message form-message--error field-wide">{error}</p>}
        <div className="form-actions field-wide">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="button button--primary" disabled={busy}>
            {busy ? 'Confirmando…' : 'Confirmar identidad'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
