import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app/App';
import {AuthProvider} from './app/providers/AuthProvider';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
