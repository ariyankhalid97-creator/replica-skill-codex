# Repository guidance

- Preserve Replica's clean-room rules, output contracts, `replica/` working directory, and skill boundaries.
- Keep the eleven stage skills authoritative; the `replica` skill only orchestrates them.
- Reuse bundled helpers and templates instead of duplicating their behavior.
- Keep resource references relative, portable, and valid for both plugin and individual-skill installs.
- Do not add dependencies unless existing behavior cannot be preserved without one.
- After changing a skill, run its focused tests, the structural validator, and the full `unittest` suite.
- Update README and tests when installation, invocation, outputs, or behavior changes.
- Preserve the MIT license, original author credit, upstream URL, and recorded source commit.
