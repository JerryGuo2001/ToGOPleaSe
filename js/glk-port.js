// Text-only Glk host for the pinned ZVM. No DOM, keyboard simulation, or command echo.
export class RefBox {
  set_value(value) { this.value = value; }
  get_value() { return this.value; }
}
export class RefStruct {
  constructor() { this.fields = []; }
  push_field(value) { this.fields.push(value); }
  set_field(index, value) { this.fields[index] = value; }
  get_field(index) { return this.fields[index]; }
}
export class GlkPort {
  constructor() {
    this.RefBox = RefBox;
    this.RefStruct = RefStruct;
    this.text = '';
    this.pending = null;
    this.ended = false;
    this.error = null;
  }
  glk_gestalt() { return 0; }
  glk_stylehint_set() {}
  glk_stylehint_clear() {}
  glk_set_style() {}
  glk_window_open(split, method, size, type, rock) { return { type, rock, size }; }
  glk_set_window(window) { this.window = window; }
  glk_window_get_size(window, width, height) {
    if (width) width.set_value(80);
    if (height) height.set_value(window.type === 3 ? 24 : window.size);
  }
  glk_window_get_stream(window) { return window; }
  glk_window_get_parent(window) { return window; }
  glk_window_close() {}
  glk_window_move_cursor() {}
  glk_window_clear() {}
  glk_window_set_arrangement() {}
  glk_put_jstring(text) { this.glk_put_jstring_stream(this.window, text); }
  glk_put_jstring_stream(window, text) {
    if (window.type === 3) this.text += text;
  }
  glk_request_line_event_uni(window, buffer) { this.pending = { window, buffer }; }
  glk_request_char_event_uni() { throw new Error('Unexpected character input request'); }
  glk_select() {}
  update() {}
  fatal_error(error) { this.error = error instanceof Error ? error : new Error(String(error)); }
  glk_exit() { this.ended = true; }
  glk_fileref_create_by_prompt() { throw new Error('File commands are not part of this experiment'); }
}
