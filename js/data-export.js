export const COLUMNS = [
  'participant_id', 'step', 'game_version', 'game_location_before', 'game_location_after',
  'available_actions', 'selected_action_id', 'selected_action_label', 'command_sent',
  'game_text_before', 'game_text_after', 'inventory_before', 'inventory_after', 'score_after',
  'timestamp_presented', 'timestamp_clicked', 'timestamp_response', 'rt_ms', 'processing_ms',
  'visibility_interrupted', 'session_status', 'experiment_version', 'action_generator_version',
  'story_sha256', 'interpreter_version', 'random_seed', 'termination_reason',
  'location_id_before', 'location_id_after', 'moves_before', 'moves_after',
  'performance_presented_ms', 'performance_clicked_ms', 'performance_response_ms',
  'time_origin_ms', 'game_raw_text_after', 'command_outcome',
];
export function csvCell(value) {
  if (value === null || value === undefined) return '""';
  const string = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${string.replaceAll('"', '""')}"`;
}
export function toCSV(rows) {
  return [COLUMNS.map(csvCell).join(','), ...rows.map(row => COLUMNS.map(column => csvCell(row[column])).join(','))].join('\r\n') + '\r\n';
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function csvBlob(rows) { return new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }); }
export function metadataBlob(session) {
  const { rows, ...metadata } = session;
  return new Blob([JSON.stringify({ ...metadata, completed_decisions: rows.length }, null, 2)], { type: 'application/json;charset=utf-8' });
}
