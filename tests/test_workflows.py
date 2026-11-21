import re
from pathlib import Path

import pytest

WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/sync.yml"
STEPS_KEY = re.compile(r"^(\s*)steps:\s*$")


def parse_steps(content: str) -> list[list[str]]:
    """Step bodies of every `steps:` list (comments dropped), one list per job."""
    jobs: list[list[str]] = []
    steps: list[str] | None = None
    base = step_indent = 0
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        if steps is not None and indent <= base:
            steps = None
        if steps is None:
            match = STEPS_KEY.match(line)
            if match:
                steps, base, step_indent = [], indent, -1
                jobs.append(steps)
            continue
        if step_indent == -1:
            step_indent = indent
        if indent == step_indent and stripped.startswith("- "):
            steps.append(line)
        else:
            steps[-1] += "\n" + line
    return jobs


def step_index(steps: list[str], needle: str) -> int:
    matches = [i for i, step in enumerate(steps) if needle in step]
    assert len(matches) == 1, f"{needle!r} must appear in exactly one step, found {matches}"
    return matches[0]


def test_parse_steps_splits_steps_whatever_their_first_key() -> None:
    content = (
        "jobs:\n"
        "  a:\n"
        "    steps:\n"
        "      # a comment\n"
        "      - name: Checkout\n"
        "        uses: actions/checkout@abc\n"
        "      - run: echo hi\n"
        "  b:\n"
        "    steps:\n"
        "      - uses: x/y@z\n"
    )

    assert parse_steps(content) == [
        ["      - name: Checkout\n        uses: actions/checkout@abc", "      - run: echo hi"],
        ["      - uses: x/y@z"],
    ]


@pytest.mark.parametrize("workflow", [WORKFLOW, WORKFLOW.with_name("tests.yml")])
def test_actions_are_pinned_to_full_commit_shas(workflow: Path) -> None:
    content = workflow.read_text()
    actions = re.findall(r"(?m)^\s*(?:-\s*)?uses:\s*(\S+)", content)
    assert actions
    assert all(re.fullmatch(r"[^@\s]+@[0-9a-f]{40}", action) for action in actions)


@pytest.mark.parametrize("workflow", [WORKFLOW, WORKFLOW.with_name("tests.yml")])
def test_each_checkout_disables_persisted_credentials(workflow: Path) -> None:
    all_steps = [step for job in parse_steps(workflow.read_text()) for step in job]
    checkouts = [step for step in all_steps if re.search(r"uses:\s*actions/checkout@", step)]
    assert checkouts
    assert all(re.search(r"(?m)^\s+persist-credentials:\s*false\s*$", step) for step in checkouts)


def test_checkout_written_after_a_name_key_is_still_found_and_checked() -> None:
    named = "jobs:\n  j:\n    steps:\n      - name: X\n        uses: actions/checkout@abc\n"

    steps = parse_steps(named)[0]

    assert [bool(re.search(r"uses:\s*actions/checkout@", s)) for s in steps] == [True]
    assert not re.search(r"persist-credentials:\s*false", steps[0])


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
    steps = parse_steps(WORKFLOW.read_text())[0]
    removal = step_index(steps, "rm -f docs/REPORT_ATTIVITA.md")
    upload = step_index(steps, "actions/upload-pages-artifact")
    assert removal < upload


def test_service_worker_is_stamped_after_the_data_commit_and_before_the_upload() -> None:
    steps = parse_steps(WORKFLOW.read_text())[0]
    commit = step_index(steps, "git push")
    stamp = step_index(steps, "uv run fenice-stamp-sw")
    upload = step_index(steps, "actions/upload-pages-artifact")
    assert commit < stamp < upload


def test_badge_json_is_produced_only_by_fenice_badges() -> None:
    content = WORKFLOW.with_name("tests.yml").read_text()
    assert "uv run fenice-badges" in content
    assert "schemaVersion" not in content


def test_badges_are_built_even_when_uv_cannot_start() -> None:
    # badges.py is stdlib only: the runner's python can build the error badge when uv sync failed
    content = WORKFLOW.with_name("tests.yml").read_text()
    start = content.find("uv run fenice-badges")
    build = content[start : content.find("- name: Publish badge files")]
    assert "|| python3 src/fenice_calendar/badges.py" in build


def test_python_and_js_tests_run_before_the_sync() -> None:
    steps = parse_steps(WORKFLOW.read_text())[0]
    pytest_run = step_index(steps, "run: uv run pytest")
    js_run = step_index(steps, "run: npm test")
    sync = step_index(steps, "run: uv run fenice-sync")
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
