import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'csv-parse/sync';
import { fresh } from './helpers.js';
import { generateActions } from '../js/action-generator.js';
import { ExperimentController } from '../js/experiment-controller.js';
import { COLUMNS, toCSV } from '../js/data-export.js';
import { SessionStore } from '../js/session-store.js';
import { afterVisiblePaint } from '../js/timing.js';

const addActions = result => ({ ...result, actions: result.gameOver ? [] : generateActions(result.state) });
const fakeView = () => ({ render() {}, ready() {}, started() {}, enable() {}, disable() {}, complete() {} });
function clockAt(start = 1000) {
  return { ms: start, sample() { return { monotonic: this.ms, iso: new Date(1700000000000 + this.ms).toISOString() }; } };
}
async function harness(options = {}) {
  const core = await fresh();
  const time = clockAt();
  const downloads = [];
  const game = {
    initialize: async () => addActions(core.last),
    executeAction: async command => { time.ms += 40; return addActions(core.executeAction(command)); },
    close() {},
  };
  const controller = new ExperimentController({
    game, view: fakeView(), time, present: async () => { time.ms += 32; },
    download: (blob, filename) => downloads.push({ blob, filename }), sessionId: 'test-session', ...options,
  });
  await controller.initialize();
  return { controller, core, time, downloads, game };
}

test('ten real commands, matching snapshots, timing excludes processing, final CSV round-trips', async () => {
  const { controller: c, time, downloads } = await harness();
  assert.equal(c.session.rows.length, 0);
  await c.start();
  const choices = ['open_mailbox', 'take_advertisement', 'read_advertisement', 'close_mailbox', 'go_north', 'go_east', 'open_kitchen_window', 'go_in', 'go_west', 'take_lamp'];
  const expected = [];
  for (const id of choices) {
    expected.push({ text: c.current.response, actions: structuredClone(c.current.actions) });
    time.ms += 150;
    if (id === 'read_advertisement') c.visibilityChanged(true);
    assert.equal(await c.select(id, time.sample()), true);
  }
  assert.equal(c.status, 'finished');
  assert.equal(c.session.rows.length, 10);
  assert.equal(c.session.status, 'completed');
  assert.equal(await c.select('look', time.sample()), false);
  assert.equal(downloads.length, 1);
  const csv = await downloads[0].blob.text();
  const rows = parse(csv, { columns: true });
  assert.equal(rows.length, 10);
  assert.deepEqual(Object.keys(rows[0]), COLUMNS);
  rows.forEach((row, i) => {
    assert.equal(+row.step, i + 1);
    assert.equal(row.selected_action_id, choices[i]);
    assert.equal(row.game_text_before, expected[i].text);
    assert.deepEqual(JSON.parse(row.available_actions), expected[i].actions);
    assert.equal(+row.rt_ms, 150);
    assert.equal(+row.processing_ms, 40);
    assert.equal(row.session_status, 'completed');
    if (i > 0) assert.equal(row.game_text_before, rows[i - 1].game_text_after);
  });
  assert.equal(rows[2].visibility_interrupted, 'true');
  assert.equal(rows[3].visibility_interrupted, 'false');
  assert.match(rows[2].game_text_after, /"WELCOME TO ZORK!\n\n/);
  c.downloadCSV();
  assert.equal(await downloads[1].blob.text(), csv);
});

test('pending render and pending engine block selections, including rapid double activation', async () => {
  let paint;
  const h = await harness({ present: () => new Promise(resolve => { paint = resolve; }) });
  const c = h.controller;
  const start = c.start();
  assert.equal(c.status, 'presenting');
  assert.equal(await c.select('look', h.time.sample()), false);
  paint(); await start;
  let finish;
  const original = h.game.executeAction;
  h.game.executeAction = command => new Promise(resolve => { finish = () => original(command).then(resolve); });
  h.time.ms += 200;
  const selection = c.select('open_mailbox', h.time.sample());
  assert.equal(c.status, 'processing');
  assert.equal(await c.select('open_mailbox', h.time.sample()), false);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.session.rows.length, 1);
  assert.equal(c.status, 'presenting');
  assert.equal(await c.select('look', h.time.sample()), false);
  paint(); await selection;
  assert.equal(c.status, 'choosing');
});

