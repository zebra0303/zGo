# zGo 🎮

Welcome to **zGo**, a modern and beautiful web-based Go (Baduk/Weiqi) client powered by **React** and the world-class AI, **KataGo**!

Whether you are a complete beginner or a seasoned professional, zGo provides an elegant interface to play against AI, review your matches with advanced AI recommendations, and improve your skills.

---

## 🚀 Features

- **Beautiful UI**: A sleek, responsive, and gorgeous Go board experience.
- **Multi-language Support (i18n)**: Fully supports English and Korean. Instantly switch the UI and AI Teacher's explanations.
- **Play vs AI**: Challenge KataGo directly in your browser with adjustable difficulty levels (1–30).
- **Teacher Mode**: The AI will actively suggest the best moves and critique your mistakes with detailed explanations in real-time (Available in EN/KR).
- **Review Mode**: Effortlessly browse through your game history with Win Rate graphs and interactive AI visualizer zones.
- **Game Analysis**: Full-game win rate analysis via SSE streaming with throttled batch updates.
- **Board Sizes**: Supports 9×9, 13×13, and 19×19 boards with handicap stones (2–9).
- **Sound Effects**: Stone placement, win/lose sounds with adjustable volume.
- **Local History**: Your matches are automatically saved and stored safely in a local SQLite database.

---

## 📦 How to Install (For Beginners)

Don't worry if you've never used code before! Just follow these simple steps to run the game on your computer.

### Prerequisites

Before starting, you need to install **Node.js** (the engine that runs the web app).

