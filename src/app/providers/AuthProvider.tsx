import {onAuthStateChanged, signInWithEmailAndPassword, signOut, type User} from 'firebase/auth';
import {doc, getDoc} from 'firebase/firestore';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {AuthState, UserProfile} from '../../models/domain';
import {auth, db} from '../../services/firebase/config';
import {callFunction} from '../../services/firebase/data';
import {normalizeEmail} from '../../utils/format';

interface AuthContextValue {
  state: AuthState;
  user: User | null;
  profile: UserProfile | null;
  message: string | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function stateFromProfile(profile: UserProfile | null): AuthState {
  if (!profile) return 'missing-profile';
  if (profile.role !== 'admin' && profile.role !== 'operator') return 'invalid-role';
  if (profile.status === 'inactive') return 'inactive';
  if (profile.status === 'pending') return 'pending';
  if (profile.status === 'suspended') return 'suspended';
  return profile.status === 'active' ? 'authenticated' : 'error';
}

export function AuthProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async (currentUser: User) => {
    try {
      const snapshot = await getDoc(doc(db, 'users', currentUser.uid));
      const nextProfile = snapshot.exists() ? (snapshot.data() as UserProfile) : null;
      setProfile(nextProfile);
      setState(stateFromProfile(nextProfile));
      if (nextProfile?.status === 'active') {
        void callFunction('recordLogin', {}).catch(() => undefined);
      }
    } catch {
      setState('error');
      setMessage('No fue posible validar el perfil. Revisa tu conexión e inténtalo de nuevo.');
    }
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (currentUser) => {
        setMessage(null);
        setUser(currentUser);
        if (!currentUser) {
          setProfile(null);
          setState('anonymous');
          return;
        }
        setState('loading');
        void loadProfile(currentUser);
      }),
    [loadProfile],
  );

  const login = useCallback(async (email: string, password: string) => {
    setMessage(null);
    setState('loading');
    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
    } catch {
      setState('anonymous');
      setMessage('No se pudo iniciar sesión. Verifica tus datos y vuelve a intentarlo.');
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) await loadProfile(auth.currentUser);
  }, [loadProfile]);

  const value = useMemo(
    () => ({state, user, profile, message, login, logout, refreshProfile}),
    [state, user, profile, message, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}
