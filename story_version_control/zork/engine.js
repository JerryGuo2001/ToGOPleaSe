import { GlkPort } from '../../js/glk-port.js';
import { StateReader } from './state-reader.js';
import { SCHEMA } from './story-schema.js';

export const GAME_VERSION = '119/880429';
export const RANDOM_SEED = 119880429;

export class EngineCore {
  constructor(ZVM) {
    this.ZVM = ZVM;
    this.ready = false;
    this.gameOver = false;
  }
  async initialize(bytes) {
    if (this.vm) throw new Error('Engine already initialized');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== SCHEMA.sha256) throw new Error('Story hash mismatch: the adapter requires unmodified Zork 119/880429');
    this.port = new GlkPort();
    this.vm = new this.ZVM();
    // Set the interpreter's existing seeded PRNG after its header setup, before
    // the first story instruction. No story bytes or mechanics are patched.
    const updateHeader = this.vm.update_header;
    this.vm.update_header = function () {
      updateHeader.call(this);
      this.random(-RANDOM_SEED);
    };
    this.vm.prepare(new Uint8Array(bytes), { Glk: this.port });
    this.vm.init();
    this.reader = new StateReader(this.vm);
    return this.capture();
  }
  executeAction(command) {
    if (!this.ready || this.gameOver) throw new Error('Game is not accepting a command');
    if (!/^[a-z][a-z0-9 -]*$/.test(command) || /\b(?:then|and|save|restore|restart|quit|script|unscript|undo|again)\b/.test(command)) {
      throw new Error('Only one registered gameplay command is permitted');
    }
    const pending = this.port.pending;
    if (command.length > pending.buffer.length) throw new Error('Command exceeds story input capacity');
    this.ready = false;
    this.port.pending = null;
    this.port.text = '';
    for (let i = 0; i < command.length; i++) pending.buffer[i] = command.charCodeAt(i);
    this.vm.glk_event.fields = [3, pending.window, command.length, 0];
    this.vm.resume();
    return this.capture(command);
  }
  capture(command = '') {
    if (this.port.error) throw this.port.error;
    const rawResponse = this.port.text;
    // FINISH waits for a management command, instead of issuing @quit.
    const finished = rawResponse.includes('Would you like to restart the game from the beginning, restore a saved');
    this.gameOver = this.port.ended || !!this.vm.quit || finished;
    this.ready = !!this.port.pending && !this.gameOver;
    if (!this.ready && !this.gameOver) throw new Error('Engine stopped outside a recognized input boundary');
    // Preserve all story characters except the final input-cursor glyph. Keep the
    // complete unfiltered stream separately for audits and CSV raw_response.
    const response = rawResponse.endsWith('>') ? rawResponse.slice(0, -1) : rawResponse;
    const state = this.reader.read(response, command);
    this.last = { response, rawResponse, state, gameOver: this.gameOver, terminationReason: this.gameOver ? (finished ? 'story_finish' : 'vm_quit') : '' };
    return structuredClone(this.last);
  }
  getLastResponse() { return this.last.response; }
  getAvailableState() { return structuredClone(this.last.state); }
  isGameOver() { return this.gameOver; }
}
