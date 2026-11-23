// Fit complete rows into the available space, keeping every option reachable
// without introducing another scroll area. Refit when the viewport changes.
export function pagedList(list, controls, eligible = () => true, onPage = () => {}) {
  const [previous, label, next] = controls.children;
  let pages = [], page = 0, enabled = true;
  function display() {
    const visible = new Set(pages[page] || []);
    for (const item of list.children) item.hidden = !visible.has(item);
    controls.hidden = list.hidden || pages.length < 2;
    label.textContent = `${page + 1} / ${Math.max(1, pages.length)}`;
    previous.disabled = !enabled || page === 0;
    next.disabled = !enabled || page >= pages.length - 1;
  }
  function fit(reset = false) {
    if (reset) page = 0;
    if (!list.clientHeight || !list.clientWidth) { controls.hidden = true; return; }
    const items = [...list.children].filter(eligible);
    for (const item of list.children) item.hidden = !items.includes(item);
    const rows = [];
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      let row = rows.at(-1);
      if (!row || Math.abs(row.top - rect.top) > 1) {
        row = { top: rect.top, height: 0, items: [] }; rows.push(row);
      }
      row.height = Math.max(row.height, rect.height); row.items.push(item);
    }
    const style = getComputedStyle(list);
    const gap = parseFloat(style.rowGap) || 0;
    const availableHeight = list.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    pages = [];
    let batch = [], height = 0;
    for (const row of rows) {
      if (batch.length && height + gap + row.height > availableHeight + 0.5) {
        pages.push(batch); batch = []; height = 0;
      }
      height += (batch.length ? gap : 0) + row.height;
      batch.push(...row.items);
    }
    if (batch.length) pages.push(batch);
    page = Math.min(page, Math.max(0, pages.length - 1));
    display();
  }
  function turn(delta) {
    if (!enabled) return;
    page = Math.max(0, Math.min(pages.length - 1, page + delta));
    display(); onPage(page + 1);
    // Keep keyboard focus in the pager when the clicked arrow becomes disabled.
    if (document.activeElement === previous && previous.disabled) next.focus({ preventScroll: true });
    if (document.activeElement === next && next.disabled) previous.focus({ preventScroll: true });
  }
  previous.onclick = () => turn(-1);
  next.onclick = () => turn(1);
  new ResizeObserver(() => fit()).observe(list);
  return { fit, setEnabled(value) { enabled = value; display(); } };
}
