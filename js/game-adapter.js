export class GameAdapter {
  constructor({ storyId, timeoutMs = 15000 } = {}) {
    this.storyId = storyId;
    this.timeoutMs = timeoutMs;
    this.sequence = 0;
    this.pending = null;
    this.worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      if (!this.pending || this.pending.id !== data.requestId) return;
      const pending = this.pending;
      clearTimeout(pending.timer);
      this.pending = null;
      if (data.error) pending.reject(new Error(data.error));
      else { this.last = data.result; pending.resolve(structuredClone(this.last)); }
    };
    this.worker.onerror = event => this.fail(new Error(event.message || 'Interpreter worker failed'));
  }
  request(type, payload = {}) {
    if (this.pending || this.closed) return Promise.reject(new Error('Interpreter unavailable or busy'));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => this.fail(new Error('Interpreter processing timeout')), this.timeoutMs);
      this.pending = { id, resolve, reject, timer };
      this.worker.postMessage({ requestId: id, type, ...payload });
    });
  }
  initialize() { return this.request('initialize', { storyId: this.storyId }); }
  executeAction(command) {
    const action = this.last?.actions.find(option => option.command === command);
    if (!action) return Promise.reject(new Error('Command is not in the presented menu'));
    return this.request('execute', { command, actionId: action.id });
  }
  getLastResponse() { return this.last?.response ?? ''; }
  getAvailableState() { return this.last ? structuredClone(this.last.state) : null; }
  isGameOver() { return this.last?.gameOver ?? false; }
  fail(error) {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
    this.close();
  }
  close() { this.closed = true; this.worker.terminate(); }
}
