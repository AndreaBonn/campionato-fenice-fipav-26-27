import re
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/sync.yml"


def test_actions_are_pinned_to_full_commit_shas() -> None:
    content = WORKFLOW.read_text()
    actions = re.findall(r"(?m)^\s*(?:-\s*)?uses:\s*(\S+)", content)
    assert actions
    assert all(re.fullmatch(r"[^@\s]+@[0-9a-f]{40}", action) for action in actions)


def test_each_checkout_disables_persisted_credentials() -> None:
    content = WORKFLOW.read_text()
    checkouts = re.findall(
        r"(?ms)^\s*- uses: actions/checkout@[^\n]+\n(.*?)(?=^\s*- |^  [a-z][\w-]*:|\Z)",
        content,
    )
    assert checkouts
    assert all(re.search(r"(?m)^\s+persist-credentials:\s*false\s*$", step) for step in checkouts)


def test_schedule_has_exactly_one_four_hour_cron() -> None:
    content = WORKFLOW.read_text()
    assert re.findall(r"(?m)^\s*-\s*cron:\s*['\"]([^'\"]+)['\"]", content) == [
        "17 */4 * * *"
    ]
    assert len(re.findall(r"(?m)^\s*-\s*cron:", content)) == 1


def test_workflow_permissions_grant_contents_read() -> None:
    content = WORKFLOW.read_text()
    assert re.search(r"(?m)^permissions:\s*\n  contents:\s*read\s*$", content)


def test_deploy_depends_on_sync() -> None:
    content = WORKFLOW.read_text()
    assert re.search(r"(?m)^  deploy:\s*\n    needs:\s*sync\s*$", content)
