// WhereWasI pi adapter — session-end enforcement for the pi harness.
//
// Mirrors the Claude Code adapter (story 1.3) on pi's lifecycle:
//   session_start       — touch the staleness marker (runMark from the shared updater)
//   agent_before_settle — when STATUS.md is older than the marker, append one
//                         custom_message instructing the agent to compose and run
//                         `save`, and request exactly one continuation. After a
//                         successful save the file is fresh, so the next settle
//                         is clean; a hard cap per session keeps the loop the
//                         docs warn about impossible. (Note: BoundaryContextPreview
//                         .canContinue reads false in headless print mode, yet pi
//                         honors the continuation — verified live 2026-10-30 — so
//                         it must not gate the decision.)
//
// session_shutdown deliberately does nothing: pi fires it only for cleanup,
// after the agent is gone — nothing there can compose an update.
//
// Imports the shared updater directly (the interface story 1.3 exports); the
// path is relative to this file, so the repo root is found wherever pi was
// launched from. Zero dependencies beyond pi itself.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCheck, runMark } from "../../scripts/wherewasi/save.mjs";

const MAX_FORCED_SAVES = 2;

const SAVE_INSTRUCTION =
  "WhereWasI session-end update due: STATUS.md is older than this session's start marker.\n" +
  "Compose this session's update and run exactly:\n" +
  "  node scripts/wherewasi/save.mjs save\n" +
  'with this JSON on stdin: {"standing": "2-3 sentences: what works, what\'s in flight", ' +
  '"openDecisions": ["one line each, still undecided"], ' +
  '"nextAction": "the single next thing", ' +
  '"graduatedDecisions": [{"decision": "...", "why": "..."}], "tool": "pi"}\n' +
  "Decisions resolved this session go in graduatedDecisions; keep STATUS.md within the " +
  "30-line ceiling (AGENTS.md rules 2-4). Then finish.";

export default function wherewasi(pi: ExtensionAPI) {
  let forcedSaves = 0;
  let notifiedGiveUp = false;

  pi.on("session_start", async () => {
    try {
      runMark();
    } catch {
      /* never block startup on state bookkeeping */
    }
  });

  pi.on("agent_before_settle", async (event, ctx) => {
    if (event.outcome !== "completed") return; // aborted/error runs settle as-is
    if (forcedSaves >= MAX_FORCED_SAVES) {
      if (!notifiedGiveUp && ctx.hasUI) {
        notifiedGiveUp = true;
        void ctx.ui.notify("WhereWasI: STATUS.md still stale — save reminder cap reached; update it by hand.", "warning");
      }
      return;
    }

    let stale = false;
    try {
      stale = runCheck({}).stale === true;
    } catch {
      return; // fail open — never trap the session on bookkeeping errors
    }
    if (!stale) return;

    forcedSaves += 1;
    const last = forcedSaves >= MAX_FORCED_SAVES ? "\n(This is the last automatic reminder this session.)" : "";
    return {
      entries: [
        ...event.entries,
        {
          type: "custom_message" as const,
          customType: "wherewasi-save",
          display: true,
          content: SAVE_INSTRUCTION + last,
        },
      ],
      continue: true,
    };
  });
}
