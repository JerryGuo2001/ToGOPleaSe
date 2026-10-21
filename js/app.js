import { GameAdapter } from './game-adapter.js';
import { ExperimentController } from './experiment-controller.js';
import { SessionStore } from './session-store.js';
import { clock } from './timing.js';
import { csvBlob, metadataBlob, downloadBlob } from './data-export.js';

const $ = id => document.getElementById(id);
let local, tab;
try { local = localStorage; tab = sessionStorage; } catch { /* Storage can be disabled. */ }
const store = new SessionStore(local, tab);
const previous = store.recover();
if (previous) {
  $('recovery').hidden = false;
  $('recovery-message').textContent = previous.status === 'completed'
    ? 'Your previous completed session is available to download again. Starting here creates a new session.'
    : 'Your previous session was interrupted. Its recorded choices are available below. Starting here begins a fresh game with a new anonymous ID.';
  $('recover-download').onclick = () => downloadBlob(csvBlob(previous.rows), `zork_${previous.participant_id}.csv`);
  $('recover-details').onclick = () => downloadBlob(metadataBlob(previous), `zork_${previous.participant_id}_session.json`);
}

const view = {
  render(result, count) {
    $('game').hidden = false;
    $('location').textContent = `Current location: ${result.state.room.name}`;
    $('narrative').textContent = result.response;
    $('progress').textContent = `Decision ${Math.min(count + 1, 10)} / 10`;
    $('actions').replaceChildren(...result.actions.map(action => {
      const li = document.createElement('li'), button = document.createElement('button');
      button.type = 'button';
      button.className = 'action';
      button.textContent = action.label;
      button.dataset.actionId = action.id;
      button.disabled = true;
      button.addEventListener('click', event => {
        const clicked = clock.sample();
        if (event.detail > 1) return; // Ignore the second click of a mouse double-click.
        controller.select(action.id, clicked);
      });
      li.append(button);
      return li;
    }));
    if (controller.status !== 'ready') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      $('narrative').focus({ preventScroll: true });
    }
  },
  ready() {
    $('start').hidden = false;
    $('progress').textContent = 'Ready · 10 decisions';
    $('notice').textContent = 'Explore by choosing one action at a time. After 10 choices, your session ends and a data file downloads. Start when you are ready.';
  },
  started() {
    $('start').hidden = true;
    $('notice').textContent = '';
    $('recovery').hidden = true;
  },
  enable() { document.querySelectorAll('.action').forEach(button => button.disabled = false); },
  disable() { document.querySelectorAll('.action').forEach(button => button.disabled = true); },
  complete(session) {
    $('start').hidden = true;
    $('choices').hidden = true;
    $('notice').textContent = '';
    $('completion').hidden = false;
    $('progress').textContent = `${session.rows.length} / 10 decisions recorded`;
    $('completion-heading').textContent = session.status === 'completed' ? 'Session complete' : 'Session ended early';
    $('completion-message').textContent = session.status === 'completed'
      ? 'Thank you. Your 10 choices have been recorded. If the download did not start, use Download CSV below. You can download it again while this page remains open.'
      : session.termination_reason === 'story_finish' || session.termination_reason === 'vm_quit'
        ? 'The game has ended. Your recorded choices are available below.'
        : 'The session was interrupted and cannot continue. Download the recorded choices and session details below. A failed or unfinished command is described in the session details.';
  },
  storageUnavailable() {
    $('storage-notice').hidden = false;
    $('storage-notice').textContent = 'Browser recovery storage is unavailable. Keep this page open until you have downloaded your data.';
  },
};
const controller = new ExperimentController({ game: new GameAdapter(), view, store });
$('start').onclick = () => controller.start();
$('download').onclick = () => controller.downloadCSV();
$('details-download').onclick = () => controller.downloadMetadata();
document.addEventListener('visibilitychange', () => controller.visibilityChanged(document.hidden));
window.addEventListener('pagehide', () => controller.pageExit());
await controller.initialize();
if (!store.available) view.storageUnavailable();
