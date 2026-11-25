// Add another .instruction-page in index.html to extend the guide. Only the
// final page can start a session; reading and paging never invoke the engine.
export function welcomeFlow(root, startSession) {
  const pages = [...root.querySelectorAll('.instruction-page')];
  const previous = root.querySelector('#welcome-back');
  const next = root.querySelector('#welcome-next');
  const start = root.querySelector('#start');
  const progress = root.querySelector('#instruction-progress');
  const notice = root.querySelector('#notice');
  let page = 0, ready = false, starting = false;

  function render(focus = false) {
    pages.forEach((element, index) => { element.hidden = index !== page; });
    previous.hidden = page === 0;
    next.hidden = page === pages.length - 1;
    start.hidden = page !== pages.length - 1;
    for (const button of [previous, next, start]) button.disabled = !ready || starting;
    progress.textContent = `${page + 1} / ${pages.length}`;
    if (focus) pages[page].querySelector('h1, h2').focus({ preventScroll: true });
  }
  previous.onclick = () => {
    if (!ready || starting || page === 0) return;
    page--; render(true);
  };
  next.onclick = () => {
    if (!ready || starting || page === pages.length - 1) return;
    page++; render(true);
  };
  start.onclick = async () => {
    if (!ready || starting || page !== pages.length - 1) return;
    starting = true;
    render();
    notice.textContent = 'Opening your adventure…';
    // Request directly from the click to retain browser user activation. Wait
    // for the transition before the controller starts the first decision timer.
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch { /* The same viewport-filling game remains usable if denied. */ }
    await startSession();
  };
  render();
  return {
    ready() { ready = true; notice.textContent = ''; render(); },
    hide() { root.hidden = true; },
  };
}
