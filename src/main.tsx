import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill for Chart.js
import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
Chart.register(...registerables);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);