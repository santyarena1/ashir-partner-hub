import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@/styles/index.css';
import { router } from '@/app/router';
import { SessionProvider } from '@/app/session';
import { CartProvider } from '@/app/cart';
import { ToastProvider } from '@/components/ui/overlays';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el nodo #root');

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <SessionProvider>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </SessionProvider>
    </ToastProvider>
  </StrictMode>,
);
