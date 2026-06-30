// LucIA · Reply Helper - popup script
// Lista los borradores pendientes/aprobados y permite copiarlos al portapapeles
// con 1 click. También provee acción "marcar como enviado" para cerrar el log.

const API_BASES = [
  'https://lucia.eldesembarco.com',
  'https://desembarco-lucia.vercel.app',
];

async function getApiBase() {
  // Probar el dominio custom primero, fallback al .vercel.app
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}/api/health`, { credentials: 'include' });
      if (res.ok || res.status === 503) return base;
    } catch {
      /* continuar */
    }
  }
  return API_BASES[1];
}

async function fetchDrafts(apiBase) {
  const res = await fetch(`${apiBase}/api/extension/drafts-pending`, {
    credentials: 'include',
  });
  if (res.status === 401) return { unauthorized: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function markAsSent(apiBase, logId, finalText) {
  const res = await fetch(`${apiBase}/api/extension/mark-sent`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logId, finalText }),
  });
  return res.ok;
}

function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function escapeHtml(s) {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmpty(message) {
  document.getElementById('root').innerHTML = `
    <div class="empty">
      <div class="empty-ornament">◆</div>
      ${escapeHtml(message)}
    </div>
  `;
}

function renderUnauthorized(apiBase) {
  document.getElementById('root').innerHTML = `
    <div class="login-prompt">
      <p>No estás logueado en LucIA.</p>
      <a href="${apiBase}/login" target="_blank">Iniciar sesión</a>
    </div>
  `;
}

let currentFilter = 'all';
let allDrafts = [];
let apiBaseUrl = '';

function applyFilter() {
  let filtered = allDrafts;
  if (currentFilter === 'approved') {
    filtered = allDrafts.filter((d) => d.action === 'APPROVED');
  } else if (currentFilter === 'urgent') {
    filtered = allDrafts.filter((d) => d.rating > 0 && d.rating <= 2);
  } else if (currentFilter === 'pending') {
    filtered = allDrafts.filter(
      (d) => d.action === 'PENDING' && d.rating > 2
    );
  }
  renderList(filtered);
}

function renderList(drafts) {
  const root = document.getElementById('root');

  const counts = {
    urgent: allDrafts.filter((d) => d.rating > 0 && d.rating <= 2).length,
    pending: allDrafts.filter((d) => d.action === 'PENDING' && d.rating > 2).length,
    approved: allDrafts.filter((d) => d.action === 'APPROVED').length,
  };

  if (drafts.length === 0) {
    root.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="stat-num urgent">${counts.urgent}</div><div class="stat-label">Urgentes</div></div>
        <div class="stat"><div class="stat-num pending">${counts.pending}</div><div class="stat-label">Pendientes</div></div>
        <div class="stat"><div class="stat-num approved">${counts.approved}</div><div class="stat-label">Aprobadas</div></div>
      </div>
      ${renderFilterBar()}
      <div class="empty">
        <div class="empty-ornament">◇</div>
        Sin borradores con ese filtro.
      </div>
    `;
    bindFilterButtons();
    return;
  }

  const cards = drafts
    .map((d) => {
      const isUrgent = d.rating > 0 && d.rating <= 2;
      const isApproved = d.action === 'APPROVED';
      const cls = isUrgent ? 'urgent' : isApproved ? 'approved' : '';
      const stars = '★'.repeat(d.rating) + '☆'.repeat(5 - d.rating);
      const draftPreview = d.draft || '<em>sin borrador (manual)</em>';

      return `
        <div class="draft-card ${cls}" data-log-id="${d.logId}" data-final-text="${escapeHtml(d.draft || '')}">
          <div class="meta">
            <span class="author">${escapeHtml(d.autor)}</span>
            <span class="stars">${stars}</span>
          </div>
          <div class="meta">
            <span>${escapeHtml(d.brand)} · ${escapeHtml(d.local)}</span>
            <span>${d.action}</span>
          </div>
          ${d.reviewText ? `<div class="review-text">${escapeHtml(d.reviewText.slice(0, 200))}${d.reviewText.length > 200 ? '…' : ''}</div>` : ''}
          ${d.draft ? `<div class="draft-text">${escapeHtml(d.draft)}</div>` : ''}
          <div class="actions">
            ${d.draft ? `<button class="copy" data-text="${escapeHtml(d.draft)}">📋 Copiar</button>` : ''}
            ${d.draft ? `<button class="auto-paste ${isApproved ? 'success' : ''}" data-log-id="${d.logId}" data-draft="${escapeHtml(d.draft)}" data-action="${d.action}" data-brand="${escapeHtml(d.brand)}" data-reviewer="${escapeHtml(d.autor)}" data-review-text="${escapeHtml(d.reviewText || '')}" data-rating="${d.rating}">${isApproved ? '🚀 Auto-publicar' : '✦ Auto-pegar'}</button>` : ''}
            ${d.draft ? `<button class="copy-and-mark" data-log-id="${d.logId}" data-text="${escapeHtml(d.draft)}">Marcar enviado</button>` : ''}
            <button class="secondary open-review" data-review-id="${escapeHtml(d.reviewId)}">↗ Ver</button>
          </div>
        </div>
      `;
    })
    .join('');

  root.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="stat-num urgent">${counts.urgent}</div><div class="stat-label">Urgentes</div></div>
      <div class="stat"><div class="stat-num pending">${counts.pending}</div><div class="stat-label">Pendientes</div></div>
      <div class="stat"><div class="stat-num approved">${counts.approved}</div><div class="stat-label">Aprobadas</div></div>
    </div>
    ${renderFilterBar()}
    ${cards}
  `;

  bindFilterButtons();
  bindActions();
}

function renderFilterBar() {
  return `
    <div class="filter-bar">
      <button data-filter="all" class="${currentFilter === 'all' ? 'active' : ''}">Todas</button>
      <button data-filter="urgent" class="${currentFilter === 'urgent' ? 'active' : ''}">⚠ 1-2★</button>
      <button data-filter="pending" class="${currentFilter === 'pending' ? 'active' : ''}">Pend.</button>
      <button data-filter="approved" class="${currentFilter === 'approved' ? 'active' : ''}">✓ Aprob.</button>
    </div>
  `;
}

function bindFilterButtons() {
  document.querySelectorAll('.filter-bar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.getAttribute('data-filter');
      applyFilter();
    });
  });
}

function bindActions() {
  document.querySelectorAll('button.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-text');
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copiado al portapapeles');
      } catch {
        showToast('Error al copiar');
      }
    });
  });

  document.querySelectorAll('button.copy-and-mark').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-text');
      const logId = btn.getAttribute('data-log-id');
      try {
        await navigator.clipboard.writeText(text);
        const ok = await markAsSent(apiBaseUrl, logId, text);
        if (ok) {
          showToast('Copiado · marcado como enviado');
          // Refresh
          setTimeout(() => loadDrafts(), 800);
        } else {
          showToast('Copiado pero falló marcar como enviado');
        }
      } catch (e) {
        showToast('Error: ' + e.message);
      }
    });
  });

  document.querySelectorAll('button.open-review').forEach((btn) => {
    btn.addEventListener('click', () => {
      const reviewId = btn.getAttribute('data-review-id');
      // Abrir Google Maps con el lookup del review
      // (no hay deeplink directo, pero podemos abrir Business Profile Manager)
      chrome.tabs.create({ url: 'https://business.google.com/' });
    });
  });

  document.querySelectorAll('button.auto-paste').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const draftData = {
        logId: btn.getAttribute('data-log-id'),
        draft: btn.getAttribute('data-draft'),
        action: btn.getAttribute('data-action'),
        brand: btn.getAttribute('data-brand'),
        reviewerName: btn.getAttribute('data-reviewer'),
        reviewText: btn.getAttribute('data-review-text'),
        rating: parseInt(btn.getAttribute('data-rating') || '0', 10),
        queuedAt: Date.now(),
      };

      // construir clave (mismo formato que business-auto.js)
      const norm = (s) =>
        (s || '')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
      const key = `${norm(draftData.brand)}::${norm(draftData.reviewerName)}::${draftData.rating}`;

      // guardar en session storage
      chrome.storage.session.get(['lucia_queued_drafts'], (data) => {
        const queue = data.lucia_queued_drafts || {};
        queue[key] = draftData;
        chrome.storage.session.set({ lucia_queued_drafts: queue }, () => {
          showToast(
            draftData.action === 'APPROVED'
              ? '🚀 En cola para auto-publicar'
              : '✦ En cola para auto-pegar'
          );
          // abrir Business Profile en una nueva pestaña
          chrome.tabs.create({ url: 'https://business.google.com/reviews' });
          setTimeout(() => window.close(), 600);
        });
      });
    });
  });
}

async function loadDrafts() {
  apiBaseUrl = await getApiBase();
  try {
    const data = await fetchDrafts(apiBaseUrl);
    if (data.unauthorized) {
      renderUnauthorized(apiBaseUrl);
      return;
    }
    if (!data.ok) {
      renderEmpty('Error al cargar: ' + (data.error || 'desconocido'));
      return;
    }
    allDrafts = data.drafts || [];
    if (allDrafts.length === 0) {
      renderEmpty('Sin borradores pendientes ni aprobados.');
      return;
    }
    applyFilter();
  } catch (e) {
    renderEmpty('Error de red: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', loadDrafts);
