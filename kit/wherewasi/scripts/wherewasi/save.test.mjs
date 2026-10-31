// save.test.mjs — node:test suite for the WhereWasI updater (story 1.3).
// One case per I/O-matrix row in the story, against temp-dir fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runSave, runCheck, runMark, SaveError } from './save.mjs';

const SCRIPT = fileURLToPath(new URL('./save.mjs', import.meta.url));
const NOW = new Date('2026-10-31T12:00:00'); // fixed clock for content; mtime tests pin utimes instead

const OLD_STATUS = [
  '# STATUS — fixture',
  'updated: 2020-01-01 by test',
  '',
  '## Where things stand',
  'Old standing.',
  '',
  '## Open decisions',
  '- Old question?',
  '',
  '## Next action',
  'Old next action.',
  '',
].join('\n');

const OLD_DECISIONS = [
  '# DECISIONS — fixture (WhereWasI)',
  '',
  'Append-only: date — decision — why. Rejected ideas recorded with why-rejected.',
  '',
  '- 2020-01-01 — prior decision — prior context.',
  '',
].join('\n');

function makeRoot({ status = true, decisions = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wherewasi-test-'));
  if (status) fs.writeFileSync(path.join(root, 'STATUS.md'), OLD_STATUS);
  if (decisions) fs.writeFileSync(path.join(root, 'DECISIONS.md'), OLD_DECISIONS);
  return root;
}

const validInput = {
  standing: 'New standing. The updater works.',
  openDecisions: ['Q1 — still undecided'],
  nextAction: 'Do the next thing.',
  graduatedDecisions: [{ decision: 'Adopt hooks', why: 'enforcement beats recall' }],
};

function cli(args, { stdin = '', root } = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, WHEREWASI_ROOT: root },
  });
}

test('save: happy path rewrites STATUS.md in section-2 shape and graduates decisions', () => {
  const root = makeRoot();
  const result = runSave(validInput, { root, now: NOW });
  assert.equal(result.statusLines, 11);
  assert.equal(result.graduated, 1);

  const expected = [
    '# STATUS — fixture', // project name preserved from the existing title
    'updated: 2026-10-31 by agent', // date stamped, default tool
    '',
    '## Where things stand',
    'New standing. The updater works.',
    '',
    '## Open decisions',
    '- Q1 — still undecided',
    '',
    '## Next action',
    'Do the next thing.',
    '',
  ].join('\n');
  assert.equal(fs.readFileSync(path.join(root, 'STATUS.md'), 'utf8'), expected);

  const decisions = fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf8');
  assert.ok(decisions.startsWith('# DECISIONS — fixture (WhereWasI)'), 'header intact (append-only)');
  assert.ok(decisions.includes('- 2020-01-01 — prior decision — prior context.'), 'prior entries intact');
  assert.ok(decisions.endsWith('- 2026-10-31 — Adopt hooks — enforcement beats recall\n'), 'new entry appended, dated');
});

