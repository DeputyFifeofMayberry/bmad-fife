#!/usr/bin/env node
// WhereWasI session-end updater — the shared core behind the state convention.
//
// Modes:
//   save   — read the composed update as JSON on stdin and rewrite STATUS.md
//            (adaptation-notes §2 shape, ≤30 lines), stamping `updated:`.
//            Resolved decisions graduate into DECISIONS.md (append-only).
//            All writes are atomic (temp file + rename).
//   check  — read the Stop-hook payload on stdin. If STATUS.md is older than
//            the session marker, print a block decision telling the agent to
//            compose and run save. `stop_hook_active` in the payload is the
//            loop guard: check exits 0 silently and the stop proceeds.
//   mark   — touch the staleness marker in .wherewasi/ (SessionStart hook).
//
// Zero dependencies (node built-ins only). Story 1.3; the pi adapter (1.4)
// imports runCheck() and runMark() from this module — one shared implementation.
//
// Input schema for `save` (stdin JSON):
//   {
//     "standing": "2-3 sentences: what works, what's in flight",   // required
//     "openDecisions": ["one line each"],                          // required (may be [])
//     "nextAction": "the single next thing",                       // required, one line
//     "graduatedDecisions": [{ "decision": "...", "why": "..." }], // optional
//     "tool": "pi" / "claude code" / ...,                          // optional, default "agent"
//     "projectName": "..."                                         // optional, default: existing title / dir name
//   }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CEILING = 30; // AGENTS.md rule 3: STATUS.md stays at ~30 lines or fewer
const SECTIONS = ['## Where things stand', '## Open decisions', '## Next action'];
const STATUS_NAME = 'STATUS.md';
const DECISIONS_NAME = 'DECISIONS.md';
const MARKER_REL = path.join('.wherewasi', 'marker');
const DEFAULT_TOOL = 'agent';

export class SaveError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SaveError';
    this.code = code; // E_INPUT | E_OVERFLOW | E_SHAPE | E_IO
  }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..', '..');

function resolveRoot(opts) {
  return path.resolve(opts?.root ?? process.env.WHEREWASI_ROOT ?? defaultRoot);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoDate(now) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function readProjectName(root) {
  try {
    const first = fs.readFileSync(path.join(root, STATUS_NAME), 'utf8').split('\n', 1)[0] ?? '';
    const m = first.match(/^# STATUS — (.+)$/);
    if (m && m[1].trim()) return m[1].trim();
  } catch {
    /* fall through to directory name */
  }
  return path.basename(root);
}

function writeAtomic(file, content) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, file); // atomic on POSIX; on Windows, rename over a closed file is atomic too
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* best effort */
    }
    throw new SaveError('E_IO', `cannot write ${path.basename(file)}: ${err.message}`);
  }
}

// --- input validation -------------------------------------------------------

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SaveError('E_INPUT', `input.${field} must be a non-empty string`);
  }
  const normalized = value.trim().replace(/\r\n?/g, '\n'); // normalize line endings, trim edges
  const hashLine = normalized.split('\n').findIndex((l) => l.startsWith('#'));
  if (hashLine >= 0) {
    throw new SaveError(
      'E_SHAPE',
      `input.${field} line ${hashLine + 1} starts with "#": titles and section headers are the updater's framing, never field content`
    );
  }
  return normalized;
}

function singleLine(value, field) {
  if (value.includes('\n')) {
    throw new SaveError('E_INPUT', `input.${field} must be a single line`);
  }
  return value;
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SaveError('E_INPUT', 'input must be a JSON object on stdin');
  }
  const standing = nonEmptyString(input.standing, 'standing');
  const nextAction = singleLine(nonEmptyString(input.nextAction, 'nextAction'), 'nextAction');

  const rawOpen = input.openDecisions ?? [];
  if (!Array.isArray(rawOpen)) {
    throw new SaveError('E_INPUT', 'input.openDecisions must be an array of strings');
  }
  const open = rawOpen.map((d, i) => singleLine(nonEmptyString(d, `openDecisions[${i}]`), `openDecisions[${i}]`));

  const rawGrad = input.graduatedDecisions ?? [];
  if (!Array.isArray(rawGrad)) {
    throw new SaveError('E_INPUT', 'input.graduatedDecisions must be an array of {decision, why}');
  }
  const graduated = rawGrad.map((g, i) => {
    if (!g || typeof g !== 'object' || Array.isArray(g)) {
      throw new SaveError('E_INPUT', `input.graduatedDecisions[${i}] must be an object {decision, why}`);
    }
    return {
      decision: singleLine(nonEmptyString(g.decision, `graduatedDecisions[${i}].decision`), `graduatedDecisions[${i}].decision`),
      why: singleLine(nonEmptyString(g.why, `graduatedDecisions[${i}].why`), `graduatedDecisions[${i}].why`),
    };
  });

  return { standing, nextAction, open, graduated };
}

