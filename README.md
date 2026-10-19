# Replica for Codex

Replica for Codex is a Codex/OpenAI port of Jake Schincariol's
[Replica Skill](https://github.com/Jakeschincariol/replica-skill). The original
project and this port are distributed under the MIT License. This port keeps
the upstream clean-room methodology and eleven-stage workflow while adopting
the current portable Agent Plugins layout, Codex skill invocation, portable
resource paths, and Codex-native tests and installation guidance.

Port version: **1.0.0**

Upstream baseline: **`77c9436fb3d18c3d58169efb8caf4fe906b0dc51`**

## What Replica does

Replica helps you study an application using public information and the
user's authorized access, then build an original implementation of its
functionality and workflows. It maps screens and flows, plans the system,
builds and tests the implementation, measures parity, finds product gaps,
creates a distinct brand, prepares a launch, and gates production deployment.

It does not copy proprietary source code, private APIs, copyrighted assets,
logos, commercial copy, credentials, accounts, or paywalled material. It does
not bypass access controls. Reference screenshots stay in the private
`replica/` planning directory and are never shipped.

## Skills

| Skill | Purpose |
| --- | --- |
| `$replica` | Inspects existing artifacts and routes to the next stage. |
| `$replica-recon` | Maps screens, flows, components, data, and features. |
| `$replica-architect` | Plans the stack, schema, API, risks, and build order. |
| `$replica-design` | Creates tokens, component specs, and accessible primitives. |
| `$replica-build` | Builds the app screen by screen from the specifications. |
| `$replica-backend` | Adds auth, data, payments, email, jobs, and integrations. |
| `$replica-test` | Creates and runs flow-based QA and records reproducible bugs. |
| `$replica-diff` | Scores feature parity and compares screenshot layout. |
| `$replica-entrepreneur` | Ranks real user complaints and turns them into a product angle. |
| `$replica-brand` | Creates a distinct name, palette, voice, and rebrand sweep. |
| `$replica-launch` | Produces landing, pricing, store listing, and launch plans. |
| `$replica-deploy` | Runs the release gate and guides an authorized deployment. |

The umbrella skill is orchestration only. The eleven stage skills remain the
source of truth.

## Workflow

```text
recon -> architect -> design -> build -> backend -> test -> diff
      -> entrepreneur -> brand -> launch -> deploy
```

Each stage reads the previous artifacts and writes into the user's project:

```text
replica/recon.md
replica/features.csv
replica/architecture.md
replica/schema.sql
replica/design/
replica/build-log.md
replica/backend.md
replica/test-plan.md
replica/bugs.md
replica/parity.md
replica/fixes.md
replica/brand.md
replica/brand.json
replica/launch/
replica/deploy.md
```

## Requirements

- A current Codex client for plugin installation or local skill discovery.
- Python 3.8 or newer for the six bundled helpers. They use only the standard
  library; there is nothing to install with pip.
- Project-specific tools selected during architecture, such as Node.js and
  Playwright, only when the generated application needs them.
- The user's own accounts and API keys for optional third-party services.

No MCP server is bundled or required.

## Install as a Codex/OpenAI plugin

The repository is a portable Agent Plugin with a root `plugin.json`, plus a
`.codex-plugin/plugin.json` compatibility manifest. After publication, add its
Git marketplace and install the plugin:

```bash
codex plugin marketplace add ariyankhalid97-creator/replica-skill-codex --ref main
codex plugin add replica-skill-codex@replica-skill-codex
```

Restart the ChatGPT desktop app if the plugin does not appear immediately.
These commands follow OpenAI's current
[plugin packaging and marketplace guidance](https://developers.openai.com/plugins/build/plugins).

For local development from the repository root:

```bash
codex plugin marketplace add .
codex plugin add replica-skill-codex@replica-skill-codex
```

## Install individual skills

OpenAI currently discovers repo skills under `.agents/skills` and user skills
under `$HOME/.agents/skills`; explicit Codex invocation uses `$skill-name`.
See [Build skills](https://developers.openai.com/codex/skills).

macOS/Linux user installation:

```bash
git clone https://github.com/ariyankhalid97-creator/replica-skill-codex.git
mkdir -p "$HOME/.agents/skills"
cp -R replica-skill-codex/skills/replica-* "$HOME/.agents/skills/"
cp -R replica-skill-codex/skills/replica "$HOME/.agents/skills/"
```

Windows PowerShell user installation:

```powershell
git clone https://github.com/ariyankhalid97-creator/replica-skill-codex.git
New-Item -ItemType Directory -Force "$HOME\.agents\skills" | Out-Null
Copy-Item -Recurse .\replica-skill-codex\skills\replica-* "$HOME\.agents\skills\"
Copy-Item -Recurse .\replica-skill-codex\skills\replica "$HOME\.agents\skills\"
```

To install only one skill, copy only that skill folder. Keep its bundled
scripts and templates with `SKILL.md`.

## Repo-local installation

Copy the desired skill folders into `<project>/.agents/skills/`. Codex scans
that directory from the working directory up to the repository root. For the
full pack, copy all folders under this repository's `skills/` directory.

## Invocation examples

Recon:

```text
$replica-recon I want to build my own version of https://example.com.
Analyze the public web app first. Focus on the core scheduling flow for small teams.
```

Architecture continuation:

```text
$replica-architect Continue from replica/recon.md and replica/features.csv.
Plan the smallest production-ready stack, schema, API, risks, and vertical slice.
```

Full workflow with automatic stage selection:

```text
$replica Inspect the current project and replica/ artifacts, report completed
stages, then continue with the next valid Replica stage.
```

## Example full workflow

Start with `$replica-recon` and the target's public URL. It creates stable
screen and flow IDs plus the feature matrix. Continue with
`$replica-architect`, then `$replica-design`. `$replica-build` implements the
vertical slice and remaining screens; `$replica-backend` replaces fake data
with authorized services. `$replica-test` and `$replica-diff` establish
quality and parity. `$replica-entrepreneur` uses real, linked public feedback
to choose improvements. `$replica-brand` removes the original identity,
`$replica-launch` prepares the market-facing artifacts, and `$replica-deploy`
requires a passing preflight and explicit user approval before production.

## Tools

All helper commands run from this repository root in both Windows PowerShell
and POSIX shells when `python` resolves to Python 3. Use `python3` instead on
systems where that is the Python 3 command.

```bash
python skills/replica-diff/imgdiff.py original.png clone.png --out diff.png
python skills/replica-diff/parity.py replica/features.csv
python skills/replica-entrepreneur/reviews.py replica/reviews.csv
python skills/replica-design/contrast.py replica/design/tokens.json
python skills/replica-brand/sweep.py . --avoid "Original App"
python skills/replica-launch/listing.py replica/launch/listing.json
```

The helpers do not access the network.

## Updating

Plugin install:

```bash
codex plugin marketplace upgrade replica-skill-codex
```

Direct clone: run `git pull --ff-only`, then recopy the installed skill
folders. Review third-party skill updates before enabling them.

## Uninstalling

```bash
codex plugin remove replica-skill-codex@replica-skill-codex
codex plugin marketplace remove replica-skill-codex
```

For individual installs, delete only the copied `replica` and `replica-*`
folders from the relevant `.agents/skills` directory.

## Development

Keep stage behavior, output paths, and clean-room restrictions compatible
with upstream. The root `AGENTS.md` contains maintenance rules. When syncing
future upstream changes:

1. `git fetch upstream`
2. Review changes after the recorded upstream commit.
3. Merge, rebase, or cherry-pick the intended upstream work without changing
   the `upstream` remote.
4. Repeat the Codex compatibility and provider-reference audit.
5. Run focused tests, validators, and the full suite.
6. Update the port version, changelog, and recorded upstream commit.

### PrivateParse desktop app

`desktop-app/` is a separate, local-only product app generated from the
Replica workflow artifacts in `replica/`. It is not part of the eleven-skill
plugin runtime. To run or build the shareable Windows executable:

```bash
cd desktop-app
npm install
npm test
npm run dist
```

The current build opens PDFs, shows thumbnails, organizes pages with undo and
crash recovery, runs bundled offline OCR, fills AcroForms, captures available
document fonts, blocks unsafe font substitutions, checks for unexpected visual
changes, extracts reviewed tables to CSV, places drawn or imported signatures,
and supports a GitHub Releases update channel without uploading document bytes. See
`desktop-app/README.md` for limitations and testing guidance.

## Running tests

```bash
python -m unittest discover -s tests -v
python tests/validate_package.py
```

The package validator checks skill structure and frontmatter, manifests,
bundled references, Python and JSON syntax, duplicate names, provider-specific
references, and the workflow handoff contract. Development also runs
`skill-creator/scripts/quick_validate.py` against every skill and a local
Codex marketplace discovery smoke test when the installed CLI supports it.

## Upstream attribution

Original project: **Replica Skill** by **Jake Schincariol**

Upstream: <https://github.com/Jakeschincariol/replica-skill>

Upstream source commit: `77c9436fb3d18c3d58169efb8caf4fe906b0dc51`

This repository is a Codex/OpenAI compatibility port. It does not claim
authorship of the original project.

## License

MIT. The original copyright notice and license are preserved in `LICENSE`.
