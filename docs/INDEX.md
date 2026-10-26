# StackDoctor: Project Index

**What:** Open-source developer environment diagnostics and repair platform.
**Tagline:** Find the cause. Fix the environment. Ship the code.
**Workflow:** No manual coding. Each phase is built in Antigravity from a prompt in `PHASES.md`. Every run is recorded in `LOG.md`.
**Stack:** React, TypeScript, Node.js, Express, MongoDB (npm workspaces monorepo).
**Golden rule:** Diagnose first. Evidence over guesses. No dangerous change without permission.

## Files

| File | Purpose |
|---|---|
| `INDEX.md` | This map and the current status |
| `PHASES.md` | Master context block + one prompt per phase (paste into Antigravity) |
| `LOG.md` | Single running log of everything done, in order |

## Phase status

| # | Phase | Deliverable | Status |
|---|---|---|---|
| 1 | Foundation | CLI runs locally and outputs a valid report | Done |
| 2 | Diagnostic engine | Reliable CLI that explains common failures | Done |
| 3 | Web platform | Dashboard + API + optional report upload | Not started |
| 4 | Integrations | GitHub issue drafts, CI JSON, report compare | Not started |
| 5 | Optional AI | Evidence-grounded explanations | Not started |
| 6 | Open-source launch | Docs, license, security policy, release | Not started |

Status values: Not started, In progress, Needs fixes, Done.

## How we work (each phase)

1. Copy the **Master Context** and the phase prompt from `PHASES.md` into Antigravity.
2. Run it. Review what it built.
3. Run the phase's **Verification checklist**.
4. Bring the result (or errors) back to Claude. We fix, then add an entry to `LOG.md`.
5. Update the status table above. Move to the next phase only when the checklist passes.

## Key decisions (do not change without a log entry)

- CLI first. The local engine must never depend on the backend or AI.
- Reports separate **observed evidence** from **hypotheses**.
- Secret values are never printed, stored, or uploaded. Only variable names.
- Upload is opt-in, with a preview first. Local-only is the default.
- Fixes are suggestions until the user approves. No auto-kill, auto-install, or auto-delete.
- No shell strings built from input. Fixed executables + argument arrays.
