const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static React client files in production
app.use(express.static(path.join(__dirname, "../client/dist")));

// 1. SQLite Database Setup
const dbPath = path.resolve(__dirname, "database", "zgo.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB Connection Error:", err.message);
  else console.log("Connected to the SQLite database.");
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    aiDifficulty INTEGER,
    humanColor TEXT,
    winner TEXT,
    date TEXT NOT NULL,
    sgfData TEXT NOT NULL
  )`);
});

// 2. KataGo Process Management
let katagoProcess = null;
let isKatagoReady = false;
let commandQueue = [];
let isProcessingQueue = false;
let responseBuffer = "";
let latestWinRate = 50.0;
let currentMultiRecommendations = [];
let currentMaxVisits = null;

const startKataGo = () => {
  if (katagoProcess) {
    katagoProcess.kill();
    isKatagoReady = false;
  }

  const modelPath = path.join(__dirname, "katago/katago-model.bin.gz");
  const configPath = path.join(__dirname, "katago/gtp_config.cfg");

  console.log("Starting KataGo Engine...");
  katagoProcess = spawn("katago", [
    "gtp",
    "-model",
    modelPath,
    "-config",
    configPath,
  ]);

  responseBuffer = "";
  commandQueue = [];
  isProcessingQueue = false;
  currentMaxVisits = null;

  katagoProcess.stdout.on("data", (data) => {
    responseBuffer += data.toString();
    let doubleNewlineIndex = responseBuffer.search(/\n\s*\n/);
    while (doubleNewlineIndex !== -1) {
      const response = responseBuffer.substring(0, doubleNewlineIndex).trim();
      responseBuffer = responseBuffer
        .substring(doubleNewlineIndex)
        .replace(/^\s+/, "");
      if (commandQueue.length > 0 && commandQueue[0].pending) {
        const task = commandQueue.shift();
        if (response.startsWith("="))
          task.resolve(response.substring(1).trim());
        else task.reject(new Error(`GTP Error: ${response}`));
        isProcessingQueue = false;
        processNextCommand();
      }
      doubleNewlineIndex = responseBuffer.search(/\n\s*\n/);
    }
  });

  let stderrBuffer = "";
  katagoProcess.stderr.on("data", (data) => {
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop();
    for (const line of lines) {
      const output = line.trim();
      if (!isKatagoReady && output.includes("GTP ready")) {
        console.log("KataGo Engine is fully loaded and ready.");
        isKatagoReady = true;
      }
      const winrateMatch = output.match(/winrate\s*[:=]?\s*([0-9.]+)/i);
      if (winrateMatch) latestWinRate = parseFloat(winrateMatch[1]) * 100;

      const rootTreeMatch = output.match(/^:\s*T\s+[-+0-9.a-z]+\s+W\s+([-+]?[0-9.]+)([c]?)/i);
      if (rootTreeMatch) {
        currentMultiRecommendations = []; // Reset when seeing root tree node
        let utility = parseFloat(rootTreeMatch[1]);
        if (rootTreeMatch[2] === "c") utility /= 100;
        latestWinRate = Math.min(Math.max(((utility + 1) / 2) * 100, 0), 100);
      } else {
        const treeMatch = output.match(
          /:\s*T\s+[-+0-9.a-z]+\s+W\s+([-+]?[0-9.]+)([c]?)/i,
        );
        if (treeMatch) {
          let utility = parseFloat(treeMatch[1]);
          if (treeMatch[2] === "c") utility /= 100;
          latestWinRate = Math.min(Math.max(((utility + 1) / 2) * 100, 0), 100);
        }
      }

      const moveTreeMatch = output.match(/^([A-Z][0-9]{1,2})\s*:\s*T\s+.*?\s+W\s+([-+]?[0-9.]+)([c]?).*?\sN\s+(\d+)/i);
      if (moveTreeMatch) {
        let utility = parseFloat(moveTreeMatch[2]);
        if (moveTreeMatch[3] === "c") utility /= 100;
        const winrate = Math.min(Math.max(((utility + 1) / 2) * 100, 0), 100);
        currentMultiRecommendations.push({
          move: moveTreeMatch[1],
          winrate,
          visits: parseInt(moveTreeMatch[4], 10),
        });
      }
    }
  });

  katagoProcess.on("exit", () => {
    isKatagoReady = false;
    console.log("KataGo Process exited.");
  });
};

startKataGo();

const processNextCommand = () => {
  if (commandQueue.length === 0 || isProcessingQueue || !katagoProcess) return;
  const task = commandQueue[0];
  if (task.pending) return;
  isProcessingQueue = true;
  task.pending = true;
  katagoProcess.stdin.write(`${task.command}\n`);
};

const sendCommandToKataGo = (command) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = commandQueue.findIndex((t) => t.command === command);
      if (index !== -1) {
        commandQueue.splice(index, 1);
        isProcessingQueue = false;
        console.error(`GTP command timeout: ${command}. Restarting engine...`);
        startKataGo(); // CRITICAL: Restart on timeout to recover stream sync
        reject(new Error(`GTP command timeout: ${command}`));
      }
    }, 30000);
    commandQueue.push({
      command,
      resolve: (val) => {
        clearTimeout(timeout);
        resolve(val);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
      pending: false,
    });
    if (!isProcessingQueue) processNextCommand();
  });
};

const coordsToGtp = (x, y) => `ABCDEFGHJKLMNOPQRST`[x] + (19 - y);
const gtpToCoords = (gtp) => {
  if (!gtp || ["pass", "resign"].includes(gtp.toLowerCase())) return null;
  return {
    x: "ABCDEFGHJKLMNOPQRST".indexOf(gtp[0].toUpperCase()),
    y: 19 - parseInt(gtp.substring(1), 10),
  };
};

const getMoveTactics = (x, y, board, color, language = "ko") => {
  const opponent = color === "B" ? "WHITE" : "BLACK";
  const myColor = color === "B" ? "BLACK" : "WHITE";
  const getLiberties = (tx, ty) => {
    let libs = 0;
    const visited = new Set(),
      stack = [[tx, ty]],
      targetColor = board[ty][tx];
    visited.add(`${tx},${ty}`);
    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      for (const [dx, dy] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            if (board[ny][nx] === null) {
              libs++;
              visited.add(key);
            } else if (board[ny][nx] === targetColor) {
              visited.add(key);
              stack.push([nx, ny]);
            }
          }
        }
      }
    }
    return libs;
  };
  let isCapture = false,
    isAtari = false,
    isSaving = false,
    isConnection = false,
    isCut = false;
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    const nx = x + dx,
      ny = y + dy;
    if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19) {
      const stone = board[ny][nx];
      if (stone === opponent) {
        const libs = getLiberties(nx, ny);
        if (libs === 1) isCapture = true;
        if (libs === 2) isAtari = true;
      } else if (stone === myColor) {
        if (getLiberties(nx, ny) === 1) isSaving = true;
        isConnection = true;
      }
    }
  }
  let oppCount = 0;
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    const nx = x + dx,
      ny = y + dy;
    if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && board[ny][nx] === opponent)
      oppCount++;
  }
  if (oppCount >= 2) isCut = true;
  const isCorner = (x <= 3 || x >= 15) && (y <= 3 || y >= 15);
  const isSide = (x <= 2 || x >= 16 || y <= 2 || y >= 16) && !isCorner;
  if (isCapture)
    return { type: "capture", urgency: 1, label: language === "en" ? "Move to capture opponent's stones" : "상대 돌을 따내는 수" };
  if (isSaving)
    return { type: "saving", urgency: 2, label: language === "en" ? "Move to save endangered stones" : "위험한 내 돌을 살리는 수" };
  if (isAtari)
    return { type: "atari", urgency: 3, label: language === "en" ? "Move to put opponent in Atari" : "상대를 단수로 모는 수" };
  if (isCut) return { type: "cut", urgency: 4, label: language === "en" ? "Move to cut opponent's connection" : "상대의 연결을 끊는 수" };
  if (isConnection)
    return {
      type: "connection",
      urgency: 5,
      label: language === "en" ? "Solid move to connect stones" : "내 돌을 연결하는 두터운 수",
    };
  if (isCorner)
    return { type: "corner", urgency: 6, label: language === "en" ? "Move to secure corner territory" : "귀의 실리를 챙기는 수" };
  if (isSide) return { type: "side", urgency: 7, label: language === "en" ? "Move to expand along the side" : "변을 확장하는 수" };
  return { type: "center", urgency: 8, label: language === "en" ? "Move towards the center" : "중앙으로 나아가는 수" };
};

const getDetailedExplanation = (x, y, board, color, language = "ko") => {
  const tactics = getMoveTactics(x, y, board, color, language);
  const reasons = {
    ko: {
      capture: "상대의 돌을 따낼 수 있는 아주 좋은 찬스입니다! 수읽기의 승리이며 국면의 주도권을 확실히 가져올 수 있습니다.",
      saving: "자신의 돌이 단수 상태이거나 위험에 처해 있습니다. 이 돌을 살려내어 큰 손실을 막아야 하는 긴급한 상황입니다.",
      atari: "상대의 돌을 단수(Atari)로 몰아 압박하는 수입니다. 상대의 응수를 강요하며 주도적으로 국면을 이끌 수 있습니다.",
      cut: "상대 진영의 약점을 찔러 돌을 끊어가는 날카로운 수입니다. 상대의 연결을 방해하고 혼란을 줄 수 있습니다.",
      connection: "자신의 돌들을 튼튼하게 연결하는 두터운 수입니다. 약점을 보강하여 상대의 역습을 원천 봉쇄합니다.",
      corner: "귀의 실리를 차지하거나 굳히는 포석의 급소입니다. 초반 주도권과 확실한 집을 확보하기 위해 가장 먼저 두어야 할 자리입니다.",
      side: "변으로 전개하여 세력을 넓히는 효율적인 수입니다. 상대의 침입을 방어하면서 동시에 자신의 집 모양을 키울 수 있습니다.",
      center: "중앙의 두터움을 쌓아 전체적인 국면의 흐름을 조율하는 수입니다. 장기적인 안목에서 판을 넓게 보는 선택입니다.",
      default: "AI 엔진이 분석한 현재 국면의 급소입니다.",
    },
    en: {
      capture: "Great chance to capture opponent stones! A tactical win that takes control.",
      saving: "Your stones are in danger. It's urgent to save them to prevent huge loss.",
      atari: "Puts the opponent in Atari to pressure them. Forces a response and takes the lead.",
      cut: "A sharp move that cuts the opponent's weak points. Disrupts connection and causes chaos.",
      connection: "A thick move that solidly connects your stones. Prevents opponent's counterattack.",
      corner: "Crucial opening move to secure corner territory. Takes early initiative.",
      side: "Efficient move to expand along the side. Defends while growing your framework.",
      center: "Builds thickness in the center to control the game flow. A long-term strategic choice.",
      default: "A key point analyzed by the AI engine.",
    },
  };
  return reasons[language][tactics.type] || reasons[language].default;
};

// Task Queue Structure to prevent Promise chain memory leaks
const apiRequestQueue = [];
let isProcessingApiQueue = false;
let processedApiCount = 0;
const MAX_API_CALLS_BEFORE_RESTART = 10000;

const processApiQueue = async () => {
  if (isProcessingApiQueue) return;
  isProcessingApiQueue = true;

  while (apiRequestQueue.length > 0) {
    const task = apiRequestQueue.shift(); // take the first
    try {
      await task.execute();
      processedApiCount++;
    } catch (err) {
      console.error("Task failed in queue:", err);
    }
  }

  isProcessingApiQueue = false;

  // Graceful KataGo Restart to cleanup memory fragmentation after heavily loaded sessions
  if (processedApiCount > MAX_API_CALLS_BEFORE_RESTART && !isProcessingQueue) {
    console.log(`Processed ${processedApiCount} AI requests. Restarting KataGo to free memory...`);
    processedApiCount = 0;
    startKataGo();
  }
};

app.post("/api/ai/move", async (req, res) => {
  const {
    board,
    currentPlayer,
    isHintRequest,
    aiDifficulty,
    teacherVisits,
    lastUserMove,
    lastRecommendations,
    moves,
    language = "ko",
  } = req.body;
  if (!isKatagoReady)
    return res.status(503).json({ error: "AI Engine not ready yet" });

  const executeKataGoTask = async () => {
    try {
      const visitsMap = {
        1: 1, 2: 2, 3: 5, 4: 10, 5: 20, 6: 30, 7: 50, 8: 75, 9: 100, 10: 150,
        11: 200, 12: 250, 13: 300, 14: 400, 15: 500, 16: 600, 17: 700, 18: 800, 19: 1000, 20: 1500
      };
      const targetVisits = isHintRequest
        ? teacherVisits || 330
        : aiDifficulty
          ? visitsMap[aiDifficulty] || 100
          : 100;
      if (currentMaxVisits !== targetVisits) {
        try {
          await sendCommandToKataGo(`kata-set-param maxVisits ${targetVisits}`);
          currentMaxVisits = targetVisits;
        } catch (e) {
          console.warn("Failed to set maxVisits:", e.message);
        }
      }

      await sendCommandToKataGo("clear_board");
      const playCommands = [];
      if (moves && Array.isArray(moves)) {
        for (let i = 0; i < moves.length; i++) {
          const move = moves[i];
          const moveColor = i % 2 === 0 ? "B" : "W";
          if (move) {
            playCommands.push(`play ${moveColor} ${coordsToGtp(move.x, move.y)}`);
          } else {
            playCommands.push(`play ${moveColor} pass`);
          }
        }
      } else {
        for (let y = 0; y < 19; y++) {
          for (let x = 0; x < 19; x++) {
            if (board[y][x] === "BLACK")
              playCommands.push(`play B ${coordsToGtp(x, y)}`);
            else if (board[y][x] === "WHITE")
              playCommands.push(`play W ${coordsToGtp(x, y)}`);
          }
        }
      }

      // Fire all play commands in a quick sequence without waiting sequentially
      for (const cmd of playCommands) {
        await sendCommandToKataGo(cmd);
      }
      const color = currentPlayer === "BLACK" ? "B" : "W";
      let critique = null;
      if (lastUserMove && lastRecommendations && lastRecommendations.length > 0) {
        const isFollowed = lastRecommendations.some((rec) => rec.x === lastUserMove.x && rec.y === lastUserMove.y);
        if (!isFollowed) {
          const lastBestMove = lastRecommendations[0];
          const uT = getMoveTactics(
            lastUserMove.x,
            lastUserMove.y,
            board,
            color === "B" ? "W" : "B",
            language
          );
          const bT = getMoveTactics(
            lastBestMove.x,
            lastBestMove.y,
            board,
            color === "B" ? "W" : "B",
            language
          );
          if (bT.urgency < uT.urgency)
            critique = language === "en" ? `It's a pity you missed a more urgent ${bT.label}(${coordsToGtp(lastBestMove.x, lastBestMove.y)}) than your move(${coordsToGtp(lastUserMove.x, lastUserMove.y)}).` : `방금 두신 수(${coordsToGtp(lastUserMove.x, lastUserMove.y)})보다 더 급한 ${bT.label}(${coordsToGtp(lastBestMove.x, lastBestMove.y)}) 자리를 놓치신 것이 아쉽습니다.`;
          else
            critique = language === "en" ? `Your move(${coordsToGtp(lastUserMove.x, lastUserMove.y)}) is good, but AI thinks ${bT.label}(${coordsToGtp(lastBestMove.x, lastBestMove.y)}) or around is slightly more efficient.` : `두신 수(${coordsToGtp(lastUserMove.x, lastUserMove.y)})도 좋은 자리입니다만, AI는 ${bT.label}(${coordsToGtp(lastBestMove.x, lastBestMove.y)})나 주변 지점이 조금 더 효율적이라고 판단했습니다.`;
        }
      }

      if (isHintRequest) {
        currentMultiRecommendations = [];
        const response = await sendCommandToKataGo(`genmove ${color}`);
        const coords = gtpToCoords(response);
        if (!coords)
          return res.json({
            pass: true,
            explanation: language === "en" ? "AI considers there's nowhere else to play." : "AI가 더 이상 둘 곳이 없다고 판단했습니다.",
            critique,
          });

        let recs = currentMultiRecommendations
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 3)
          .map((r) => {
            const loc = gtpToCoords(r.move);
            return {
              ...loc,
              gtpMove: r.move,
              winRate: r.winrate,
              visits: r.visits,
              explanation: getDetailedExplanation(loc.x, loc.y, board, color, language),
            };
          });

        if (recs.length === 0) {
          recs.push({
            ...coords,
            gtpMove: response,
            winRate: latestWinRate,
            visits: 100,
            explanation: getDetailedExplanation(coords.x, coords.y, board, color, language),
          });
        }

        await sendCommandToKataGo("undo");
        // Always return array
        return res.json({
          recommendations: recs,
          winRate: latestWinRate,
          critique,
        });
      } else {
        const response = await sendCommandToKataGo(`genmove ${color}`);
        const lowRes = response.toLowerCase();
        if (lowRes === "pass") return res.json({ pass: true });
        if (lowRes === "resign") return res.json({ resign: true });
        return res.json({
          move: gtpToCoords(response),
          winRate: latestWinRate,
        });
      }
    } catch (err) {
      console.error("API Error in /api/ai/move:", err);
      if (!res.headersSent)
        res
          .status(500)
          .json({ error: "GTP command failed", details: err.message });
    }
  };

  apiRequestQueue.push({ execute: executeKataGoTask });
  processApiQueue();
});

