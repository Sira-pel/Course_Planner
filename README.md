# UniPlan — University Course Schedule & Scenario Planner

An interactive university course schedule builder and scenario planner built with React 19, TypeScript, Tailwind CSS, and Zustand. UniPlan helps students design, optimize, and compare multiple schedule options with collision detection, ghost plan overlays, syllabus text parsing, and calendar exports.

[Link to the site](course-schedule-planner.vercel.app)


---

## ✨ Features

- **Multi-Plan Scenario Architect**: Create, duplicate, and switch between multiple schedule drafts (Plan A, Plan B, etc.) with a single click.
- **Ghost Plan Overlay**: Compare alternate schedule scenarios simultaneously with translucent dotted ghost blocks directly on the calendar.
- **Real-Time Conflict Detection**: Instant detection and visual warnings for overlapping lectures, discussions, and labs.
- **Side-by-Side Conflict Layout**: Overlapping classes automatically calculate proportional columns so every session remains visible and clickable.
- **Smart Quick Add / Text Parser**: Paste raw syllabus listings, course catalog snippets, or student portal text (e.g. `CS 101 Mon/Wed 10:00-11:15 AM rm 204`) with instant heuristic parsing.
- **Shared Course Scratchpad Pool**: Stash alternative sections, electives, and backup classes in a sidebar and toggle them across scenarios.
- **Full Undo / Redo**: Complete history tracking with `Ctrl+Z` / `Ctrl+Y` support.
- **Calendar & Image Export**:
  - **iCalendar (.ics)**: RFC 5545 compliant export for Google Calendar, Apple Calendar, and Outlook with weekly recurrence.
  - **Retina Image (PNG)**: 2x high-resolution snapshot ideal for mobile lockscreens, printing, or sending to advisors.
  - **Formatted Schedule Text**: Markdown, syllabus, and clean text formats for sharing via message or email.
  - **Full JSON Backup & Restore**: One-click download and upload of all your schedules and course scratchpads.
- **Dark Mode & Responsive UI**: Seamless theme toggling with zero flicker on initial load, and responsive day column headers adapting to small screens.
- **Keyboard Navigation**: Power-user shortcuts for quick course creation, modal control, plan switching, and exports.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` / `Cmd + N` | Add new course |
| `Ctrl + K` / `Cmd + K` | Open Quick Add (Syllabus text parser) |
| `Ctrl + D` / `Cmd + D` | Duplicate current schedule plan |
| `Ctrl + E` / `Cmd + E` | Open Export modal (.ics / PNG / Backup) |
| `Ctrl + Z` / `Cmd + Z` | Undo last action |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo action |
| `1` – `9` | Switch between schedule plans |
| `?` | View keyboard shortcuts cheat sheet |
| `Escape` | Close any active modal |

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) with local storage persistence & rehydration sanitization
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion](https://motion.dev/)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/uniplan.git
cd uniplan

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be accessible at `http://localhost:3000`.

### Production Build
```bash
# Lint code and check types
npm run lint

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🔒 Security & Data Privacy

- **100% Client-Side**: All schedules and custom course data stay securely in your browser's `localStorage`. No personal student data is transmitted to external servers.
- **Sanitized Imports**: JSON backup imports are strictly validated and sanitized to prevent malformed records or invalid state trees.
- **RFC 5545 Escaping**: Text fields exported to `.ics` files are properly escaped to prevent calendar injection or parser corruption.

---

## 📄 License
This project is open-source and available under the [Apache 2.0 License](LICENSE).
