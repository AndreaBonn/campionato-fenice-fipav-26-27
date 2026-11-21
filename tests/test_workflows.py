import re
from pathlib import Path

import pytest

WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/sync.yml"


@pytest.mark.parametrize("workflow", [WORKFLOW, WORKFLOW.with_name("tests.yml")])
def test_actions_are_pinned_to_full_commit_shas(workflow: Path) -> None:
    content = workflow.read_text()
    actions = re.findall(r"(?m)^\s*(?:-\s*)?uses:\s*(\S+)", content)
    assert actions
    assert all(re.fullmatch(r"[^@\s]+@[0-9a-f]{40}", action) for action in actions)


@pytest.mark.parametrize("workflow", [WORKFLOW, WORKFLOW.with_name("tests.yml")])
def test_each_checkout_disables_persisted_credentials(workflow: Path) -> None:
    content = workflow.read_text()
    checkouts = re.findall(
        r"(?ms)^\s*- uses: actions/checkout@[^\n]+\n(.*?)(?=^\s*- |^  [a-z][\w-]*:|\Z)",
        content,
    )
    assert checkouts
    assert all(re.search(r"(?m)^\s+persist-credentials:\s*false\s*$", step) for step in checkouts)


def test_schedule_has_exactly_one_four_hour_cron() -> None:
    content = WORKFLOW.read_text()
    assert re.findall(r"(?m)^\s*-\s*cron:\s*['\"]([^'\"]+)['\"]", content) == ["17 */4 * * *"]
    assert len(re.findall(r"(?m)^\s*-\s*cron:", content)) == 1


def test_workflow_permissions_grant_contents_read() -> None:
    content = WORKFLOW.read_text()
    assert re.search(r"(?m)^permissions:\s*\n  contents:\s*read\s*$", content)


def test_deploy_depends_on_sync() -> None:
    content = WORKFLOW.read_text()
    assert re.search(r"(?m)^  deploy:\s*\n    needs:\s*sync\s*$", content)


def test_data_commit_rebases_before_push() -> None:
    content = WORKFLOW.read_text()
    assert re.search(r"git commit[^\n]*\n\s*git pull --rebase[^\n]*\n\s*git push", content)


def test_activity_report_is_removed_before_the_pages_upload() -> None:
    content = WORKFLOW.read_text()
    removal = content.find("rm -f docs/REPORT_ATTIVITA.md")
    upload = content.find("actions/upload-pages-artifact")
    assert removal != -1, "the development report would be published on GitHub Pages"
    assert removal < upload


def test_service_worker_is_stamped_after_the_data_commit_and_before_the_upload() -> None:
    content = WORKFLOW.read_text()
    commit = content.find("git push")
    stamp = content.find("uv run fenice-stamp-sw")
    upload = content.find("actions/upload-pages-artifact")
    assert stamp != -1, "sw.js would ship with the dev version and never update"
    assert commit < stamp < upload
