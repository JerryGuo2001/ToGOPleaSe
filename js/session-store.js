export class SessionStore {
  constructor(local, tab, storyId = 'zork') {
    this.local = local; this.tab = tab; this.available = !!local && !!tab;
    this.prefix = `exploration-task:v2:${storyId}:`;
    this.legacyPrefix = storyId === 'zork' ? 'zork-experiment:v1:' : null;
  }
  save(session) {
    if (!this.available) return false;
    try {
      this.local.setItem(this.prefix + session.participant_id, JSON.stringify(session));
      if (session.status === 'in_progress') this.tab.setItem(this.prefix + 'active', session.participant_id);
      else if (session.status !== 'ready') {
        this.tab.removeItem(this.prefix + 'active');
        this.local.setItem(this.prefix + 'latest', session.participant_id);
      }
      return true;
    } catch { this.available = false; return false; }
  }
  recover() {
    if (!this.available) return null;
    try {
      let prefix = this.prefix;
      let id = this.tab.getItem(prefix + 'active') || this.local.getItem(prefix + 'latest');
      if (!id && this.legacyPrefix) {
        prefix = this.legacyPrefix;
        id = this.tab.getItem(prefix + 'active') || this.local.getItem(prefix + 'latest');
      }
      if (!id) return null;
      const session = JSON.parse(this.local.getItem(prefix + id));
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