test('actual third death reaches FINISH; controller exports partial without requesting restart', async () => {
  const core = await fresh();
  ['north', 'east', 'east', 'east', 'jump'].forEach(command => core.executeAction(command));
  assert.equal(core.isGameOver(), false, 'Zork resurrection is not final game termination');
  ['east', 'east', 'south', 'east', 'jump', 'east', 'east', 'south', 'east'].forEach(command => core.executeAction(command));
  // A pre-terminal integration fixture is reached through actual commands.
  // The fixture exposes jump solely to exercise FINISH; no VM state is patched.
  const game = {
    initialize: async () => ({ ...core.last, actions: [{ id: 'fixture_jump', label: 'Jump', command: 'jump', category: 'test' }] }),
    executeAction: async command => addActions(core.executeAction(command)),
    close() {},
  };
  const { controller: c, downloads, time } = await harness({ game });
  await c.start(); time.ms += 100; await c.select('fixture_jump', time.sample());
  assert.equal(core.isGameOver(), true);
  assert.match(c.session.rows[0].game_text_after, /Would you like to restart/);
  assert.equal(c.session.status, 'early_termination');
  assert.equal(c.session.termination_reason, 'story_finish');
  assert.equal(parse(await downloads[0].blob.text(), { columns: true }).length, 1);
});

test('interpreter failures retain confirmed rows and unconfirmed attempt separately', async () => {
  const { controller: c, game, time } = await harness();
  await c.start();
  time.ms += 100; await c.select('open_mailbox', time.sample());
  game.executeAction = async () => { throw new Error('Injected worker failure'); };
  time.ms += 150; await c.select('look', time.sample());
  assert.equal(c.session.rows.length, 1);
  assert.equal(c.session.termination_reason, 'interpreter_error');
  assert.equal(c.session.rows[0].session_status, 'early_termination');
  const details = JSON.parse(await c.finalMetadata.text());
  assert.equal(details.pending_attempt.command_sent, 'look');
  assert.equal(details.pending_attempt.outcome, 'interpreter_error_unconfirmed');
});

test('CSV preserves Unicode, punctuation, multiline text, long JSON lists and missing values', () => {
  const actions = Array.from({ length: 500 }, (_, i) => ({ id: `action_${i}`, label: `“选择”, ${i}\nline` }));
  const text = 'First, "quoted" line.\nSecond line: café 中文 🌲\r\nThird.';
  const row = { participant_id: 'test', step: 1, game_text_after: text, score_after: null, available_actions: actions };
  const [parsed] = parse(toCSV([row]), { columns: true });
  assert.equal(parsed.game_text_after, text);
  assert.equal(parsed.score_after, '');
  assert.deepEqual(JSON.parse(parsed.available_actions), actions);
  assert.equal(parse(toCSV([]), { columns: true }).length, 0);
});

test('reload marks old session interrupted and storage denial is nonfatal', () => {
  const memory = () => ({ data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, v); }, removeItem(k) { this.data.delete(k); } });
  const store = new SessionStore(memory(), memory());
  const session = { participant_id: 'old-id', status: 'in_progress', rows: [{ step: 1, session_status: 'in_progress' }] };
  assert.equal(store.save(session), true);
  const recovered = store.recover();
  assert.equal(recovered.participant_id, 'old-id');
  assert.equal(recovered.status, 'early_termination');
  assert.equal(recovered.rows[0].termination_reason, 'page_reload');
  assert.equal(store.recover().status, 'early_termination');
  const denied = new SessionStore({ setItem() { throw new Error('quota'); } }, memory());
  assert.equal(denied.save(session), false);
});

test('presentation waits for two frames and a visible document', async () => {
  const doc = new EventTarget(); doc.hidden = true;
  const frames = [];
  let done = false;
  const result = afterVisiblePaint(doc, callback => frames.push(callback)).then(() => done = true);
  assert.equal(frames.length, 0);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(done, false);
  frames.shift()();
  await result;
  assert.equal(done, true);
});
