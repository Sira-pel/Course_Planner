# Uniplan

Course schedule planner for university students. Plan multiple scenarios, check conflicts side by side, import schedules from Excel, text, or iCal, and export directly to Google Calendar.

[Live Demo](https://course-schedule-planner.vercel.app/)

---

## Features

- **Multiple schedule plans**: Create, duplicate, and switch between schedule drafts (Plan A, Plan B, etc.) with one click or number keys `1`–`9`.
- **Ghost overlay**: Overlay another plan as translucent blocks to compare alternatives directly on the calendar grid.
- **Conflict detection**: Overlapping lectures and labs are flagged immediately and laid out side by side so nothing is hidden.
- **Quick add from text**: Paste raw course listings, syllabus snippets, or portal text (e.g. `CS 101 Mon/Wed 10:00-11:15 AM rm 204`) to add classes without filling out forms manually.
- **Import**:
  - Excel spreadsheets (`.xlsx`, `.csv`) with column mapping, multi-meeting times, and section filtering.
  - iCalendar (`.ics`) files.
  - Friend share links.
  - JSON backup files.
- **Export**:
  - Direct Google Calendar sync via Google OAuth (creates or updates a `{Plan} - Uniplan` calendar).
  - `.ics` calendar files (Google Calendar, Apple Calendar, Outlook).
  - 2x PNG image export for phone lockscreens or printing.
  - Formatted text and markdown for messaging.
  - Shareable URL links to send plans to classmates.
  - JSON backup download.
- **Course scratchpad pool**: Save alternate sections and electives in a sidebar pool so you can swap them between plans without retyping.
- **Keyboard navigation & custom shortcuts**: Keyboard controls for common actions, plus a built-in shortcut rebind editor (`?`).
- **PWA support**: Installable on mobile and desktop via `vite-plugin-pwa`, with bottom dock navigation and offline caching.
- **Theme support**: Dark mode with circular reveal transition.
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
- Firebase v12 (Google Auth) & Google Calendar API
- Motion for transitions
- `vite-plugin-pwa`
- Lucide React

---

## Getting Started

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm

### Setup
```bash
git clone https://github.com/Sira-pel/Course_Planner.git
cd Course_Planner

npm install
npm run dev
```

App runs on `http://localhost:3000`.

### Build & Typecheck
```bash
npm run lint      # type check with tsc
npm run build     # production build
npm run preview   # preview production build locally
```

---

## Privacy & Storage

- **Local by default**: All plans, courses, and settings are saved in browser `localStorage`. There is no tracking database or custom backend collecting your data.
- **Google Calendar sync**: If you use the Google Calendar sync feature, OAuth tokens and schedule entries are sent directly to Google's API to manage your Uniplan calendar. Syncing is optional; `.ics` export works completely offline.

---

## License

[Apache 2.0](LICENSE)
