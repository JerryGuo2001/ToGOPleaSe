import { clock, afterVisiblePaint } from './timing.js';
import { GAME_VERSION, RANDOM_SEED } from './engine-core.js';
import { ACTION_GENERATOR_VERSION } from './action-generator.js';
import { SCHEMA } from './story-schema.js';
import { csvBlob, metadataBlob, downloadBlob } from './data-export.js';

export const EXPERIMENT_VERSION = '1.0.0';
export const DECISION_LIMIT = 10;
export class ExperimentController {
  constructor({ game, view, store, time = clock, present = afterVisiblePaint, download = downloadBlob, sessionId = crypto.randomUUID() }) {
    Object.assign(this, { game, view, store, time, present, download });
    this.status = 'loading';
    this.session = {
      participant_id: sessionId, status: 'ready', rows: [], pending_attempt: null,
      experiment_version: EXPERIMENT_VERSION, action_generator_version: ACTION_GENERATOR_VERSION,
      game_version: GAME_VERSION, story_sha256: SCHEMA.sha256,
      interpreter_version: 'ifvms.js 1.1.6 / 6ac63e6b61144d4353a168df16c4ad5c22526f88',
      random_seed: RANDOM_SEED, time_origin_ms: performance.timeOrigin,
      created_at: time.sample().iso, started_at: null, ended_at: null, termination_reason: '',
    };
  }
  async initialize() {
    try {
      this.current = await this.game.initialize();
      this.session.initial_narrative = this.current.response;
      this.session.initial_raw_text = this.current.rawResponse;
      this.status = 'ready';
      this.view.render(this.current, 0);
      this.view.ready();
    } catch (error) {
      this.session.error = error.message;
      this.finish('early_termination', 'initialization_error');
    }
  }
  async start() {
    if (this.status !== 'ready') return;
    this.session.status = 'in_progress';
    this.session.started_at = this.time.sample().iso;
    this.persist();
    this.view.started();
    await this.presentMenu();
  }
  async presentMenu() {
    this.status = 'presenting';
    this.view.render(this.current, this.session.rows.length);
    await this.present();
    if (this.status !== 'presenting') return;
    this.presentation = this.time.sample();
    this.interrupted = false;
    this.status = 'choosing';
    this.view.enable();
  }
  // The DOM handler samples both clocks before calling this method.
  async select(actionId, clicked) {
    if (this.status !== 'choosing' || this.session.rows.length >= DECISION_LIMIT) return false;
    const action = this.current.actions.find(option => option.id === actionId);
    if (!action) return false;
    this.status = 'processing'; // Synchronous lock before any await.
    this.view.disable();
    const before = this.current;
    const presented = this.presentation;
    const step = this.session.rows.length + 1;
    const attempt = {
      step, selected_action_id: action.id, selected_action_label: action.label, command_sent: action.command,
      timestamp_presented: presented.iso, timestamp_clicked: clicked.iso,
      performance_presented_ms: presented.monotonic, performance_clicked_ms: clicked.monotonic,
      rt_ms: clicked.monotonic - presented.monotonic,
      available_actions: structuredClone(before.actions), game_text_before: before.response,
      game_location_before: before.state.room.name, location_id_before: before.state.room.id,
      inventory_before: structuredClone(before.state.inventory), moves_before: before.state.moves,
    };
    this.session.pending_attempt = attempt;
    this.persist();
    try {
      const after = await this.game.executeAction(action.command);
      const response = this.time.sample();
      if (this.status !== 'processing') return false;
      this.session.rows.push({
        participant_id: this.session.participant_id, ...attempt,
        game_version: GAME_VERSION, game_location_after: after.state.room.name,
        location_id_after: after.state.room.id, game_text_after: after.response, game_raw_text_after: after.rawResponse,
        inventory_after: after.state.inventory, score_after: after.state.score ?? null, moves_after: after.state.moves ?? null,
        timestamp_response: response.iso, performance_response_ms: response.monotonic,
        processing_ms: response.monotonic - clicked.monotonic,
        visibility_interrupted: this.interrupted, session_status: 'in_progress',
        experiment_version: EXPERIMENT_VERSION, action_generator_version: ACTION_GENERATOR_VERSION,
        story_sha256: SCHEMA.sha256, interpreter_version: this.session.interpreter_version,
        random_seed: RANDOM_SEED, termination_reason: '', time_origin_ms: this.session.time_origin_ms,
        command_outcome: 'processed',
      });
      this.session.pending_attempt = null;
      this.current = after;
      this.persist();
      if (after.gameOver) this.finish('early_termination', after.terminationReason || 'game_ended');
      else if (this.session.rows.length === DECISION_LIMIT) this.finish('completed', 'decision_limit');
      else await this.presentMenu();
      return true;
    } catch (error) {
      if (this.status === 'finished') return false;
      this.session.error = error.message;
      this.session.pending_attempt.outcome = 'interpreter_error_unconfirmed';
      this.session.pending_attempt.visibility_interrupted = this.interrupted;
      this.finish('early_termination', 'interpreter_error');
      return false;
    }
  }
  visibilityChanged(hidden) {
    if (hidden && ['choosing', 'processing'].includes(this.status)) this.interrupted = true;
  }
  persist() {
    if (this.store && !this.store.save(this.session)) this.view.storageUnavailable?.();
  }
  finish(status, reason, autoDownload = true) {
    if (this.status === 'finished') return;
    this.status = 'finished';
    Object.assign(this.session, { status, termination_reason: reason, ended_at: this.time.sample().iso });
    for (const row of this.session.rows) Object.assign(row, { session_status: status, termination_reason: reason });
    this.finalCSV = csvBlob(this.session.rows);
    this.finalMetadata = metadataBlob(this.session);
    this.persist();
    this.game.close?.();
    if (this.current) this.view.render({ ...this.current, actions: [] }, this.session.rows.length);
    this.view.complete(this.session);
    if (autoDownload) {
      try { this.downloadCSV(); } catch { /* Manual button remains available. */ }
    }
  }
  pageExit() {
    if (['choosing', 'presenting', 'processing'].includes(this.status)) {
      if (this.session.pending_attempt) this.session.pending_attempt.outcome = 'page_exit_unconfirmed';
      this.finish('early_termination', 'page_exit', false);
    }
  }
  downloadCSV() {
    if (this.finalCSV) this.download(this.finalCSV, `zork_${this.session.participant_id}.csv`);
  }
  downloadMetadata() {
    if (this.finalMetadata) this.download(this.finalMetadata, `zork_${this.session.participant_id}_session.json`);
  }
}