// --- composition ------------------------------------------------------------

function composeStatusLines({ projectName, tool, date, standing, openDecisions, nextAction }) {
  return [
    `# STATUS — ${projectName}`,
    `updated: ${date} by ${tool}`,
    '',
    SECTIONS[0],
    ...standing.split('\n'),
    '',
    SECTIONS[1],
    ...(openDecisions.length > 0 ? openDecisions.map((d) => `- ${d}`) : ['- None.']),
    '',
    SECTIONS[2],
    nextAction,
  ];
}

function assertShape(lines) {
  const problems = [];
  if (!/^# STATUS — .+$/.test(lines[0])) problems.push('missing title line "# STATUS — <name>"');
  if (!/^updated: \d{4}-\d{2}-\d{2} by .+$/.test(lines[1])) problems.push('missing "updated: <date> by <tool>" line');
  let at = 3;
  for (const section of SECTIONS) {
    const i = lines.indexOf(section, at);
    if (i < 0) problems.push(`missing section "${section}"`);
    else at = i + 1;
  }
  if (problems.length > 0) {
    throw new SaveError('E_SHAPE', `composed STATUS.md is malformed: ${problems.join('; ')}`);
  }
}

// --- save -------------------------------------------------------------------

export function runSave(input, opts = {}) {
  const root = resolveRoot(opts);
  const { standing, nextAction, open, graduated } = validateInput(input);

  const now = opts.now ?? new Date();
  const date = isoDate(now);
  const tool =
    (typeof input.tool === 'string' && input.tool.trim()) ? input.tool.trim()
      : (typeof opts.tool === 'string' && opts.tool.trim()) ? opts.tool.trim()
        : DEFAULT_TOOL;
  const projectName =
    (typeof input.projectName === 'string' && input.projectName.trim())
      ? input.projectName.trim()
      : readProjectName(root);

  const lines = composeStatusLines({ projectName, tool, date, standing, openDecisions: open, nextAction });

  if (lines.length > CEILING) {
    const standingLines = standing.split('\n').length;
    const overhead = lines.length - standingLines - (open.length || 1) - 1;
    throw new SaveError(
      'E_OVERFLOW',
      `STATUS.md would be ${lines.length} lines — ${lines.length - CEILING} over the ${CEILING}-line ceiling ` +
        `(standing ${standingLines}, open decisions ${open.length || 1}, next action 1, fixed framing ${overhead}). ` +
        `Overflow belongs in DECISIONS.md or project notes, never the state file.`
    );
  }
  assertShape(lines);

  // DECISIONS.md is written FIRST — appended, never rewritten — and STATUS.md
  // is the commit point. If the append fails, nothing else was touched; if the
  // STATUS write fails, the log is rolled back. No partial state, and no
  // graduated decision is ever dropped (AGENTS.md rule 4).
  let priorDecisions = null; // bytes to restore if the STATUS write fails
  let seededDecisions = false;
  if (graduated.length > 0) {
    const decisionsPath = path.join(root, DECISIONS_NAME);
    let base = '';
    try {
      base = fs.readFileSync(decisionsPath, 'utf8');
    } catch {
      base = '';
    }
    const chunk = graduated.map((g) => `- ${date} — ${g.decision} — ${g.why}`).join('\n') + '\n';
    if (!base.trim()) {
      writeAtomic(
        decisionsPath,
        `# DECISIONS — ${projectName} (WhereWasI)\n\nAppend-only: date — decision — why. Rejected ideas recorded with why-rejected.\n` + chunk
      );
      seededDecisions = true;
    } else {
      priorDecisions = base;
      // append-only write: existing bytes are never rewritten; a missing
      // trailing newline is bridged inside the appended chunk instead.
      fs.appendFileSync(decisionsPath, (base.endsWith('\n') ? '' : '\n') + chunk);
    }
  }

  try {
    writeAtomic(path.join(root, STATUS_NAME), lines.join('\n') + '\n');
  } catch (err) {
    const decisionsPath = path.join(root, DECISIONS_NAME);
    if (priorDecisions !== null) {
      try {
        writeAtomic(decisionsPath, priorDecisions); // best effort rollback
      } catch {
        /* the log then holds entries the open queue still lists — safe, nothing dropped */
      }
    } else if (seededDecisions) {
      try {
        fs.unlinkSync(decisionsPath); // remove the just-seeded log so a retry starts clean
      } catch {
        /* best effort */
      }
    }
    throw err;
  }

  return { root, date, tool, projectName, statusLines: lines.length, graduated: graduated.length };
}

// --- check (Stop hook) ------------------------------------------------------

const BLOCK_REASON =
  'STATUS.md is stale — it has not been saved since this session started. ' +
  'Compose the session-end update (standing, openDecisions, nextAction, graduatedDecisions) and pipe it as JSON to ' +
  'node scripts/wherewasi/save.mjs save  (AGENTS.md rule 2), then stop again.';

export function runCheck(payload, opts = {}) {
  if (payload && payload.stop_hook_active === true) {
    return { stale: false, guarded: true }; // a stop hook already fired for this stop — never block again
  }
  const root = resolveRoot(opts);
  let markerMtime;
  try {
    markerMtime = fs.statSync(path.join(root, MARKER_REL)).mtimeMs;
  } catch {
    return { stale: false, reason: 'no session marker — nothing to enforce yet' };
  }
  let statusMtime;
  try {
    statusMtime = fs.statSync(path.join(root, STATUS_NAME)).mtimeMs;
  } catch {
    return { stale: true, reason: 'STATUS.md is missing' };
  }
  if (statusMtime >= markerMtime) return { stale: false };
  return { stale: true };
}

// --- mark (SessionStart hook) -----------------------------------------------

export function runMark(opts = {}) {
  const root = resolveRoot(opts);
  const markerPath = path.join(root, MARKER_REL);
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  const now = new Date();
  try {
    fs.utimesSync(markerPath, now, now); // touch
  } catch {
    fs.writeFileSync(markerPath, ''); // first mark
  }
  return { marker: markerPath };
}

// --- CLI --------------------------------------------------------------------

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) return resolve(data);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => {
      data += c;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function main() {
  const mode = process.argv[2];

  if (mode === 'mark') {
    runMark();
    return 0;
  }

  if (mode === 'check') {
    const raw = await readStdin();
    let payload = {};
    if (raw.trim()) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = {}; // payload discarded — garbage on stdin must not be a bypass; staleness alone decides
      }
    }
    const result = runCheck(payload);
    if (result.stale) {
      console.log(JSON.stringify({ decision: 'block', reason: BLOCK_REASON }));
    }
    return 0;
  }

  if (mode === 'save') {
    const raw = await readStdin();
    let input;
    try {
      input = JSON.parse(raw);
    } catch (err) {
      console.error(`save: invalid JSON on stdin — ${err.message}; no files written`);
      return 1;
    }
    try {
      const result = runSave(input);
      const parts = [`saved ${STATUS_NAME} (${result.statusLines} lines, updated ${result.date} by ${result.tool})`];
      if (result.graduated > 0) parts.push(`${result.graduated} decision(s) graduated to ${DECISIONS_NAME}`);
      process.stderr.write(`save: ${parts.join('; ')}\n`);
      return 0;
    } catch (err) {
      if (err instanceof SaveError) {
        const nowrites = err.code === 'E_INPUT' || err.code === 'E_OVERFLOW' || err.code === 'E_SHAPE';
        console.error(`save: ${err.message}${nowrites ? ' — no files written' : ''}`);
        return 1;
      }
      throw err;
    }
  }

  console.error('usage: node scripts/wherewasi/save.mjs <save|check|mark>');
  console.error('  save   — composed update as JSON on stdin → rewrites STATUS.md, graduates DECISIONS.md');
  console.error('  check  — Stop-hook payload on stdin → block JSON if STATUS.md is older than the session marker');
  console.error('  mark   — touch the session staleness marker (.wherewasi/marker)');
  return 1;
}

const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  main().then(
    (code) => {
      process.exitCode = code; // let stdio drain; never hard-exit with piped output pending
    },
    (err) => {
      console.error(err);
      process.exitCode = 1;
    }
  );
}
