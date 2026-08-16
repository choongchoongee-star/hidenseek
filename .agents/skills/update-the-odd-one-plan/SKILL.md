---
name: update-the-odd-one-plan
description: Keep THE ODD ONE's canonical `theoddone.md` design document synchronized with the game and Git history. Use for any request that changes or discusses game rules, mechanics, balance values, NPC behavior, controls, camera, game flow, UI, audio, visual direction, technical architecture, scope, priorities, implementation status, deployment, or documentation in the hidenseek repository.
---

# Update The Odd One Plan

Treat the repository-root `theoddone.md` as the single source of truth for the product plan. Keep it accurate in the same change that modifies the game.

## Workflow

1. Find the repository root and read `theoddone.md` completely before planning the change.
2. Inspect the relevant implementation and configuration files. Do not rely on the plan alone when reporting current behavior.
3. Classify the request:
   - For a design-only decision, update `theoddone.md` and label unimplemented items as proposed, planned, or unimplemented.
   - For an implementation change, modify the code and update every affected section of `theoddone.md` in the same task.
   - For a status or review request, compare the document with the code and report discrepancies. Fix them only when the user requests changes.
4. Preserve `theoddone.md` as the sole canonical plan. Do not create a second specification containing overlapping product truth.
5. Update the document metadata for meaningful changes:
   - Set `최종 갱신일` to the current date.
   - Increment the version: patch for clarifications and fixes, minor for compatible features or rule changes, major for a fundamental redesign.
   - Add one concise row to `변경 이력` describing the result.
6. Verify the result in proportion to the change. For implementation changes, run `npm run build` at minimum and test affected gameplay when practical.
7. Review `git diff` to confirm the code and plan tell the same story.
8. Follow the repository Markdown policy: stage every created or modified `.md` file with `git add`; use `git rm` or `git mv` for Markdown deletion or movement.
9. Unless the user explicitly requests local-only work or asks not to commit, include the implementation and `theoddone.md` in the same focused commit and push it to the tracked GitHub branch after verification.

## Reconciliation Rules

- The user's latest explicit decision overrides earlier text and current code.
- Current code is evidence of implemented behavior, not authority for desired behavior.
- Never mark a feature implemented without confirming it in the code or a completed change.
- Keep exact numbers, controls, rule names, URLs, and statuses consistent across all affected sections.
- Record current truth, not a transcript of discussion. Keep rejected ideas out of the main specification.
- Preserve unrelated user changes in both code and documentation.

## Completion Check

Before finishing, confirm that:

- `theoddone.md` reflects the requested decision and actual implementation state.
- Proposed and implemented work are clearly distinguished.
- Version, date, and change history are current when the plan changed.
- Required validation passed.
- All changed Markdown files are staged.
- The commit and push completed when required by the workflow.
