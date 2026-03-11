# zGo 🎮

Welcome to **zGo**, a modern and beautiful web-based Go (Baduk/Weiqi) client powered by **React** and the world-class AI, **KataGo**!

Whether you are a complete beginner or a seasoned professional, zGo provides an elegant interface to play against AI, review your matches with advanced AI recommendations, and improve your skills.

---

## 🚀 Features

- **Beautiful UI**: A sleek, responsive, and gorgeous Go board experience.
- **Play vs AI**: Challenge KataGo directly in your browser with adjustable difficulty levels.
- **Teacher Mode**: The AI will actively suggest the best moves and critique your mistakes with detailed explanations in real-time.
- **Review Mode**: Effortlessly browse through your game history with Win Rate graphs and interactive AI visualizer zones.
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

*(Example: `cd Desktop/zGo`)*

### Step 4: Install Dependencies
Now that you're inside the project folder, type the following command to install the required tools:

```bash
npm install
```
*(Wait a few minutes for this to finish.)*

### Step 5: Download the KataGo AI Model
The AI engine requires a neural network model file (`katago-model.bin.gz`) to play. Because of its large size, it is not included in the repository.

1. Go to the [KataGo Archive](https://katagoarchive.org/g170/neuralnets/index.html).
2. Download the exact model file named: `g170e-b10c128-s1141046784-d204142634.bin.gz`.
3. Rename the downloaded file to `katago-model.bin.gz`.
4. Place the file inside the `server/katago/` folder of this project.

### Step 6: Configure your Network (Optional)
If you need to change the game's port or API URL, you can create a `.env` file in the project folder. Use the provided `.env.example` as a template:

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
npm run start
```

Depending on the mode you chose, open your web browser and go to:
- **Developer Mode**: 👉 **[http://localhost:5550](http://localhost:5550)** (or the port defined in `VITE_PORT`)
- **Production Mode**: 👉 **[http://localhost:3330](http://localhost:3330)** (or the port defined in `PORT`)

Enjoy your game! 🎉

---

## 🛠 For Developers

This project strictly follows the **FSD (Feature-Sliced Design)** architecture for a scalable frontend.

### Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Zustand, Tanstack Query, Vite
- **Backend / IPC**: Node.js Express server to handle `KataGo` engine bindings natively via standard GTP commands.
- **Database**: SQLite3

### Advanced Startup

To run the backend server and frontend client simultaneously:
```bash
npm run dev
```

To build for production:
```bash
npm run build
```

To run lint checks and formatting:
```bash
npm run lint
npm run format
```

---

## 📝 License
This project is open-source. Please feel free to contribute and enhance the AI Go experience!
