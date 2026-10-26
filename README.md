# Uniplan

Course schedule planner for university students. Plan multiple scenarios, check conflicts side by side, import schedules from Excel, text, or iCal, and export directly to Google Calendar.

[Site](https://course-schedule-planner.vercel.app/)

The site is public and hosted on Vercel, so anyone can open it and use it for free in their browser. There is no sign-up. Each person's plans stay in their own browser. It can also be installed as an app.

---

## Features

- **Multiple schedule plans**: Create, duplicate, and switch between schedule drafts (Plan A, Plan B, etc.) with one click or number keys `1`–`9`.
- **Ghost overlay**: Overlay another plan as translucent blocks to compare alternatives directly on the calendar grid.
- **Conflict detection**: Overlapping lectures and labs are flagged immediately and laid out side by side so nothing is hidden.
- **Quick add from text**: Paste raw course listings, syllabus snippets, or portal text (e.g. `CS 101 Mon/Wed 10:00-11:15 AM rm 204`) to add classes without filling out forms manually.
- **Import**:
  - Excel spreadsheets (`.xlsx`, `.csv`) with column mapping, multi-meeting times, and section filtering.
  - iCalendar (`.ics`) files.
  - Excel and calendar imports can stay in the course pool, enroll in the open plan, or start a new empty plan. The pool still receives the courses. One undo removes a plan created this way.
  - Friend share links.
  - JSON backup files.
- **Generate plans**: From the course pool, tick candidate courses and pin must-takes. Uniplan tries section mixes on your device (up to 15 candidate courses), drops time clashes, and shows a few ranked plans. A course that has no usable section under your filters is left out and listed, instead of blocking the rest. Lunch is any free stretch of the length you choose inside the window you set. Saving a result creates a normal plan and leaves the pool and your other plans unchanged.
- **Export**:
  - Direct Google Calendar sync via Google OAuth (creates or updates a `{Plan} - Uniplan` calendar).
  - `.ics` calendar files (Google Calendar, Apple Calendar, Outlook).
  - 2x PNG image export for phone lockscreens or printing.
  - Formatted text and markdown for messaging.
  - Shareable URL links to send plans to classmates.
  - JSON backup download.
- **Course scratchpad pool**: Save alternate sections and electives in a sidebar pool so you can swap them between plans without retyping. Generate plans from the courses already in the pool.
- **Keyboard navigation & custom shortcuts**: Keyboard controls for common actions, plus a built-in shortcut rebind editor (`?`).
- **PWA support**: Installable on mobile and desktop via `vite-plugin-pwa`, with bottom dock navigation and offline caching.
- **Light and dark themes**: One indigo accent in both, with a circular reveal transition when you switch.
- **Undo / Redo**: History support (`Ctrl+Z` / `Ctrl+Y`) across schedule edits.

---

## Keyboard Shortcuts

Press `?` inside the app to see all shortcuts or rebind them.

| Shortcut | macOS | Action |
| --- | --- | --- |
| `Alt + N` | `Option + N` | Add course |
| `Alt + K` | `Option + K` | Quick add from text |
| `Alt + P` | `Option + P` | Toggle course pool sidebar |
| `Alt + E` | `Option + E` | Export modal |
| `Alt + I` | `Option + I` | Import modal |
| `Alt + S` | `Option + S` | Share plan link |
| `Alt + C` | `Option + C` | Compare plans overlay |
| `Alt + D` | `Option + D` | Duplicate current plan |
| `Alt + T` | `Option + T` | Toggle dark/light theme |
| `Alt + H` | `Option + H` | Help & guide |
| `1` – `9` | `1` – `9` | Switch plans |
| `Ctrl + Z` | `Cmd + Z` | Undo |
| `Ctrl + Y` | `Cmd + Shift + Z` | Redo |
| `?` | `?` | Shortcut list & custom bindings |
| `Escape` | `Escape` | Close dialog or menu |

---

## Tech Stack

- React 19, TypeScript, Vite 6
- Tailwind CSS v4
- Zustand v5 (state management + localStorage persistence)
- SheetJS (`xlsx`) for spreadsheet imports
- Firebase Auth (`@firebase/app`, `@firebase/auth`) & Google Calendar API
- Motion for transitions
- `vite-plugin-pwa`
- Lucide React

---

## Getting Started

### Prerequisites
- Node.js 22 (what CI and the production build use; `package.json` declares it)
- npm

### Setup
```bash
git clone https://github.com/Sira-pel/Course_Planner.git
cd Course_Planner

npm install
npm run dev
```

App runs on `http://localhost:3000`. It is only reachable from your own computer; use `npm run dev:phone` to open it to your network, for example to test on a phone.

### Check, test, build
```bash
npm run lint      # type check with tsc
npm test          # unit tests
npm run build     # production build
npm run preview   # preview production build locally
```

`npm run test:e2e` runs a browser test that needs Chrome (set `CHROME_PATH` if it is not found).

The same lint, test, and build steps run in GitHub Actions on every pull request, plus a non-blocking `npm audit`.

---

## Privacy & Storage

- **Local by default**: All plans, courses, and settings are saved in browser `localStorage`. There is no tracking database or custom backend collecting your data.
- **One browser, no sync**: Data lives in the browser you used. A new device, a private window, or cleared site data starts empty. To keep or move your plans, use the JSON backup (Import / Export, Save backup) or send a share link.
- **Google Calendar sync**: If you use the Google Calendar sync feature, OAuth tokens and schedule entries are sent directly to Google's API to manage your Uniplan calendar. Syncing is optional; `.ics` export works completely offline. Google sign-in uses the Firebase project in `firebase-applet-config.json`; if you deploy under another domain, add it to Firebase's authorized domains.

---

## License

Copyright 2026 Sirapel. Licensed under the [Apache License 2.0](LICENSE).
