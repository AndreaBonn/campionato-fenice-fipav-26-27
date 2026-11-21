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


def test_badge_json_is_produced_only_by_fenice_badges() -> None:
    content = WORKFLOW.with_name("tests.yml").read_text()
    assert "uv run fenice-badges" in content
    assert "schemaVersion" not in content


def test_badges_are_built_even_when_uv_cannot_start() -> None:
    # badges.py is stdlib only: the runner's python can build the error badge when uv sync failed
    content = WORKFLOW.with_name("tests.yml").read_text()
    build = content[content.find("uv run fenice-badges") : content.find("- name: Publish badge files")]
    assert "|| python3 src/fenice_calendar/badges.py" in build


def test_python_and_js_tests_run_before_the_sync() -> None:
    content = WORKFLOW.read_text()
    pytest_run = content.find("run: uv run pytest")
    js_run = content.find("run: npm test")
    sync = content.find("run: uv run fenice-sync")
    assert -1 not in (pytest_run, js_run, sync)
    assert pytest_run < sync
    assert js_run < sync


def test_data_commit_happens_only_when_generated_files_changed() -> None:
    content = WORKFLOW.read_text()
    guard = re.search(
        r"if \[ -z \"\$\(git status --porcelain -- docs/data\.json docs/calendario\.ics\)\" \]; "
        r"then\n(?P<body>(?:.*\n)*?)\s*fi\n",
        content,
    )
    assert guard, "the commit step must bail out when data.json and calendario.ics are unchanged"
    assert "exit 0" in guard["body"]
    assert guard.end() <= content.find("git commit -m")
