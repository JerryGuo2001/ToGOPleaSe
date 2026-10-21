export const clock = {
  sample() { return { monotonic: performance.now(), iso: new Date().toISOString() }; },
};

// Two rendering opportunities let layout settle. Activation is sampled in the
// second callback, immediately before enabling buttons for the next paint.
// A hidden document cannot start a decision timer.
export function afterVisiblePaint(documentRef = document, raf = requestAnimationFrame) {
  return new Promise(resolve => {
    const schedule = () => {
      if (documentRef.hidden) {
        documentRef.addEventListener('visibilitychange', visible, { once: true });
        return;
      }
      raf(() => raf(() => {
        if (documentRef.hidden) schedule();
        else resolve();
      }));
    };
    const visible = () => schedule();
    schedule();
  });
}
