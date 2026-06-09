// Load bridge BEFORE anything else - this sets up window.tasklet
import './bridge';
import './styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
