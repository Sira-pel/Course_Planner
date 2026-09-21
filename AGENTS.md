## Learned User Preferences
- When asked to review or diagnose, do not implement until the user says Build; then implement the agreed plan.
- Keep light/dark switching as a smooth, gradual circular reveal on both Chromium and Firefox, including phones. Do not replace it with a fade, and do not ship a Chromium-only path that pops or hitches in Firefox.
- Do not mix unrelated dirty work into theme-animation commits; leave persist/auth stashes and editor-only `.cursor/` / `.grok/` files out.
- After theme-animation work, update the existing `fix/theme-reveal-chromium` PR rather than opening a new one.

## Learned Workspace Facts
- Local Uniplanner maps to GitHub `Sira-pel/Course_Planner`. Uniplan is a client-side Vite/React/Zustand course planner (dev server port 3000) with no application Express/API server; data is localStorage, auth is Firebase, calendar sync is Google Calendar.
- Schedule persist key is `uniplan_schedule_storage_v2`; pointer theme also writes `uniplan_theme` synchronously. Defer Zustand `set({ theme })` / the big persist blob until the theme reveal finishes.
- Theme reveal lives in `src/utils/themeTransition.ts` and `src/index.css`. Do not clip live `#root`. Chromium stutters on animated `clip-path`; the intended motion is compositor transforms on View Transition snapshots (`theme-light` / `theme-dark`). Keyboard and `prefers-reduced-motion` stay instant. Never force VT groups to 100%; body snapshots have no background (canvas-propagated); Gecko does not paint the VT tree into a scrollbar gutter. Inverse scale must be a geometric ladder so the outer×inner product stays ~1 between keyframes.
- Pool sheet, mobile dock, and other portals render outside `#root`; the view-transition name belongs on `body` so the circle includes them.
- Google Calendar sync should reuse `{plan} - Uniplan`, use floating local event times, and fail closed on bad tokens or partial writes. Calendar access comes from a Firebase popup and has no refreshable token.
- Do not restore failed theme experiments: root View Transition clips, `mask-image` overlays, evenodd `path()` clips, or `cloneNode` freeze overlays. `themeTransition.test.ts` historically encoded those bans and must change with the implementation.
