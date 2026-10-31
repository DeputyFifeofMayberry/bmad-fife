#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""fife-close-out: archive scrapped work and record events in one CHANGELOG.

Verbs:
  scrap <folder> --reason "..."   move folder to _archive/<year>/, write REASON.md, log
  done  <folder> --summary "..."  log a completion (folder stays in place)
  note  --text "..."              log an arbitrary event line

All paths must live under the output folder (--output). Nothing is ever
deleted; scrapping moves within the output folder only.
"""

import argparse
import sys
from datetime import date
from pathlib import Path


def changelog_path(output: Path) -> Path:
    return output / "CHANGELOG.md"


def append_log(output: Path, kind: str, name: str, text: str) -> Path:
    log = changelog_path(output)
    line = f"- {date.today().isoformat()} · {kind} · {name} · {text}\n"
    existed = log.exists()
    if existed:
        content = log.read_text(encoding="utf-8")
        if not content.endswith("\n"):
            content += "\n"
            log.write_text(content, encoding="utf-8")
    with log.open("a", encoding="utf-8") as fh:
        if not existed:
            fh.write("# Changelog\n\nOne line per event. Append-only — never reorder or rewrite.\n\n")
        fh.write(line)
    return log


def under(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def cmd_scrap(args, output: Path) -> int:
    src = Path(args.folder)
    if not src.is_dir():
        print(f"error: not a folder: {src}", file=sys.stderr)
        return 1
    if not under(src, output):
        print(f"error: {src} is not under the output folder ({output})", file=sys.stderr)
        return 1
    if (src / ".git").exists():
        print("error: refusing to move a folder that contains .git", file=sys.stderr)
        return 1
    dest_dir = output / "_archive" / str(date.today().year)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    if dest.exists():
        print(f"error: destination already exists: {dest}", file=sys.stderr)
        return 1
    (dest_dir / src.name)
    src.rename(dest)
    reason = dest / "REASON.md"
    reason.write_text(
        f"# Scrapped {date.today().isoformat()}\n\n{args.reason}\n",
        encoding="utf-8",
    )
    append_log(output, "scrapped", src.name, f"{args.reason} (moved to _archive/{date.today().year}/{src.name})")
    print(f"moved: {src}")
    print(f"  to: {dest}")
    print(f"reason: {reason}")
    print(f"log: {changelog_path(output)}")
    return 0


def cmd_done(args, output: Path) -> int:
    target = Path(args.folder)
    name = target.name if target.exists() else target
    append_log(output, "closed", name, args.summary)
    print(f"log: {changelog_path(output)}")
    return 0


def cmd_note(args, output: Path) -> int:
    append_log(output, "note", "—", args.text)
    print(f"log: {changelog_path(output)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="close_out.py", description=__doc__)
    parser.add_argument("--output", required=True, help="the BMad output folder")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_scrap = sub.add_parser("scrap", help="move a folder to _archive and log it")
    p_scrap.add_argument("folder")
    p_scrap.add_argument("--reason", required=True)

    p_done = sub.add_parser("done", help="log a completion; the folder stays in place")
    p_done.add_argument("folder")
    p_done.add_argument("--summary", required=True)

    p_note = sub.add_parser("note", help="log an arbitrary event")
    p_note.add_argument("--text", required=True)

    args = parser.parse_args()
    output = Path(args.output)
    if not output.is_dir():
        print(f"error: output folder does not exist: {output}", file=sys.stderr)
        return 1
    return {"scrap": cmd_scrap, "done": cmd_done, "note": cmd_note}[args.cmd](args, output)


if __name__ == "__main__":
    sys.exit(main())
