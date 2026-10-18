"""Validate the portable Replica skill package without modifying it."""

import ast
import json
import os
import re
import sys
from pathlib import Path


EXPECTED_STAGES = [
    "replica-recon", "replica-architect", "replica-design", "replica-build",
    "replica-backend", "replica-test", "replica-diff", "replica-entrepreneur",
    "replica-brand", "replica-launch", "replica-deploy",
]
EXPECTED_SKILLS = ["replica"] + EXPECTED_STAGES
RESOURCES = {
    "replica-recon": {"recon-map.md", "features.csv"},
    "replica-architect": {"architecture.md"},
    "replica-design": {"tokens.json", "contrast.py"},
    "replica-test": {"test-plan.md", "bug-report.md", "e2e.example.spec.ts"},
    "replica-diff": {"imgdiff.py", "parity.py"},
    "replica-entrepreneur": {"reviews.py", "themes.json"},
    "replica-brand": {"sweep.py"},
    "replica-launch": {"listing.py", "listing.example.json"},
    "replica-deploy": {"preflight.md"},
}
LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.S)


def parse_frontmatter(path):
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER.match(text)
    if not match:
        raise ValueError("missing YAML frontmatter")
    raw = match.group(1)
    if "\t" in raw:
        raise ValueError("tabs are not valid indentation")
    try:
        import yaml
    except ImportError:
        yaml = None
    if yaml is not None:
        data = yaml.safe_load(raw)
        if not isinstance(data, dict):
            raise ValueError("frontmatter is not a mapping")
        return data, text
    name = re.search(r"(?m)^name:\s*['\"]?([^'\"\r\n]+)", raw)
    desc = re.search(r"(?ms)^description:\s*(?:>-?\s*\n((?:[ ]+.*\n?)+)|([^\r\n]+))", raw)
    if not name or not desc:
        raise ValueError("frontmatter needs name and description")
    value = desc.group(1) or desc.group(2)
    return {"name": name.group(1).strip(), "description": " ".join(value.split())}, text


def local_markdown_links(path, text):
    for match in LINK.finditer(text):
        target = match.group(1).strip().strip("<>").split("#", 1)[0]
        if not target or "://" in target or target.startswith(("#", "mailto:")):
            continue
        yield target


def validate(root):
    root = Path(root)
    errors = []
    skills_root = root / "skills"
    found = sorted(p.name for p in skills_root.iterdir() if p.is_dir())
    if found != sorted(EXPECTED_SKILLS):
        errors.append("skill directories: expected %r, found %r" %
                      (sorted(EXPECTED_SKILLS), found))

    names = []
    for skill in EXPECTED_SKILLS:
        folder = skills_root / skill
        manifests = [p for p in folder.rglob("*")
                     if p.is_file() and p.name.lower() == "skill.md"] if folder.exists() else []
        if len(manifests) != 1:
            errors.append("%s: expected exactly one SKILL.md, found %d" %
                          (skill, len(manifests)))
            continue
        try:
            data, text = parse_frontmatter(manifests[0])
        except Exception as exc:
            errors.append("%s: %s" % (skill, exc))
            continue
        name = data.get("name")
        description = data.get("description")
        names.append(name)
        if name != skill:
            errors.append("%s: frontmatter name is %r" % (skill, name))
        if not isinstance(description, str) or len(description.strip()) < 40:
            errors.append("%s: description is missing or too thin" % skill)
        for target in local_markdown_links(manifests[0], text):
            if not (manifests[0].parent / target).exists():
                errors.append("%s: broken Markdown link %s" % (skill, target))
        for resource in RESOURCES.get(skill, set()):
            if not (folder / resource).is_file():
                errors.append("%s: missing resource %s" % (skill, resource))
    if len(names) != len(set(names)):
        errors.append("duplicate skill names: %r" % names)

    for path in root.rglob("*.json"):
        if ".git" in path.parts:
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append("%s: invalid JSON: %s" % (path.relative_to(root), exc))
    for path in root.rglob("*.py"):
        if ".git" in path.parts or "__pycache__" in path.parts:
            continue
        try:
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append("%s: invalid Python: %s" % (path.relative_to(root), exc))

    try:
        portable = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
        if portable.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json":
            errors.append("plugin.json: unexpected schema")
        for key in ("name", "version", "description"):
            if not portable.get(key):
                errors.append("plugin.json: missing %s" % key)
        if "mcpServers" in portable or (root / "mcp.json").exists():
            errors.append("skills-only package must not declare an MCP server")
    except Exception as exc:
        errors.append("plugin.json: %s" % exc)

    try:
        codex = json.loads((root / ".codex-plugin" / "plugin.json").read_text(
            encoding="utf-8"))
        if codex.get("skills") != "./skills/":
            errors.append("Codex manifest must point skills at ./skills/")
    except Exception as exc:
        errors.append(".codex-plugin/plugin.json: %s" % exc)

    try:
        market = json.loads((root / ".agents" / "plugins" / "marketplace.json").read_text(
            encoding="utf-8"))
        entry = market["plugins"][0]
        if entry["name"] != "replica-skill-codex" or entry["source"]["path"] != "./":
            errors.append("marketplace entry does not resolve to the plugin root")
    except Exception as exc:
        errors.append(".agents/plugins/marketplace.json: %s" % exc)

    provider_name = ("cla" + "ude").lower()
    old_invocation = re.compile(r"(?:after|before|run|next:)\s+`?/replica-", re.I)
    for path in root.rglob("*"):
        if not path.is_file() or ".git" in path.parts or "__pycache__" in path.parts:
            continue
        if path.suffix.lower() not in {".md", ".json", ".py", ".csv", ".ts"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if provider_name in text.lower():
            errors.append("%s: provider-specific operational reference remains" %
                          path.relative_to(root))
        if old_invocation.search(text):
            errors.append("%s: slash-command invocation remains" % path.relative_to(root))
    return errors


def main():
    root = Path(__file__).resolve().parents[1]
    errors = validate(root)
    if errors:
        for error in errors:
            print("ERROR: " + error)
        return 1
    print("Package validation passed: %d skills, manifests, resources, paths, and syntax."
          % len(EXPECTED_SKILLS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
