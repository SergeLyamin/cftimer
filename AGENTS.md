# CF Timer — project instructions

Read README.md, openspec/config.yaml, and the relevant change before implementation. User-facing documentation is in Russian; preserve OpenSpec parser headings in English.

## Current boundary

The legacy code is archived by explicit owner request. Local runtime is implemented; real-device acceptance remains open. QR remote and deployment are not implemented. Do not import archive code into production wholesale or claim planned features work. `archive/` is reference material, not active instructions. Do not modify archived snapshots: their bytes are recorded in archive/manifest-2026-10-22.json. Design references remain in design/.

## Workflow

Use OpenSpec 1.14.3 via `npm run spec -- <command>` and validate with `npm run spec:validate`. Tooling install: `npm ci --prefix tooling/openspec --ignore-scripts`. No global installation is required. Generated `.agents/skills/openspec-*` are CLI-managed; project rules live here and in config.

Current specifications are in openspec/specs. Proposed runtime behavior is in changes, first bootstrap-timer-pilot then add-qr-remote-control. Keep task checkboxes honest. Only sync/archive implemented and verified requirements. Validate checks the documents, not runtime correctness.

## Product constraints

Pilot: 1–3 gyms, computer connected to a TV, modern browsers. Smart/Android TV is backlog. Running display timer continues without network; offline remote is not promised. No user accounts or coach roles. First remote joins freely; a second requests transfer from the active remote. One remote writer; 60 seconds without contact releases ownership for a new claimant. Display reload resets timer/session; remote-phone reload never resets the display. Ordinary smartphone entry runs a standalone local timer without QR; an explicit pairing route opens the remote. Resizing never changes runtime role. Larger screens offer collapsible QR; code entry and casting are future backlog. Keep only ephemeral sessions and logs on the server, with SSH diagnostics. The display owns time/state; server handles room authorization and relay. Phone commands require acknowledgment from the display, deduplication and revision checks. Protect isolation between rooms.

Use a small typed timer state machine, separate from UI/network. Avoid broad rewrites, gratuitous class hierarchies and infrastructure unrelated to pilot needs. Tailwind adoption is not a substitute for UI acceptance scenarios.

## Verification and collaboration

Run checks appropriate to changes. Timer logic needs deterministic boundary tests; remote requires two-device/two-room scenarios; PWA needs offline/reload/update tests. Real-device validation is required before a gym pilot. Record limitations honestly.

Use subagents for independent bounded work when requested or useful under the active user authorization; give explicit file ownership and integrate results. Do not let parallel agents edit the same files. Preserve unrelated user changes and never rewrite Git history as part of cleanup.