test('save: over the 30-line ceiling is rejected, no file written', () => {
  const root = makeRoot();
  const long = { ...validInput, standing: Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n') };
  assert.throws(
    () => runSave(long, { root, now: NOW }),
    (err) => {
      assert.ok(err instanceof SaveError);
      assert.equal(err.code, 'E_OVERFLOW');
      assert.match(err.message, /50 lines — 20 over the 30-line ceiling/);
      assert.match(err.message, /standing 40/);
      return true;
    }
  );
  assert.equal(fs.readFileSync(path.join(root, 'STATUS.md'), 'utf8'), OLD_STATUS, 'STATUS.md untouched');
  assert.equal(fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf8'), OLD_DECISIONS, 'DECISIONS.md untouched');
  assert.deepEqual(fs.readdirSync(root).filter((f) => f.includes('.tmp')), [], 'no temp files left');
});

test('save: malformed stdin JSON exits 1 with a parse error, no writes (CLI)', () => {
  const root = makeRoot();
  const r = cli(['save'], { stdin: '{oops', root });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /invalid JSON on stdin/);
  assert.equal(fs.readFileSync(path.join(root, 'STATUS.md'), 'utf8'), OLD_STATUS);
  assert.equal(fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf8'), OLD_DECISIONS);
});

test('save: empty graduatedDecisions leaves DECISIONS.md untouched', () => {
  const root = makeRoot();
  const before = fs.statSync(path.join(root, 'DECISIONS.md')).mtimeMs;
  runSave({ ...validInput, graduatedDecisions: [] }, { root, now: NOW });
  assert.equal(fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf8'), OLD_DECISIONS);
  assert.equal(fs.statSync(path.join(root, 'DECISIONS.md')).mtimeMs, before, 'not even re-written');
  assert.match(fs.readFileSync(path.join(root, 'STATUS.md'), 'utf8'), /New standing/);
});

test('save: bad input shapes are rejected by name, nothing written', () => {
  const root = makeRoot();
  const bad = [
    { ...validInput, standing: '' },
    { ...validInput, nextAction: 'two\nlines' },
    { ...validInput, openDecisions: 'nope' },
    { ...validInput, openDecisions: ['multi\nline'] },
    { ...validInput, graduatedDecisions: [{ decision: 'no why' }] },
    { ...validInput, graduatedDecisions: [{ why: 'no decision' }] },
  ];
  for (const input of bad) {
    assert.throws(() => runSave(input, { root, now: NOW }), SaveError, JSON.stringify(input));
  }
  assert.equal(fs.readFileSync(path.join(root, 'STATUS.md'), 'utf8'), OLD_STATUS);
  assert.equal(fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf8'), OLD_DECISIONS);
});

test('save: seeds both files when neither exists (fresh project)', () => {
  const root = makeRoot({ status: false, decisions: false });
  const result = runSave(validInput, { root, now: NOW });
  assert.equal(result.projectName, path.basename(root), 'falls back to directory name');
  const status = fs.readFileSync(path.join(root, 'STATUS.md'), 'utf8');
  assert.ok(status.startsWith(`# STATUS — ${path.basename(root)}`));
  const decisions = fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf8');
  assert.match(decisions, /^# DECISIONS — .+ \(WhereWasI\)/);
  assert.ok(decisions.includes('- 2026-10-31 — Adopt hooks — enforcement beats recall'));
});

test('save: atomic writes leave no temp files behind (interrupted-write safety)', () => {
  const root = makeRoot();
  runSave(validInput, { root, now: NOW });
  assert.deepEqual(fs.readdirSync(root).filter((f) => f.includes('.tmp')), []);
  const entries = fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf8').split('\n').filter((l) => l.startsWith('- '));
  assert.equal(entries.length, 2, 'prior + new decision, nothing else');
});

test('save: CLI end-to-end via WHEREWASI_ROOT and stdin JSON', () => {
  const root = makeRoot();
  const r = cli(['save'], { stdin: JSON.stringify({ ...validInput, tool: 'claude code' }), root });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /saved STATUS\.md/);
  assert.match(fs.readFileSync(path.join(root, 'STATUS.md'), 'utf8'), /updated: \d{4}-\d{2}-\d{2} by claude code/);
});

// --- check / mark (enforcement) ----------------------------------------------

function pinMtime(root, rel, ms) {
  // Deterministic staleness fixtures: pin mtimes instead of racing the wall clock.
  const t = new Date(ms);
  fs.utimesSync(path.join(root, rel), t, t);
}

test('mark: creates .wherewasi/marker, creating the directory if missing', () => {
  const root = makeRoot();
  const { marker } = runMark({ root });
  assert.equal(marker, path.join(root, '.wherewasi', 'marker'));
  assert.ok(fs.existsSync(marker));
});

test('mark: re-marking updates the marker time (later session)', () => {
  const root = makeRoot();
  const { marker } = runMark({ root });
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(marker, past, past);
  runMark({ root });
  assert.ok(fs.statSync(marker).mtimeMs >= Date.now() - 5_000);
});

test('check: fresh (STATUS mtime >= marker mtime) is silent, exit 0', () => {
  const root = makeRoot();
  runMark({ root });
  const t = NOW.getTime();
  pinMtime(root, 'STATUS.md', t);
  pinMtime(root, '.wherewasi/marker', t - 1000);
  const r = cli(['check'], { stdin: '{}', root });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'fresh check is silent');
});

test('check: equal mtimes count as fresh (>=, not >)', () => {
  const root = makeRoot();
  runMark({ root });
  const t = NOW.getTime();
  pinMtime(root, 'STATUS.md', t);
  pinMtime(root, '.wherewasi/marker', t);
  const r = cli(['check'], { stdin: '{}', root });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('check: stale marker blocks with hook JSON; after save, stop proceeds with no second block', () => {
  const root = makeRoot();
  runMark({ root });
  const t = NOW.getTime();
  pinMtime(root, '.wherewasi/marker', t);
  pinMtime(root, 'STATUS.md', t - 1000); // STATUS older than the session start

  const r = cli(['check'], { stdin: '{}', root });
  assert.equal(r.status, 0, 'block is a decision, not a nonzero exit');
  const payload = JSON.parse(r.stdout);
  assert.equal(payload.decision, 'block');
  assert.match(payload.reason, /save/);

  // The agent composes and saves; the next Stop must not block again.
  runSave(validInput, { root, now: NOW });
  pinMtime(root, 'STATUS.md', t + 5000);
  const r2 = cli(['check'], { stdin: '{}', root });
  assert.equal(r2.status, 0);
  assert.equal(r2.stdout, '', 'no second block after save');
});

test('check: stop_hook_active in the payload exits 0 silently — no loop', () => {
  const root = makeRoot();
  runMark({ root });
  const t = NOW.getTime();
  pinMtime(root, '.wherewasi/marker', t);
  pinMtime(root, 'STATUS.md', t - 1000); // stale on purpose — the guard must win anyway
  const r = cli(['check'], { stdin: JSON.stringify({ stop_hook_active: true }), root });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('check: no marker yet → nothing to enforce, silent exit 0', () => {
  const root = makeRoot();
  const r = cli(['check'], { stdin: '{}', root });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('check: missing STATUS.md with a marker present is stale', () => {
  const root = makeRoot({ status: false, decisions: false });
  runMark({ root });
  const result = runCheck({}, { root });
  assert.equal(result.stale, true);
});

test('check: garbage on stdin still enforces on staleness (payload discarded, exit 0)', () => {
  const root = makeRoot();
  runMark({ root });
  const t = NOW.getTime();
  pinMtime(root, '.wherewasi/marker', t);
  pinMtime(root, 'STATUS.md', t - 1000);
  const r = cli(['check'], { stdin: 'not json at all', root });
  assert.equal(r.status, 0);
  assert.ok(JSON.parse(r.stdout).decision === 'block', 'still enforces on stat alone');
});
