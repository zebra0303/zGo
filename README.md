# zGo

Welcome to **zGo**, a modern web-based Go (Baduk/Weiqi) client powered by **React** and the world-class AI, **KataGo**.

Whether you are a complete beginner or a seasoned professional, zGo provides an elegant interface to play against AI, challenge friends online, review matches with advanced AI analysis, and improve your skills.

[한국어 README](./README.ko.md)

---

## Features

### Play

- **Play vs AI (PvAI)**: Challenge KataGo with adjustable difficulty (1-30) on 9x9, 13x13, and 19x19 boards with handicap support (2-9 stones).
- **Player vs Player (PvP)**: Local friendly matches on the same device.
- **Online Multiplayer**: Create or join rooms with unique invite links. Real-time play via WebSocket with character avatars, in-game chat, emoji reactions, and an undo request system (once per player per game).

### Learn

- **Teacher Mode**: AI suggests best moves in real-time and critiques your mistakes with detailed explanations (EN/KR).
- **Review Mode**: Browse through completed games with a win rate graph, interactive AI analysis, variation explorer, and dead stone detection.
- **Full-Game Analysis**: SSE streaming-based move-by-move win rate analysis with throttled batch updates.
- **Chat History**: Review chat messages exchanged during online games via a lazy-loaded modal (30 messages at a time).

### System

- **Authentication**: Password-based access control with JWT tokens, rate limiting, and account lockout protection.
- **Admin Panel**: Manage language, theme (light/dark), accent color, font family, and password — all from the sidebar.
- **PWA (Progressive Web App)**: Install zGo on your phone's home screen for a native app experience. Auto-updating service worker with asset caching.
- **Multi-language (i18n)**: Full English and Korean support. Instantly switch the UI and AI explanations.
- **Sound Effects**: Stone placement, pass, win/lose sounds with adjustable volume.
- **Dark Mode**: Full dark mode support across all UI components.

---

## Installation (Beginner Guide)

Even if you have no programming experience, you can easily install and run zGo on your computer by following these steps.

### Prerequisites

