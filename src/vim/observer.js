import { resolveCursor } from './cursor.js';

let vimRafPending = false;
const vimObserver = new MutationObserver(() => {
  if (vimRafPending) return;
  vimRafPending = true;
  requestAnimationFrame(() => {
    vimRafPending = false;
    resolveCursor();
  });
});

export function vimInit() {
  const main = document.getElementById('main');
  if (main) {
    vimObserver.observe(main, { childList: true, subtree: true });
  }
  resolveCursor();
}

export { vimObserver };

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', vimInit);
} else {
  vimInit();
}