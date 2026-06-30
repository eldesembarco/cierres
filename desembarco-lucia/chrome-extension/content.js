// LucIA · Reply Helper - content script
// Inyecta un botón floating en Google Maps / Business Profile Manager
// para abrir rápido el popup de la extension.

(function () {
  'use strict';

  // No inyectar si ya está
  if (document.getElementById('lucia-helper-fab')) return;

  // Detectar si estamos en una página relevante
  const isRelevantPage =
    location.hostname.includes('google.com') &&
    (location.pathname.includes('/maps') ||
      location.pathname.includes('/business') ||
      location.pathname.includes('/local'));

  if (!isRelevantPage) return;

  // Crear FAB
  const fab = document.createElement('div');
  fab.id = 'lucia-helper-fab';
  fab.title = 'LucIA · Borradores pendientes';
  fab.innerHTML = `
    <div style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: linear-gradient(135deg, #d4a017, #c8331e);
      color: #faf3e0;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      font-family: 'Cinzel', serif;
      font-weight: 900;
      font-size: 22px;
      transition: transform 0.2s ease;
      user-select: none;
    " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
      D
    </div>
  `;

  fab.addEventListener('click', () => {
    // No podemos abrir el popup de la extension programmatically (Chrome lo prohíbe)
    // Pero podemos abrir el panel de LucIA en una pestaña nueva.
    window.open('https://desembarco-lucia.vercel.app/dashboard', '_blank');
  });

  document.body.appendChild(fab);
})();
