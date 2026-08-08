import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

const publicOnlyBuild = import.meta.env.VITE_PUBLIC_ONLY === 'true';
const AdminApp = publicOnlyBuild ? null : lazy(() => import('./admin/AdminApp.jsx'));
const Root = !publicOnlyBuild && window.location.pathname === '/admin' ? AdminApp : App;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);
