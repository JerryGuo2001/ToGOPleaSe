import { GameAdapter } from './game-adapter.js';
import { ExperimentController, DECISION_LIMIT } from './experiment-controller.js';
import { SessionStore } from './session-store.js';
import { clock } from './timing.js';
import { csvBlob, metadataBlob, downloadBlob } from './data_save.js';
import { DEFAULT_STORY } from './config.js';
import { pagedList } from './paged-list.js';
import { menuGroup } from './action-menu.js';

const $ = id => document.getElementById(id);
const storyId = new URLSearchParams(location.search).get('story') || DEFAULT_STORY;
let current, selectedCategory = 'move';
const categories = [...$('categories').querySelectorAll('[role="tab"]')];
const inventoryPages = pagedList($('inventory'), $('inventory-pages'), () => true,
  page => controller.browse(`inventory:page:${page}`, clock.sample()));
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

function setEnabled(value) {
  document.querySelectorAll('.action, #categories button').forEach(button => { button.disabled = !value; });
  $('choices').setAttribute('aria-busy', String(!value));
  $('turn-status').textContent = value ? 'Your turn' : controller.status === 'ready' ? 'Get ready' : 'Please wait…';
}
function showCategory(category) {
  selectedCategory = category;
  for (const button of categories) {
    const selected = button.dataset.category === category;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  let count = 0;
  for (const item of $('actions').children) {
    item.hidden = item.firstElementChild.dataset.category !== category;
    if (!item.hidden) count++;
  }
  $('action-panel').setAttribute('aria-labelledby', `category-${category}`);
  $('no-actions').textContent = { move: 'No moves available here.', action: 'No actions available here.', bag: 'No item actions available here.' }[category];
  $('no-actions').hidden = count > 0;
  $('actions').hidden = count === 0;
}
function renderActions(actions) {
  const choices = [];
  for (const action of actions) {
    const li = document.createElement('li'), button = document.createElement('button');
    const category = menuGroup(action);
    button.type = 'button'; button.className = 'action'; button.textContent = action.label;
    button.dataset.actionId = action.id; button.dataset.category = category; button.disabled = true;
    button.addEventListener('click', event => {
      const clicked = clock.sample();
      if (event.detail > 1) return;
      controller.select(action.id, clicked, category);
    });
    li.append(button);
    choices.push(li);
  }
  $('actions').replaceChildren(...choices);
  for (const button of categories) {
    button.querySelector('.category-count').textContent = actions.filter(action => menuGroup(action) === button.dataset.category).length;
  }
  showCategory(selectedCategory);
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
  inventoryPages.fit(true);
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
  // Start and finalization can render the same state again.
  // Append only confirmed decisions that are not already in the transcript.
  const newRows = history.slice(transcript.children.length - 1);
  for (const row of newRows) append(row.game_text_after, row);
  $('latest-response').hidden = !history.length;
  return newRows.length > 0;
}
const view = {
  render(result, count, history) {
    current = result;
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
    renderActions(result.actions);
    if (addedResponse) showLatestResponse();
    setEnabled(false);
    if (controller.status !== 'ready') $('narrative').focus({ preventScroll: true });
  },
  ready() {
    $('start').hidden = false;
    $('progress').textContent = `Ready · ${DECISION_LIMIT} decisions`;
    $('notice').textContent = 'Explore one choice at a time. Choose Move, Action or Bag below the story, then pick an option. Each category shows up to 9 choices. Browsing categories and viewing your inventory are free. After 10 decisions, your session data downloads.';
  },
  started() {
    document.body.classList.add('session-active');
    $('start').hidden = true; $('notice').textContent = ''; $('recovery').hidden = true;
    window.scrollTo(0, 0);
  },
  enable() { setEnabled(true); },
  disable() { setEnabled(false); },
  complete(session) {
    document.body.classList.add('session-complete');
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
for (const button of categories) {
  button.onclick = () => {
    if (controller.browse(button.dataset.category, clock.sample())) showCategory(button.dataset.category);
  };
  button.onkeydown = event => {
    const index = categories.indexOf(button);
    const next = { ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2 }[event.key];
    if (next === undefined || button.disabled) return;
    event.preventDefault();
    categories[next].focus({ preventScroll: true });
    categories[next].click();
  };
}
$('start').onclick = () => controller.start();
$('latest-response').onclick = () => { showLatestResponse(); $('narrative').focus({ preventScroll: true }); };
$('download').onclick = () => controller.downloadCSV();
$('details-download').onclick = () => controller.downloadMetadata();
document.addEventListener('visibilitychange', () => controller.visibilityChanged(document.hidden));
window.addEventListener('pagehide', () => controller.pageExit());
await controller.initialize();
if (!store.available) view.storageUnavailable();
