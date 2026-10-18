import json
import os
import unittest

from _load import ROOT
from validate_package import EXPECTED_SKILLS, validate


class Repo(unittest.TestCase):
    def test_package_validation(self):
        self.assertEqual(validate(ROOT), [])

    def test_portable_and_codex_manifests_agree(self):
        with open(os.path.join(ROOT, "plugin.json"), encoding="utf-8") as fh:
            portable = json.load(fh)
        with open(os.path.join(ROOT, ".codex-plugin", "plugin.json"),
                  encoding="utf-8") as fh:
            codex = json.load(fh)
        for field in ("name", "version", "description", "license"):
            self.assertEqual(portable[field], codex[field], field)
        self.assertEqual(codex["skills"], "./skills/")

    def test_readme_documents_every_skill_and_required_sections(self):
        with open(os.path.join(ROOT, "README.md"), encoding="utf-8") as fh:
            readme = fh.read()
        for skill in EXPECTED_SKILLS:
            self.assertIn("$" + skill, readme)
        for heading in (
            "## What Replica does", "## Skills", "## Workflow",
            "## Requirements", "## Install as a Codex/OpenAI plugin",
            "## Install individual skills", "## Repo-local installation",
            "## Invocation examples", "## Example full workflow",
            "## Updating", "## Uninstalling", "## Development",
            "## Running tests", "## Upstream attribution", "## License",
        ):
            self.assertIn(heading, readme)

    def test_trigger_and_handoff_contracts(self):
        def read(skill):
            with open(os.path.join(ROOT, "skills", skill, "SKILL.md"),
                      encoding="utf-8") as fh:
                return fh.read()

        recon = read("replica-recon")
        self.assertIn("I want to build my own version", recon)
        architect = read("replica-architect")
        self.assertIn("replica/recon.md", architect)
        self.assertIn("If there is no recon map, stop", architect)
        self.assertIn("$replica-recon", architect)
        orchestrator = read("replica")
        self.assertIn("Do not invent prerequisite content", orchestrator)

    def test_no_em_dashes_anywhere(self):
        bad = []
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames if d not in (".git", "__pycache__")]
            for filename in filenames:
                if filename.endswith((".md", ".py", ".json", ".ts", ".csv")):
                    path = os.path.join(dirpath, filename)
                    with open(path, encoding="utf-8") as fh:
                        if chr(0x2014) in fh.read():
                            bad.append(os.path.relpath(path, ROOT))
        self.assertEqual(bad, [])


if __name__ == "__main__":
    unittest.main()
