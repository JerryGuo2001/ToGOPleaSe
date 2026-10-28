import { GameAdapter } from './game-adapter.js';
import { ExperimentController, DECISION_LIMIT } from './experiment-controller.js';
import { SessionStore } from './session-store.js';
import { clock } from './timing.js';
import { csvBlob, metadataBlob, downloadBlob } from './data_save.js';
import { DEFAULT_STORY } from './config.js';

const $ = id => document.getElementById(id);
const storyId = new URLSearchParams(location.search).get('story') || DEFAULT_STORY;
const menuGroup = action => action.menuGroup || (action.category === 'navigation' ? 'move' : action.category === 'bag' ? 'bag' : 'action');
const menuCopy = {
  move: ['Where to next?', 'Choose a direction and see where it leads.'],
  action: ['Make your next move.', 'Take a closer look. Try something new.'],
  bag: ['Your items, your options.', 'Viewing your bag is free. Using an item counts as a decision.'],
};
let current, selectedCategory = null, enabled = false;
let local, tab;
try { local = localStorage; tab = sessionStorage; } catch { /* Storage can be disabled. */ }
const store = new SessionStore(local, tab, storyId);
const previous = store.recover();
if (previous) {
  $('recovery').hidden = false;
  $('recovery-message').textContent = previous.status === 'completed'
    ? 'Your previous completed session is available to download again. Starting here creates a new session.'
    : 'Your previous session was interrupted. Its recorded choices are available below. Starting here begins a fresh game with a new anonymous ID.';
  const prefix = `${previous.story_id || storyId}_${previous.participant_id}`;
  $('recover-download').onclick = () => downloadBlob(csvBlob(previous.rows), `${prefix}.csv`);
  $('recover-details').onclick = () => downloadBlob(metadataBlob(previous), `${prefix}_session.json`);
}