1. **Install Node.js**: Go to the [Node.js Official Website](https://nodejs.org/), download the **LTS version** (Recommended for Most Users), and install it. (You can just click 'Next' through the default settings during installation.)

### Step 1: Download & Extract zGo

1. Click the green **`<> Code`** button at the top right of this page, then click **`Download ZIP`**.
2. Extract the downloaded `zGo-main.zip` file to a location you can easily find (e.g., your Desktop or Documents folder).

### Step 2: Open Terminal and Navigate to the Folder

Open a terminal (command line interface) where you can type commands:

- **Windows**: Open the Start menu, search for `cmd` or `Command Prompt`, and open it.
- **Mac**: Press `cmd + space`, search for `Terminal`, and open it.

Once the terminal is open, navigate to the extracted folder. (Replace the path below with your actual folder location.)

```bash
cd Desktop/zGo-main
# Example (Windows): cd Desktop\zGo-main
# Example (Mac): cd Desktop/zGo-main
```

### Step 3: Install Required Packages

Copy the following command, paste it into your terminal, and press Enter. (This may take 1-2 minutes.)

```bash
npm install
```

### Step 4: Download the KataGo AI Model

We need to download the "brain" (model file) for the AI to play Go intelligently.

1. Click this link to go to the [KataGo Archive](https://katagoarchive.org/g170/neuralnets/index.html).
2. Find and download the file named `g170e-b10c128-s1141046784-d204142634.bin.gz`.
3. Rename the downloaded file to **`katago-model.bin.gz`**.
4. Move this renamed file into the zGo folder you extracted earlier, specifically into `server/katago/`.
   - The final path should look like this: `zGo-main/server/katago/katago-model.bin.gz`

### Step 5: Run the Game

You are all set! Type the following commands in your terminal one by one:

```bash
# First, build the application (prepares it to run)
npm run build

# Once the build is complete, start the application
npm start
```

### Step 6: Play!

- Open your web browser (Chrome, Edge, Safari, etc.) and type **`http://localhost:3330`** in the address bar.
- On your first visit, you will be prompted to set an admin password. Set your desired password, log in, and enjoy playing Go!

---

## For Developers

This project follows the **FSD (Feature-Sliced Design)** architecture.

### Tech Stack

| Layer            | Technology                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| **Frontend**     | React 18, TypeScript, Tailwind CSS, Zustand (+ Immer), TanStack Query, Vite |
| **Backend**      | Node.js, Express 5, TypeScript                                              |
| **AI Engine**    | KataGo (GTP protocol via child_process)                                     |
| **Database**     | better-sqlite3 (WAL mode)                                                   |
| **Realtime**     | WebSocket (ws) with JWT room tokens                                         |
| **Auth**         | bcrypt + jsonwebtoken, express-rate-limit                                   |
| **PWA**          | vite-plugin-pwa (Workbox)                                                   |
| **Testing**      | Vitest (105 tests)                                                          |
| **Code Quality** | ESLint, Prettier, Husky, lint-staged                                        |

### Project Structure

```
zGo/
├── client/                         # React frontend (FSD architecture)
│   ├── src/
│   │   ├── app/                    # App setup (providers, i18n, auth gate)
│   │   ├── pages/                  # MainPage, OnlinePage, AuthPage
│   │   ├── widgets/                # Composite UI blocks
│   │   │   ├── sidebar/            # AdminPanel, SettingsPanel, GameStatusPanel,
│   │   │   │                       # MatchHistory, ChatHistoryModal
│   │   │   ├── BoardWidget.tsx
│   │   │   ├── SidebarWidget.tsx
│   │   │   ├── OnlineSidebarWidget.tsx
│   │   │   ├── ReviewControlWidget.tsx
│   │   │   ├── WinRateGraphWidget.tsx
│   │   │   └── TeacherAdviceWidget.tsx
│   │   ├── features/               # Board interaction, online UI (rooms, chat)
│   │   ├── entities/               # Game store, online store, Go logic, tree utils
│   │   └── shared/                 # API client, types, i18n, sounds, router
│   └── vite.config.ts              # Vite + PWA plugin config
├── server/                         # Express backend (TypeScript)
│   ├── src/
│   │   ├── index.ts                # Entry point, route & WebSocket mounting
│   │   ├── db.ts                   # SQLite (matches, system_settings,
│   │   │                           #   online_rooms, online_chat)
│   │   ├── middleware/auth.ts      # JWT requireAdmin middleware
│   │   ├── lib/goLogic.ts          # Server-side move validation
│   │   ├── katago/                 # KataGo process management & GTP
│   │   ├── routes/
│   │   │   ├── ai.ts              # /api/ai/* (move, analyze, score)
│   │   │   ├── matches.ts         # /api/matches CRUD
│   │   │   ├── online.ts          # /api/online/* (rooms, join, match)
│   │   │   └── settings.ts        # /api/settings/* (auth, config)
│   │   └── ws/
│   │       ├── onlineHandler.ts   # WebSocket game logic
│   │       └── roomManager.ts     # Room state management
│   └── katago/                     # KataGo binary, config & model
├── .env                            # Environment variables
└── package.json                    # Root scripts
```

### Scripts

| Command         | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `npm run dev`   | Start both client (Vite) and server (tsx watch) concurrently |
| `npm run build` | Build client (Vite) + server (tsc) for production            |
| `npm start`     | Start the production server                                  |
| `npm test`      | Run all tests (client 71 + server 34 = 105 tests)            |
| `npm run lint`  | Lint the client codebase                                     |

### API Endpoints

#### AI

| Method | Endpoint               | Auth | Description                               |
| ------ | ---------------------- | ---- | ----------------------------------------- |
| POST   | `/api/ai/move`         | -    | AI move or teacher hint with explanations |
| POST   | `/api/ai/analyze-game` | -    | Full-game win rate analysis (SSE stream)  |
| POST   | `/api/ai/score`        | -    | Final score calculation & dead stones     |

#### Matches

| Method | Endpoint           | Auth | Description         |
| ------ | ------------------ | ---- | ------------------- |
| POST   | `/api/matches`     | -    | Save a match record |
| GET    | `/api/matches`     | -    | List all matches    |
| GET    | `/api/matches/:id` | -    | Get match by ID     |
| DELETE | `/api/matches/:id` | -    | Delete a match      |

#### Online Multiplayer

| Method | Endpoint                      | Auth | Description                  |
| ------ | ----------------------------- | ---- | ---------------------------- |
| POST   | `/api/online/rooms`           | -    | Create a new room            |
| GET    | `/api/online/rooms/:id`       | -    | Get room info                |
| POST   | `/api/online/rooms/:id/join`  | -    | Join an existing room        |
| GET    | `/api/online/rooms/:id/match` | JWT  | Get match data with chat     |
| WS     | `/ws/online`                  | JWT  | Real-time game communication |

#### Auth & Settings

| Method | Endpoint                 | Auth | Description              |
| ------ | ------------------------ | ---- | ------------------------ |
| GET    | `/api/settings/status`   | -    | Check if password is set |
| POST   | `/api/settings/setup`    | -    | Initial password setup   |
| POST   | `/api/settings/login`    | -    | Login (returns JWT)      |
| POST   | `/api/settings/refresh`  | JWT  | Refresh token            |
| PUT    | `/api/settings/password` | JWT  | Change password          |
| GET    | `/api/settings/config`   | -    | Get public config        |
| PUT    | `/api/settings/config`   | JWT  | Update config            |

### Performance Optimizations

- **Code Splitting**: `React.lazy` + Vite manual chunks (vendor-react, vendor-state, vendor-i18n, vendor-icons). All chunks < 134kB.
- **Memoization**: `React.memo`, `useMemo`, `useCallback` on all heavy components.
- **Zustand Selectors**: `useShallow` on BoardCore to prevent unnecessary re-renders.
- **Throttled Updates**: 100ms batched win rate updates during game analysis.
- **AbortController**: All async effects cleaned up to prevent memory leaks.
- **Cache Eviction**: Teacher recommendation cache capped at 50 entries.
- **PWA Caching**: Service worker caches static assets (images, fonts) for offline use.
- **Dev Profiling**: `useRenderProfile` hook logs slow renders (>16ms) in development.

---

## License

This project is open-source. Contributions are welcome!
