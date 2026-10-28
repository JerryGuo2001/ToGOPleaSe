// Initialize the exact story, issue zero commands, and inspect its object table.
import { readFile, writeFile } from 'node:fs/promises';
import ZVM from '../../js/vendor/ifvms/src/zvm.js';
import { GlkPort } from '../../js/glk-port.js';
const vm = new ZVM();
const port = new GlkPort();
vm.prepare(new Uint8Array(await readFile(new URL('../../story_version_control/zork/zork1-r119-s880429.z3', import.meta.url))), { Glk: port });
vm.init();
if (port.error) throw port.error;
const m = vm.m;
const first = vm.objects + 9;
const count = (m.getUint16(first + 7) - first) / 9;
if (count !== 250) throw new Error('Unexpected r119 object-table size');
const objects = Array.from({ length: count }, (_, index) => {
  const id = index + 1;
  const table = m.getUint16(vm.objects + id * 9 + 7);
  const words = m.getUint8(table);
  const props = {};
  let address = table + 1 + words * 2;
  while (m.getUint8(address)) {
    const header = m.getUint8(address++), length = (header >> 5) + 1;
    props[header & 31] = Array.from(m.getUint8Array(address, length));
    address += length;
  }
  return { id, name: words ? String(vm.decode(table + 1, words * 2)) : '',
    parent: vm.get_parent(id), attrs: Array.from({ length: 32 }, (_, flag) => flag).filter(flag => vm.test_attr(id, flag)), props };
});
await writeFile(new URL('./story-inspection.json', import.meta.url), JSON.stringify(objects, null, 2) + '\n');
console.log('Inspected 250 story objects at the first input boundary, without commands.');
