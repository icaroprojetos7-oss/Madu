import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { CartProvider } from './context/CartContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { StoreSettingsProvider } from './context/StoreSettingsContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AdminAuthProvider>
        <CartProvider>
          <StoreSettingsProvider>
            <App />
          </StoreSettingsProvider>
        </CartProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
