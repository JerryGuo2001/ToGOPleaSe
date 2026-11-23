export const CATEGORY_ACTION_LIMIT = 9;
export const menuGroup = action => action.menuGroup || (action.category === 'navigation' ? 'move' : action.category === 'bag' ? 'bag' : 'action');

// Rank without executing speculative commands. Unknown actions are retained
// ahead of explicitly informational/no-effect choices. Ties keep author order.
export function selectMenu(actions) {
  // Each category has its own allowance. Return the same category/source order
  // used by the UI, irrespective of the ranking used to decide what to retain.
  return ['move', 'action', 'bag'].flatMap(group => {
    const candidates = actions.filter(action => menuGroup(action) === group);
    const retained = new Set(candidates.map((action, index) => ({ action, index }))
      .sort((a, b) => (b.action.menuPriority ?? 2) - (a.action.menuPriority ?? 2) || a.index - b.index)
      .slice(0, CATEGORY_ACTION_LIMIT).map(({ action }) => action));
    return candidates.filter(action => retained.has(action));
  });
}