1. Go to the [Node.js Official Website](https://nodejs.org/).
2. Download and install the **LTS (Long Term Support)** version.

### Step 1: Download the Game

If you haven't already, download this project folder to your computer and unzip it.

### Step 2: Open your Terminal (Command Prompt)

- **Windows**: Press the `Windows Key`, type `cmd`, and press Enter.
- **Mac**: Press `Command + Space`, type `Terminal`, and press Enter.

### Step 3: Navigate to the Project Folder

In your terminal, you need to navigate to the folder where you unzipped zGo. You can do this by typing `cd ` and dragging the folder into the terminal, then pressing Enter.

_(Example: `cd Desktop/zGo`)_

### Step 4: Install Dependencies

Now that you're inside the project folder, type the following command to install the required tools:

```bash
npm install
```

_(Wait a few minutes for this to finish.)_

### Step 5: Download the KataGo AI Model

The AI engine requires a neural network model file (`katago-model.bin.gz`) to play. Because of its large size, it is not included in the repository.

1. Go to the [KataGo Archive](https://katagoarchive.org/g170/neuralnets/index.html).
2. Download the exact model file named: `g170e-b10c128-s1141046784-d204142634.bin.gz`.
3. Rename the downloaded file to `katago-model.bin.gz`.
4. Place the file inside the `server/katago/` folder of this project.

### Step 6: Configure your Network (Optional)

If you need to change the game's port or API URL, you can create a `.env` file in the project root. Use the provided `.env.example` as a template:

1. Duplicate `.env.example`.
2. Rename the duplicated file to `.env`.
3. Open it with any text editor to modify the ports (`PORT` for backend, `VITE_PORT` for frontend).

### Step 7: Start the Game!

You have two options to run the game:

**Option A: Developer Mode (Easiest)**
Simply type:

```bash
npm run dev
```

**Option B: Production Mode (Optimized & Faster)**
If you want the game to run at maximum performance, compile the app first and then start the production server:

```bash
npm run build
npm start
```

Depending on the mode you chose, open your web browser and go to:

- **Developer Mode**: 👉 **[http://localhost:5550](http://localhost:5550)** (or the port defined in `VITE_PORT`)
- **Production Mode**: 👉 **[http://localhost:3330](http://localhost:3330)** (or the port defined in `PORT`)

Enjoy your game! 🎉

---

## 🛠 For Developers

This project strictly follows the **FSD (Feature-Sliced Design)** architecture for a scalable frontend.

### Tech Stack

| Layer            | Technology                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| **Frontend**     | React 18, TypeScript, Tailwind CSS, Zustand (+ Immer), TanStack Query, Vite |
| **Backend**      | Node.js, Express 5, TypeScript                                              |
| **AI Engine**    | KataGo (GTP protocol via child_process)                                     |
| **Database**     | SQLite3                                                                     |
| **Testing**      | Vitest, Testing Library                                                     |
| **Code Quality** | ESLint, Prettier, Husky, lint-staged                                        |

### Project Structure

```
zGo/
├── client/                     # React frontend (FSD architecture)
│   ├── src/
│   │   ├── app/                # App-level setup (providers, i18n)
│   │   ├── pages/              # Page components (MainPage)
│   │   ├── widgets/            # Composite UI blocks
│   │   │   ├── sidebar/        # Decomposed sidebar panels
│   │   │   ├── BoardWidget.tsx
│   │   │   ├── SidebarWidget.tsx
│   │   │   ├── ReviewControlWidget.tsx
│   │   │   ├── WinRateGraphWidget.tsx
│   │   │   └── TeacherAdviceWidget.tsx
│   │   ├── features/           # Feature-specific logic (board interaction)
│   │   ├── entities/           # Domain models (match store, game tree, Go logic)
│   │   └── shared/             # Shared utilities, types, API, UI components
│   └── vite.config.ts
├── server/                     # Express backend (TypeScript)
│   ├── src/
│   │   ├── index.ts            # App entry, route mounting
│   │   ├── db.ts               # SQLite initialization
│   │   ├── katago/
│   │   │   ├── engine.ts       # KataGo process management & GTP queue
│   │   │   ├── coords.ts       # Board ↔ GTP coordinate conversion
│   │   │   └── tactics.ts      # Move analysis & explanations (KR/EN)
│   │   └── routes/
│   │       ├── ai.ts           # /api/ai/* endpoints
│   │       └── matches.ts      # /api/matches CRUD
│   ├── __tests__/
│   ├── katago/                 # KataGo binary config & model
│   └── tsconfig.json
├── .env                        # Environment variables (PORT, VITE_PORT, etc.)
└── package.json                # Root scripts (dev, build, test, start)
```

### Scripts

| Command         | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `npm run dev`   | Start both client (Vite) and server (tsx watch) concurrently |
| `npm run build` | Build client (Vite) + server (tsc) for production            |
| `npm start`     | Start the production server (`server/dist/index.js`)         |
| `npm test`      | Run all tests (client + server, 47 tests)                    |
| `npm run lint`  | Lint the client codebase                                     |

### API Endpoints

| Method | Endpoint               | Description                                           |
| ------ | ---------------------- | ----------------------------------------------------- |
| POST   | `/api/ai/move`         | Generate AI move or teacher hint with recommendations |
| POST   | `/api/ai/analyze-game` | Full-game win rate analysis (SSE stream)              |
| POST   | `/api/ai/score`        | Calculate final score and identify dead stones        |
| POST   | `/api/matches`         | Save a match record                                   |
| GET    | `/api/matches`         | List all match records                                |
| GET    | `/api/matches/:id`     | Get match details by ID                               |
| DELETE | `/api/matches/:id`     | Delete a match record                                 |

### Performance Optimizations

- **Code Splitting**: `React.lazy` + Vite manual chunks (vendor-react, vendor-state, vendor-i18n, vendor-icons). All chunks < 134kB.
- **Memoization**: `React.memo`, `useMemo`, `useCallback` on all heavy components.
- **Zustand Selectors**: `useShallow` on BoardCore to prevent unnecessary re-renders.
- **Throttled Updates**: 100ms batched win rate updates during game analysis.
- **AbortController**: All async effects cleaned up to prevent memory leaks.
- **Cache Eviction**: Teacher recommendation cache capped at 50 entries.
- **Dev Profiling**: `useRenderProfile` hook logs slow renders (>16ms) in development.

---

## 📝 License

This project is open-source. Please feel free to contribute and enhance the AI Go experience!
