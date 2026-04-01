# XAPI Migration Design

**Context:** The project currently fetches X/Twitter data through RapidAPI-specific headers and endpoints inside the `scripts/` directory. The new deployment target is Railway, and credentials will be supplied through the `XAPI_API_KEY` environment variable.

**Goal:** Replace the existing RapidAPI-based Twitter integration with `xapi.to` while keeping the current crawler workflows intact.

**Approved Approach:**
- Introduce a shared `xapi` client module for all crawler scripts.
- Read credentials only from `XAPI_API_KEY`.
- Execute `xapi-to` through Node so scripts remain portable across local Windows development and Railway deployment.
- Normalize `xapi` profile and following responses into the shapes the current crawler already expects.
- Keep the rest of the ranking, filtering, and graph generation logic unchanged.

**Key Decisions:**
- Do not commit or hardcode secrets in repository files.
- Keep script entrypoints stable so existing workflows continue to work.
- Add lightweight Node built-in tests around the new shared client before changing production scripts.

**Risks And Mitigations:**
- `xapi` uses different response shapes than RapidAPI.
  Mitigation: centralize parsing and normalization in one helper module.
- Following data is paginated.
  Mitigation: add pagination support in the shared client and let scripts request a bounded number of pages.
- Windows shell quoting is fragile for JSON CLI arguments.
  Mitigation: execute the CLI via Node child process APIs instead of shell-built command strings.
