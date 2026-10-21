import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SCHEMA } from '../js/story-schema.js';

test('story, archival source, interpreter source and original user files match provenance', async () => {
  const provenance = JSON.parse(await readFile('game/PROVENANCE.json', 'utf8'));
  const binary = await readFile(provenance.story.file);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(binary[0], 3);
  assert.equal(binary.readUInt16BE(2), 119);
  assert.equal(binary.toString('ascii', 18, 24), '880429');
  assert.equal(binary.subarray(64).reduce((sum, byte) => (sum + byte) & 65535, 0), binary.readUInt16BE(28));
  assert.equal(hash(binary), provenance.story.sha256);
  assert.equal(hash(binary), SCHEMA.sha256);
  for (const files of [provenance.matching_source.file_sha256, provenance.interpreter.source_file_sha256, provenance.original_user_files.file_sha256]) {
    for (const [path, expected] of Object.entries(files)) assert.equal(hash(await readFile(path)), expected, path);
  }
});
