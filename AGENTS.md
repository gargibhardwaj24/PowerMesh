# Engineering Rules

- Read surrounding code before editing and keep diffs reviewable.
- Keep TypeScript strict; no `any` or swallowed I/O failures.
- Validate every external input and enforce role/ownership checks.
- Preserve the job state machine; add transitions deliberately with tests.
- Requester input is data, never executable code or a host path.
- Keep Docker runner defaults: no network, read-only root, dropped capabilities, bounded CPU/RAM/PIDs/runtime.
- Never claim Docker isolation passed unless the Docker image and flow were executed.
- Run `npm run check` before opening or updating a PR.
- Keep secrets in environment variables and `.env` ignored.
- Frontend must render returned SVG as an image, never via raw HTML injection.

