/* Shared dismiss controls for native management dialogs. */
(() => {
  'use strict';
  if (window.PuffyDialogClose) return;
  const installed = new WeakSet();

  function requestClose(dialog) {
    if (!dialog.open) return;
    // Preserve existing operation locks, including forms without a cancel hook.
    if (dialog.querySelector('button[type="submit"]:disabled, button.primary:disabled')) return;
    const event = new Event('cancel', { cancelable: true });
    if (dialog.dispatchEvent(event)) dialog.close();
  }

  function enhance(dialog) {
    if (installed.has(dialog)) return;
    installed.add(dialog);
    const bar = document.createElement('div');
    bar.dataset.dialogCloseBar = '';
    Object.assign(bar.style, {
      position: 'sticky', top: '0', zIndex: '100', display: 'flex',
      justifyContent: 'flex-end', height: '44px', marginBottom: '8px',
      pointerEvents: 'none',
    });
    // Isolate the button from legacy querySelector('button')/form bindings.
    const shadow = bar.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      button { width:44px;height:44px;display:grid;place-items:center;
        border:1px solid #827562;border-radius:50%;background:#171b23;
        color:#f5ecdc;font:30px/1 sans-serif;cursor:pointer;pointer-events:auto;
        box-shadow:0 3px 14px #0008; }
      button:hover { background:#303039; }
      button:focus-visible { outline:2px solid #e8b878;outline-offset:3px; }
    </style><button type="button" aria-label="Pencereyi kapat" title="Kapat (Esc)">×</button>`;
    shadow.querySelector('button').addEventListener('click', () => requestClose(dialog));
    dialog.prepend(bar);

    let outsideDown = false;
    const outside = event => {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < rect.left ||
        event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    };
    dialog.addEventListener('pointerdown', event => { outsideDown = outside(event); });
    dialog.addEventListener('pointerup', event => {
      const dismiss = outsideDown && outside(event);
      outsideDown = false;
      if (dismiss) requestClose(dialog);
    });
    dialog.addEventListener('pointercancel', () => { outsideDown = false; });
  }

  function scan() {
    document.querySelectorAll('dialog[open]').forEach(enhance);
  }
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['open'],
  });
  window.PuffyDialogClose = { scan };
  scan();
})();
