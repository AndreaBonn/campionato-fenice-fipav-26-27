**English** | [Italiano](./SECURITY.it.md)

# Security Policy

## Supported Versions

This project has no releases. Security fixes are applied to the latest commit on `main`, which is what GitHub Pages serves.

## Reporting a Vulnerability

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/AndreaBonn/campionato-fenice-fipav-26-27/security/advisories/new), not in a public issue.

Please include:

- a description of the vulnerability
- steps to reproduce
- expected and actual behavior
- the impact: what an attacker could achieve

**Response timeline:**
<!-- TODO: add real response times -->
- Public disclosure is coordinated after the fix is published.

## Security Measures Implemented

The site is static: there are no accounts, no forms, no server-side code and no secrets in the page. The data it shows comes from third parties (FIPAV Online and the WordPress site of the Cagliari committee), so the measures below treat that data as untrusted.

- **Output escaping**: every string coming from the data is escaped (`&`, `<`, `>`, `"`, `'`) before it is put into markup, through one shared helper (`docs/html.js:5`).
- **Link allowlist for notices**: a committee notice is kept only if its link is `https` and its host is in the allowed list (`src/fenice_calendar/notices.py:41`).
- **Poster path validation**: a poster is kept only if its key matches a strict pattern (`src/fenice_calendar/config.py:43`, checked in `src/fenice_calendar/posters.py:19`).
- **Response type check**: a FIPAV answer that is not `application/json` is rejected like a network error (`src/fenice_calendar/fetch.py:38`). Requests have a 30 s timeout and are at least 1 s apart (`src/fenice_calendar/config.py:23`).
- **Schema validation**: `docs/data.json` is validated before it is written; unexpected keys and inconsistent data fail the run (`src/fenice_calendar/schema.py:142`, `src/fenice_calendar/schema.py:279`). A failed run writes no output file.
- **GitHub Actions hardening**: workflow permissions default to `contents: read` and are raised only per job; checkout uses `persist-credentials: false`; third-party actions are pinned to commit SHAs (`.github/workflows/sync.yml`, `.github/workflows/tests.yml`).
- **Locked dependencies**: `uv.lock` is committed and CI installs with `uv sync --frozen`. The sync itself has no runtime dependencies outside the Python standard library.

Not in place: a Content-Security-Policy, automated dependency scanning (Dependabot or similar), and validation of the opponent crest URLs, which are loaded from FIPAV Online as published.

## Out of Scope

- Errors or changes in the data published by FIPAV Online or by the committee: report those to the source.
- Self-XSS that requires the victim to paste code into their own browser console.
- Vulnerabilities in GitHub Pages or GitHub Actions themselves.
- Vulnerabilities in third-party dependencies that are already public: report them to the upstream maintainer.

---

[Back to README](./README.md)
