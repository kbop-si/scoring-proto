import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import SheetWindow from './pages/SheetWindow';

const isSheet = new URLSearchParams(window.location.search).has('sheet');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSheet ? <SheetWindow /> : <App />}
  </StrictMode>
);