app.post("/api/ai/score", async (req, res) => {
  const { moves } = req.body;
  if (!isKatagoReady)
    return res.status(503).json({ error: "AI Engine not ready yet" });

  const executeKataGoTask = async () => {
    try {
      await sendCommandToKataGo("clear_board");
      const scoreCommands = [];
      if (moves && Array.isArray(moves)) {
        for (let i = 0; i < moves.length; i++) {
          const move = moves[i];
          const moveColor = i % 2 === 0 ? "B" : "W";
          if (move) {
            scoreCommands.push(`play ${moveColor} ${coordsToGtp(move.x, move.y)}`);
          } else {
            scoreCommands.push(`play ${moveColor} pass`);
          }
        }
      }

      for (const cmd of scoreCommands) {
        await sendCommandToKataGo(cmd);
      }

      const response = await sendCommandToKataGo("final_score");
      return res.json({ score: response.trim() });
    } catch (err) {
      console.error("API Error in /api/ai/score:", err);
      if (!res.headersSent)
        res
          .status(500)
          .json({ error: "GTP command failed", details: err.message });
    }
  };

  apiRequestQueue.push({ execute: executeScoreTask });
  processApiQueue();
});

app.post("/api/matches", (req, res) => {
  const { mode, aiDifficulty, humanColor, winner, sgfData } = req.body;
  const stmt = db.prepare(
    `INSERT INTO matches (mode, aiDifficulty, humanColor, winner, date, sgfData) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  stmt.run(
    [mode, aiDifficulty, humanColor, winner, new Date().toISOString(), sgfData],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Match saved successfully" });
    },
  );
  stmt.finalize();
});

app.get("/api/matches", (req, res) => {
  db.all(
    `SELECT id, mode, aiDifficulty, humanColor, winner, date FROM matches ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ matches: rows });
    },
  );
});

app.get("/api/matches/:id", (req, res) => {
  db.get(`SELECT * FROM matches WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Match not found" });
    res.json({ match: row });
  });
});

app.delete("/api/matches/:id", (req, res) => {
  const stmt = db.prepare(`DELETE FROM matches WHERE id = ?`);
  stmt.run([req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Match not found" });
    res.json({ message: "Match deleted successfully" });
  });
  stmt.finalize();
});

// Catch-all route to serve the React index.html for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`),
);
