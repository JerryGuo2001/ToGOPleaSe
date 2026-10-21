const PREFIX = 'zork-experiment:v1:';
export class SessionStore {
  constructor(local, tab) { this.local = local; this.tab = tab; this.available = !!local && !!tab; }
  save(session) {
    if (!this.available) return false;
    try {
      this.local.setItem(PREFIX + session.participant_id, JSON.stringify(session));
      if (session.status === 'in_progress') this.tab.setItem(PREFIX + 'active', session.participant_id);
      else if (session.status !== 'ready') {
        this.tab.removeItem(PREFIX + 'active');
        this.local.setItem(PREFIX + 'latest', session.participant_id);
      }
      return true;
    } catch { this.available = false; return false; }
  }
  recover() {
    if (!this.available) return null;
    try {
      const id = this.tab.getItem(PREFIX + 'active') || this.local.getItem(PREFIX + 'latest');
      if (!id) return null;
      const session = JSON.parse(this.local.getItem(PREFIX + id));
      if (!session || !Array.isArray(session.rows) || session.participant_id !== id) return null;
      if (session.status === 'in_progress') {
        session.status = 'early_termination';
        session.termination_reason = 'page_reload';
        session.ended_at = new Date().toISOString();
        session.rows.forEach(row => { row.session_status = session.status; row.termination_reason = session.termination_reason; });
        this.save(session);
      }
      return session;
    } catch { this.available = false; return null; }
  }
}
