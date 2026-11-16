import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrimeReactProvider } from 'primereact/api';
import 'primereact/resources/themes/lara-light-cyan/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import './styles.css';
import './dashboard.css';
import App from './App';
import { EngineProvider } from './context/EngineContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrimeReactProvider value={{ ripple: true }}>
      <EngineProvider><App /></EngineProvider>
    </PrimeReactProvider>
  </StrictMode>,
);
