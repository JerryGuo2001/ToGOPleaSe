export const MAIN_ACTION_LIMIT = 9;
export const menuGroup = action => action.menuGroup || (action.category === 'navigation' ? 'move' : action.category === 'bag' ? 'bag' : 'action');

// Rank without executing speculative commands. Unknown actions are retained
// ahead of explicitly informational/no-effect choices. Ties keep author order.
export function selectMenu(actions) {
  const main = actions.filter(action => menuGroup(action) !== 'bag');
  const retained = new Set(main.map((action, index) => ({ action, index }))
    .sort((a, b) => (b.action.menuPriority ?? 2) - (a.action.menuPriority ?? 2) || a.index - b.index)
    .slice(0, MAIN_ACTION_LIMIT).map(({ action }) => action));
  // Match the UI order, with the main grid followed by the bag panel.
  return [...main.filter(action => retained.has(action)), ...actions.filter(action => menuGroup(action) === 'bag')];
}