function showMenu(category = null, focus = false) {
  selectedCategory = category;
  $('choices').dataset.menu = category || 'categories';
  $('categories').hidden = category !== null;
  $('actions').hidden = category === null;
  $('menu-back').hidden = category === null;
  $('story-view').hidden = category === 'bag';
  $('bag-view').hidden = category !== 'bag';
  $('panel-label').textContent = category === 'bag' ? 'YOUR BELONGINGS' : 'THE STORY';
  $('choice-heading').textContent = category ? menuCopy[category][0] : 'What will you do?';
  $('choice-hint').textContent = category ? menuCopy[category][1] : 'Choose a category to explore your options.';
  $('menu-note').textContent = category ? 'Choose an action · uses 1 decision' : 'Choose a category · no decision used';
  let count = 0;
  for (const li of $('actions').children) {
    li.hidden = li.dataset.category !== category;
    if (!li.hidden) count++;
  }
  $('no-actions').hidden = !category || count > 0;
  $('no-actions').textContent = category === 'bag'
    ? 'No item actions here yet. Your bag is shown on the left; return to the categories to keep exploring.'
    : 'No choices in this category right now. Try another category.';
  if (category && !count) $('menu-note').textContent = 'Go back to choose another category';
  if (focus) $('choice-heading').focus({ preventScroll: true });
}
function setEnabled(value) {
  enabled = value;
  document.querySelectorAll('#actions .action, .category, #menu-back').forEach(button => { button.disabled = !value; });
  $('choices').setAttribute('aria-busy', String(!value));
  $('turn-status').textContent = value ? 'Your turn' : controller.status === 'ready' ? 'Get ready' : 'Please wait…';
}
function renderInventory(items) {
  $('empty-bag').hidden = items.length > 0;
  $('inventory').replaceChildren(...items.map((item, i) => {
    const li = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'item-number'; number.textContent = String(i + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span'); name.textContent = item.name;
    if (item.description) {
      const description = document.createElement('span'); description.className = 'item-description'; description.textContent = item.description; name.append(description);
    }
    li.append(number, name); return li;
  }));
}
function showLatestResponse() {
  const transcript = $('transcript');
  const latest = transcript.lastElementChild;
  if (!latest) return;
  // Align the beginning of the latest turn, including its chosen action. Long
  // responses remain readable from the start instead of jumping to their end.
  transcript.scrollTop += latest.getBoundingClientRect().top - transcript.getBoundingClientRect().top;
}
function renderTranscript(result, history) {
  const transcript = $('transcript');
  const append = (text, row) => {
    const previous = $('narrative');
    if (previous) { previous.removeAttribute('id'); previous.removeAttribute('tabindex'); }
    const entry = document.createElement('section');
    entry.className = 'transcript-entry'; entry.dataset.step = row?.step ?? 0;
    const heading = document.createElement('h3'); heading.className = 'transcript-heading';
    if (row) {
      const meta = document.createElement('span'); meta.className = 'transcript-meta';
      meta.textContent = `Decision ${String(row.step).padStart(2, '0')} · ${row.game_location_before}`;
      const action = document.createElement('span'); action.className = 'transcript-action';
      action.textContent = row.selected_action_label;
      heading.append(meta, action);
    } else heading.textContent = 'The beginning';
    const response = document.createElement('div');
    response.className = 'story-response'; response.id = 'narrative'; response.tabIndex = -1;
    response.textContent = text;
    entry.append(heading, response); transcript.append(entry);
  };
  if (!transcript.children.length) append(result.response);
  // Start, category browsing, and finalization can render the same state again.
  // Append only confirmed decisions that are not already in the transcript.
  const newRows = history.slice(transcript.children.length - 1);
  for (const row of newRows) append(row.game_text_after, row);
  $('latest-response').hidden = !history.length;
  return newRows.length > 0;
}
const view = {
  render(result, count, history) {
    current = result;
    enabled = false;
    $('game').hidden = false;
    if (result.story) {
      const { title, subtitle, game_version, max_score } = result.story;
      document.title = `${title} — Exploration Task`;
      $('story-title').textContent = title;
      $('story-subtitle').textContent = subtitle;
      $('story-edition').textContent = `${title} · ${game_version}`;
      $('score-max').textContent = max_score == null ? '' : `/ ${max_score}`;
    }
    $('location').textContent = result.state.room.name;
    $('score').textContent = result.state.score ?? '—';
    const addedResponse = renderTranscript(result, history);
    $('progress').textContent = `Decision ${Math.min(count + 1, DECISION_LIMIT)} / ${DECISION_LIMIT}`;
    $('decision-track').replaceChildren(...Array.from({ length: DECISION_LIMIT }, (_, i) => {
      const marker = document.createElement('span'); marker.className = i < count ? 'filled' : ''; return marker;
    }));
    renderInventory(result.state.inventory);
    $('actions').replaceChildren(...result.actions.map(action => {
      const li = document.createElement('li'), button = document.createElement('button');
      const category = menuGroup(action);
      li.dataset.category = category;
      button.type = 'button'; button.className = 'action'; button.textContent = action.label;
      button.dataset.actionId = action.id; button.dataset.category = category; button.disabled = true;
      button.addEventListener('click', event => {
        const clicked = clock.sample();
        if (event.detail > 1) return;
        controller.select(action.id, clicked, selectedCategory);
      });
      li.append(button); return li;
    }));
    for (const category of ['move', 'action', 'bag']) {
      const count = category === 'bag' ? result.state.inventory.length : result.actions.filter(action => menuGroup(action) === category).length;
      $(`${category}-count`).textContent = String(count).padStart(2, '0');
    }
    showMenu();
    if (addedResponse) showLatestResponse();
    setEnabled(false);
    if (controller.status !== 'ready') $('narrative').focus({ preventScroll: true });
  },
  ready() {
    $('start').hidden = false;
    $('progress').textContent = `Ready · ${DECISION_LIMIT} decisions`;
    $('notice').textContent = 'Explore one choice at a time. Move through the world, interact with what you find, or check your bag for free. After 10 decisions, your session data downloads.';
  },
  started() { $('start').hidden = true; $('notice').textContent = ''; $('recovery').hidden = true; },
  enable() { setEnabled(true); },
  disable() { setEnabled(false); },
  complete(session) {
    $('start').hidden = true; $('choices').hidden = true; $('notice').textContent = ''; $('completion').hidden = false;
    $('progress').textContent = `${session.rows.length} / ${DECISION_LIMIT} decisions recorded`;
    $('completion-heading').textContent = session.status === 'completed' ? 'Session complete' : 'Session ended early';
    $('completion-message').textContent = session.status === 'completed'
      ? 'Thank you. Your 10 choices have been recorded. If the download did not start, use Download CSV below. You can download it again while this page remains open.'
      : session.termination_reason === 'story_finish' || session.termination_reason === 'vm_quit'
        ? 'The game has ended. Your recorded choices are available below.'
        : `The session could not continue. ${session.error || 'It was interrupted.'} Download the recorded choices and session details below.`;
    if (!current) { $('story-title').textContent = 'Story unavailable'; $('story-subtitle').textContent = storyId; }
  },
  storageUnavailable() {
    $('storage-notice').hidden = false;
    $('storage-notice').textContent = 'Browser recovery storage is unavailable. Keep this page open until you have downloaded your data.';
  },
};
const controller = new ExperimentController({ game: new GameAdapter({ storyId }), view, store });
for (const button of document.querySelectorAll('.category')) {
  button.onclick = () => {
    if (!enabled) return;
    controller.browse(button.dataset.category, clock.sample());
    showMenu(button.dataset.category, true);
  };
}
function back() {
  if (!enabled || selectedCategory === null) return;
  const category = selectedCategory;
  controller.browse('categories', clock.sample());
  showMenu();
  document.querySelector(`[data-category="${category}"].category`).focus({ preventScroll: true });
}
$('menu-back').onclick = back;
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && selectedCategory) { event.preventDefault(); back(); }
});
$('start').onclick = () => controller.start();
$('latest-response').onclick = () => { showLatestResponse(); $('narrative').focus({ preventScroll: true }); };
$('download').onclick = () => controller.downloadCSV();
$('details-download').onclick = () => controller.downloadMetadata();
document.addEventListener('visibilitychange', () => controller.visibilityChanged(document.hidden));
window.addEventListener('pagehide', () => controller.pageExit());
await controller.initialize();
if (!store.available) view.storageUnavailable();
