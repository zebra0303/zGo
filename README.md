# zGo

Welcome to **zGo**, a modern web-based Go (Baduk/Weiqi) client powered by **React** and the world-class AI, **KataGo**.

Whether you are a complete beginner or a seasoned professional, zGo provides an elegant interface to play against AI, challenge friends online, review matches with advanced AI analysis, and improve your skills.

[한국어 README](./README.ko.md)

<img width="900" alt="cover" src="https://github.com/user-attachments/assets/d4e02777-859f-42c5-864d-8d334c8a4009" />

---

## Features

### Play

- **Play vs AI (PvAI)**: Challenge KataGo with adjustable difficulty (1-30). **Level 1 is optimized for absolute beginners** with drastic handicaps and intentional sub-optimal play. Supports 9x9, 13x13, and 19x19 boards with handicap (2-9 stones).
- **Player vs Player (PvP)**: Local friendly matches on the same device.
- **Online Multiplayer**: Create or join rooms with unique invite links. Real-time play via WebSocket with character avatars, in-game chat, emoji reactions, and an undo request system (once per player per game).

### Learn

- **Teacher Mode**: AI suggests best moves in real-time and critiques your mistakes with detailed explanations (EN/KR).
- **Review Mode**: Browse through completed games with a win rate graph, interactive AI analysis, variation explorer, and dead stone detection.
- **Full-Game Analysis**: SSE streaming-based move-by-move win rate analysis with **frame-aligned (rAF) batch updates** for ultimate smoothness.
- **Chat History**: Review chat messages exchanged during online games via a lazy-loaded modal (30 messages at a time).

### System

- **Authentication**: **Secure HttpOnly cookie-based** access control for admin accounts, with rate limiting and lockout protection.
- **Admin Panel**: Manage language, theme (light/dark), accent color, font family, and password — all from the sidebar.
- **KataGo Management**: **One-click engine restart** directly from the board interface if the AI stops responding.
- **PWA (Progressive Web App)**: Install zGo on your phone's home screen. Features auto-updating service workers and **smart HTTP caching** to ensure you always have the latest version.
- **Multi-language (i18n)**: Full English and Korean support. Instantly switch the UI and AI explanations.
- **Sound Effects**: Stone placement, pass, win/lose sounds with adjustable volume.

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

### Step 4: Configure Environment Variables

1. In the zGo folder, find the file named **`.env.example`**.
2. Copy this file and rename the copy to **`.env`**.
3. (Optional) Open `.env` with a text editor and change `JWT_SECRET` to a unique random string for better security.

### Step 5: Download the KataGo AI Model

We need to download the "brain" (model file) for the AI to play Go intelligently.

1. Click this link to go to the [KataGo Archive](https://katagoarchive.org/g170/neuralnets/index.html).
2. Find and download the file named `g170e-b10c128-s1141046784-d204142634.bin.gz`.
3. Rename the downloaded file to **`katago-model.bin.gz`**.
4. Move this renamed file into the zGo folder you extracted earlier, specifically into `server/katago/`.
   - The final path should look like this: `zGo-main/server/katago/katago-model.bin.gz`

### Step 6: Run the Game

You are all set! Type the following commands in your terminal one by one:

```bash
# First, build the application (prepares it to run)
npm run build

# Once the build is complete, start the application
npm start
```

### Step 7: Play!

- Open your web browser (Chrome, Edge, Safari, etc.) and type **`http://localhost:3001`** in the address bar.
- On your first visit, you will be prompted to set an admin password. Set your desired password, log in, and enjoy playing Go!

---

## Installation (Docker)

If you have Docker installed, you can run zGo instantly without setting up Node.js. This is the recommended method for most users as it ensures a consistent environment.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Steps

1. **Open a Terminal** in the project root folder.
2. **Set up .env**: Copy `.env.example` to `.env`.
3. **Run the following command**:

   ```bash
   docker-compose up -d --build
   ```

4. **Play!**: Open **`http://localhost:3001`** in your web browser.

> **Note:** On the first run, the container will automatically download the required KataGo AI model (~100MB) if it is missing from your local `server/katago/` folder. Your game history and settings are automatically saved to the local `server/database/` folder and will persist even if you stop the container.

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
| **Realtime**     | WebSocket (ws)                                                              |
| **Auth**         | bcrypt + jsonwebtoken (HttpOnly Cookies), express-rate-limit                |
| **PWA**          | vite-plugin-pwa (Workbox)                                                   |
| **Testing**      | Vitest (112 tests)                                                          |
| **Code Quality** | ESLint, Prettier, Husky, lint-staged                                        |
| **Shared Lib**   | @zebra/core (common UI components, utils, types)                            |

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
│   │   │   ├── GameLayout.tsx      # Shared layout for game pages
│   │   │   ├── ReviewPanelWidget.tsx
│   │   │   └── TeacherAdviceWidget.tsx
│   │   ├── features/               # Board interaction, online UI (rooms, chat)
│   │   ├── entities/               # Match & Online stores, Go logic, tree types
│   │   ├── shared/                 # Reusable UI (GameControls, CustomDialog),
│   │   │                           # API client (fetchWithAuth), types, i18n, router
│   │   └── __tests__/              # Vitest unit tests (85+ tests)
│   └── vite.config.ts              # Vite + PWA plugin config
├── server/                         # Express backend (TypeScript)
│   ├── src/
│   │   ├── index.ts                # Entry point, Cache-Control, SPA fallback
│   │   ├── db.ts                   # SQLite (matches, settings, rooms, chat)
│   │   ├── middleware/auth.ts      # HttpOnly Cookie-based requireAdmin middleware
│   │   ├── lib/goLogic.ts          # Server-side move validation
│   │   ├── katago/                 # KataGo process management & GTP
│   │   ├── routes/
│   │   │   ├── ai.ts              # /api/ai/* (move, analyze, score, restart)
│   │   │   ├── matches.ts         # /api/matches CRUD
│   │   │   ├── online.ts          # /api/online/* (rooms, join, match)
│   │   │   └── settings.ts        # /api/settings/* (auth, config)
│   │   ├── ws/
│   │   │   ├── onlineHandler.ts   # WebSocket game logic
│   │   │   └── roomManager.ts     # Room state management
│   │   └── shared/                 # Server-side i18n locales and logic
│   ├── __tests__/                  # Server-side tests (logic, i18n)
│   └── katago/                     # KataGo binary, config & model
├── Dockerfile                      # Multi-stage production build
├── docker-compose.yml              # Orchestration with local volume mounts
├── .env                            # Environment variables (JWT_SECRET, PORT)
└── package.json                    # Root scripts for build/test
```

### Performance Optimizations

- **FSD Compliance**: Strict layer separation to prevent circular dependencies and improve build times.
- **Rendering**: **Sub-component memoization** (`Stone` component) ensures only changed board intersections re-render.
- **Smoothness**: `requestAnimationFrame` used for win rate analysis updates to maintain 60fps UI.
- **Stability**: Comprehensive **`AbortController` and `isMounted` checks** in all async effects to prevent memory leaks and state updates on unmounted components.
- **Network**: **Hashed asset caching** (1 year) combined with **`no-cache` for HTML** ensures instant updates without stale versions.

---

## License

This project is open-source. Contributions are welcome!
