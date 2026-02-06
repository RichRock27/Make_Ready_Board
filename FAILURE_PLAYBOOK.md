# Failure Playbook - Make_Ready_Board

Generated: 2026-02-06

- Gmail fetch failures (quota/timeouts): verify Gmail API enabled, re-authorize, check search query.
- Drive access errors: verify folder ID, sharing, and Drive API enabled.
- CSV header changes: adjust header detection/mapping logic.
- Properties size limits: keep payloads small, clear old keys.
