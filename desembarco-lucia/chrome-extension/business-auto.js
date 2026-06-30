// LucIA · Reply Helper — Auto-paste content script
// Runs on business.google.com + search.google.com/local
//
// Flujo:
//  1. Popup guarda drafts en chrome.storage.session bajo clave `lucia_queued_drafts`
//     formato: { [reviewerKey]: { logId, draft, action, brand, reviewerName, reviewText, rating } }
//     donde reviewerKey = `${brand}::${reviewerName.normalize()}::${rating}`
//
//  2. Este script observa el DOM, detecta cards de reseñas, y matchea con drafts en queue
//
//  3. Por cada match:
//     - Click "Responder" → espera al textarea → pega el draft
//     - Si action === 'APPROVED' → espera 2s + auto-click "Publicar" + mark-sent
//     - Si action === 'PENDING' → highlight "Publicar" + listener al click → mark-sent
//
// IMPORTANTE: Google cambia el DOM seguido. Si esto deja de funcionar, abrir DevTools
// y ver los console.log de `[lucia-auto]` para entender qué selector falló.

(function () {
  'use strict';

  if (window.__luciaAutoLoaded) return;
  window.__luciaAutoLoaded = true;

  const TAG = '[lucia-auto]';
  const PROCESSED_ATTR = 'data-lucia-processed';
  const HIGHLIGHT_CLASS = 'lucia-highlight';
  const PUBLISH_CLASS = 'lucia-publish-glow';

  const API_BASES = [
    'https://lucia.eldesembarco.com',
    'https://desembarco-lucia.vercel.app',
  ];

  // ────────── utilities ──────────

  function log(...args) {
    console.log(TAG, ...args);
  }

  function normalizeName(s) {
    if (!s) return '';
    return s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // accents
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function keyFor(brand, reviewerName, rating) {
    return `${normalizeName(brand)}::${normalizeName(reviewerName)}::${rating || ''}`;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitFor(predicate, { timeout = 5000, interval = 150 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const result = predicate();
      if (result) return result;
      await sleep(interval);
    }
    return null;
  }

  function injectStyles() {
    if (document.getElementById('lucia-auto-styles')) return;
    const style = document.createElement('style');
    style.id = 'lucia-auto-styles';
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 3px solid #d4a017 !important;
        outline-offset: 2px !important;
        background: rgba(212, 160, 23, 0.06) !important;
        transition: outline-color 0.3s ease;
      }
      .${PUBLISH_CLASS} {
        animation: lucia-pulse 1.4s ease-in-out infinite;
        box-shadow: 0 0 0 4px rgba(200, 51, 30, 0.4) !important;
        position: relative;
      }
      @keyframes lucia-pulse {
        0%, 100% { box-shadow: 0 0 0 4px rgba(200, 51, 30, 0.4); }
        50% { box-shadow: 0 0 0 8px rgba(200, 51, 30, 0.7); }
      }
      #lucia-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        background: linear-gradient(135deg, #2d1810, #4a2c1a);
        color: #faf3e0;
        padding: 12px 18px;
        border-left: 4px solid #d4a017;
        font-family: 'JetBrains Mono', monospace, system-ui;
        font-size: 12px;
        max-width: 320px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
        transform: translateX(20px);
        pointer-events: none;
        white-space: pre-wrap;
      }
      #lucia-toast.show {
        opacity: 1;
        transform: translateX(0);
      }
    `;
    document.head.appendChild(style);
  }

  function toast(msg, ms = 3000) {
    let el = document.getElementById('lucia-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lucia-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms);
    log('toast:', msg);
  }

  // ────────── API calls ──────────

  async function findApiBase() {
    for (const base of API_BASES) {
      try {
        const res = await fetch(`${base}/api/health`, { credentials: 'include' });
        if (res.ok || res.status === 503) return base;
      } catch { /* try next */ }
    }
    return API_BASES[1];
  }

  async function markSent(logId, finalText) {
    const base = await findApiBase();
    try {
      const res = await fetch(`${base}/api/extension/mark-sent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, finalText }),
      });
      return res.ok;
    } catch (e) {
      log('markSent error:', e);
      return false;
    }
  }

  // ────────── storage helpers ──────────

  function getQueue() {
    return new Promise((resolve) => {
      chrome.storage.session.get(['lucia_queued_drafts'], (data) => {
        resolve(data.lucia_queued_drafts || {});
      });
    });
  }

  function setQueue(q) {
    return new Promise((resolve) => {
      chrome.storage.session.set({ lucia_queued_drafts: q }, resolve);
    });
  }

  async function removeFromQueue(key) {
    const q = await getQueue();
    delete q[key];
    await setQueue(q);
  }

  // ────────── review detection (selectors w/ fallback) ──────────

  // Devuelve array de "review card" elements detectados en el DOM
  function findReviewCards() {
    const candidates = [
      // GBP modern: cada review suele estar en un <div> con role="listitem"
      'div[role="listitem"]',
      // GBP search.google.com/local
      'div[data-review-id]',
      // Fallback: containers con la palabra "Responder" cerca
      'div.review-card',
    ];

    const found = new Set();
    for (const sel of candidates) {
      document.querySelectorAll(sel).forEach((el) => {
        // Heurística: tiene que contener un botón "Responder" o "Reply"
        const btn = findReplyButton(el);
        if (btn) found.add(el);
      });
    }
    return Array.from(found);
  }

  function findReplyButton(scope) {
    const btns = scope.querySelectorAll('button, a, [role="button"]');
    for (const btn of btns) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text === 'responder' || text === 'reply' || text === 'responder al cliente') {
        return btn;
      }
    }
    return null;
  }

  function findPublishButton(scope) {
    const root = scope || document;
    const btns = root.querySelectorAll('button, [role="button"]');
    for (const btn of btns) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (
        text === 'publicar' ||
        text === 'enviar' ||
        text === 'publish' ||
        text === 'send' ||
        text === 'reply' ||
        text === 'send reply'
      ) {
        return btn;
      }
    }
    return null;
  }

  function extractReviewerName(scope) {
    // Heurística: el primer texto bold/h*/strong dentro del card suele ser el reviewer
    const sels = ['h2', 'h3', '[data-reviewer-name]', '.review-author', 'strong'];
    for (const sel of sels) {
      const el = scope.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    // Fallback: primera línea de texto del card
    const text = (scope.textContent || '').trim().split('\n')[0];
    return text.slice(0, 80);
  }

  function extractRating(scope) {
    // Buscar aria-label tipo "5 stars" / "5 estrellas"
    const stars = scope.querySelector('[aria-label*="star"], [aria-label*="estrella"]');
    if (stars) {
      const aria = stars.getAttribute('aria-label') || '';
      const m = aria.match(/(\d)/);
      if (m) return parseInt(m[1], 10);
    }
    return 0;
  }

  function extractTextarea(scope) {
    // El textarea de "responder" suele aparecer cerca del botón clickeado
    const root = scope || document;
    return (
      root.querySelector('textarea') ||
      root.querySelector('[contenteditable="true"]') ||
      root.querySelector('div[role="textbox"]')
    );
  }

  // ────────── core: pegar texto en un textarea/contenteditable ──────────

  async function pasteText(input, text) {
    if (!input) return false;
    input.focus();
    await sleep(80);

    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      // setear .value + disparar input event (React/Vue lo intercepta)
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      ).set;
      setter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (input.isContentEditable) {
      // contenteditable: necesitamos manipular el text node
      input.innerHTML = '';
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }

  // ────────── proceso por cada review card ──────────

  const inFlight = new Set();

  async function processCard(card, brand) {
    if (card.getAttribute(PROCESSED_ATTR)) return;

    const reviewerName = extractReviewerName(card);
    const rating = extractRating(card);
    if (!reviewerName) return;

    const queue = await getQueue();
    // Buscar match con diferentes claves
    const candidates = [
      keyFor(brand, reviewerName, rating),
      keyFor(brand, reviewerName, 0),
      // sin brand, solo por nombre
      keyFor('', reviewerName, rating),
      keyFor('', reviewerName, 0),
    ];

    let draftData = null;
    let matchKey = null;
    for (const c of candidates) {
      if (queue[c]) {
        draftData = queue[c];
        matchKey = c;
        break;
      }
    }
    // último intento: si solo hay 1 draft en queue, lo usamos
    if (!draftData) {
      const keys = Object.keys(queue);
      if (keys.length === 1) {
        draftData = queue[keys[0]];
        matchKey = keys[0];
        log('single-draft fallback match for', reviewerName);
      }
    }

    if (!draftData) return;
    if (inFlight.has(matchKey)) return;
    inFlight.add(matchKey);

    card.setAttribute(PROCESSED_ATTR, '1');
    card.classList.add(HIGHLIGHT_CLASS);
    log('match!', { reviewerName, rating, action: draftData.action });
    toast(
      `LucIA: borrador encontrado para ${reviewerName} (${draftData.action})`
    );

    try {
      // 1. click Responder
      const replyBtn = findReplyButton(card);
      if (!replyBtn) {
        toast('No encontré botón "Responder"');
        return;
      }
      replyBtn.click();

      // 2. esperar textarea
      const input = await waitFor(() => extractTextarea(card) || extractTextarea(document), {
        timeout: 5000,
      });
      if (!input) {
        toast('No apareció el textarea');
        return;
      }

      // 3. pegar texto
      await pasteText(input, draftData.draft);
      await sleep(400);

      // 4. encontrar botón Publicar
      const publishBtn = findPublishButton(card) || findPublishButton(document);
      if (!publishBtn) {
        toast('Texto pegado, pero no encontré botón "Publicar"');
        return;
      }
      publishBtn.classList.add(PUBLISH_CLASS);

      if (draftData.action === 'APPROVED') {
        // FULL AUTO: esperar 2s para que el CM pueda interrumpir si quiere
        toast(`Auto-publicando en 2s · ${reviewerName} · ${draftData.brand}`, 2200);
        await sleep(2200);
        publishBtn.click();
        await sleep(800);
        const ok = await markSent(draftData.logId, draftData.draft);
        await removeFromQueue(matchKey);
        toast(ok ? `✓ Publicado · ${reviewerName}` : `Publicado pero falló mark-sent`);
      } else {
        // PENDING: esperar el click del CM
        toast(
          `Listo para revisar · ${reviewerName}\nClick "Publicar" cuando lo confirmes`
        );
        const onClick = async () => {
          publishBtn.removeEventListener('click', onClick);
          // El CM puede haber editado el texto antes de publicar
          const finalText = (input.value ?? input.textContent ?? draftData.draft).trim();
          const ok = await markSent(draftData.logId, finalText);
          await removeFromQueue(matchKey);
          toast(ok ? `✓ Marcado como enviado · ${reviewerName}` : `Publicado pero falló mark-sent`);
        };
        publishBtn.addEventListener('click', onClick);
      }
    } catch (e) {
      log('error en processCard:', e);
      toast(`Error: ${e.message}`);
    } finally {
      inFlight.delete(matchKey);
    }
  }

  // ────────── observer + scan loop ──────────

  function detectBrandFromPage() {
    // Heurística: ver título de la página / business name visible
    const title = document.title || '';
    if (/desembarco/i.test(title)) return 'El Desembarco';
    if (/tasty/i.test(title)) return 'Mr Tasty';
    if (/mila/i.test(title)) return 'Mila & Go';
    // Fallback: ver h1
    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim().slice(0, 60);
    return '';
  }

  async function scan() {
    const queue = await getQueue();
    if (!queue || Object.keys(queue).length === 0) return;

    const brand = detectBrandFromPage();
    const cards = findReviewCards();
    if (cards.length === 0) return;
    log(`scan: ${cards.length} cards, brand="${brand}", queue=${Object.keys(queue).length}`);
    for (const card of cards) {
      await processCard(card, brand);
    }
  }

  // ────────── init ──────────

  function init() {
    injectStyles();
    log('loaded on', location.href);

    // primer scan
    setTimeout(scan, 1200);

    // observar cambios del DOM (SPAs cargan reviews dinámicamente)
    let scanTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, 600);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // mostrar info en consola
    getQueue().then((q) => {
      const count = Object.keys(q).length;
      if (count > 0) {
        toast(`LucIA: ${count} borrador(es) en cola — esperando reseñas matcheables`);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
