---
name: replica
description: >-
  Orchestrates the Replica clean-room app reconstruction workflow by inspecting
  the current project's replica/ artifacts, identifying completed stages, and
  selecting the next replica-* skill. Use when the user asks to start or
  continue the full Replica workflow, asks what stage comes next, or wants a
  status check across Replica artifacts. Use a named replica-* stage directly
  when the user explicitly requests only that stage.
---

# Replica workflow orchestrator

Keep this skill thin. The eleven stage skills are the source of truth for
their workflows, constraints, resources, and output contracts.

## Inspect state

Inspect the current project and its `replica/` directory. Do not infer that a
stage is complete from a filename alone: confirm that its required artifact is
substantive, internally consistent, and usable by the next stage.

Use this order:

1. `$replica-recon`: `replica/recon.md` and `replica/features.csv`
2. `$replica-architect`: `replica/architecture.md` and `replica/schema.sql` or a migration
3. `$replica-design`: `replica/design/tokens.json`, `tokens.css`, and `components.md`
4. `$replica-build`: implemented screens, `replica/build-log.md`, and updated feature rows
5. `$replica-backend`: working services and `replica/backend.md`
6. `$replica-test`: `replica/test-plan.md`, tests, and `replica/bugs.md`
7. `$replica-diff`: `replica/parity.md` and applicable diff artifacts
8. `$replica-entrepreneur`: `replica/feedback.md` and `replica/fixes.md`
9. `$replica-brand`: `replica/brand.md`, `replica/brand.json`, and a clean sweep
10. `$replica-launch`: completed `replica/launch/` artifacts
11. `$replica-deploy`: passed preflight and `replica/deploy.md`

## Route the request

- If the user names a stage, load and follow that stage's `SKILL.md`.
- Otherwise choose the first incomplete stage whose prerequisites exist.
- If a prerequisite is missing, name the missing artifact and route to the
  stage that creates it. Do not invent prerequisite content.
- Report completed stages and the selected next stage briefly before acting.
- Preserve every clean-room, authorization, and deployment gate in the stage
  skills. Never treat orchestration as permission to weaken them.

For a full run, continue stage by stage only while the user's request covers
the work and required inputs are available. Stop at genuine user decisions,
credentials, purchases, production deployment approval, or legal review.
