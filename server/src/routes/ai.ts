import { Router, Request, Response } from "express";
import {
  sendCommand,
  getEngineState,
  enqueueApiTask,
  getApiQueueState,
  startKataGo,
} from "../katago/engine";
import {
  coordsToGtp,
  gtpToCoords,
  getHandicapStones,
  Coords,
} from "../katago/coords";
import { getMoveTactics, getDetailedExplanation } from "../katago/tactics";

const router = Router();

interface AIMoveBody {
  board: (string | null)[][];
  currentPlayer: string;
  isHintRequest: boolean;
  aiDifficulty?: number;
  teacherVisits?: number;
  lastUserMove?: Coords;
  lastRecommendations?: Coords[];
  moves?: (Coords | null)[];
  language?: string;
  boardSize?: number;
  handicap?: number;
}

interface AnalyzeBody {
  moves: (Coords | null)[];
  boardSize?: number;
  handicap?: number;
}

interface ScoreBody {
  moves: (Coords | null)[];
  boardSize?: number;
  handicap?: number;
}

const VISITS_MAP: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 3,
  9: 3,
  10: 5,
  11: 10,
  12: 20,
  13: 30,
  14: 50,
  15: 75,
  16: 100,
  17: 150,
  18: 200,
  19: 250,
  20: 300,
  21: 400,
  22: 500,
  23: 600,
  24: 700,
  25: 800,
  26: 1000,
  27: 1200,
  28: 1500,
  29: 2000,
  30: 2500,
};

/** Replay moves incrementally or from scratch */
const setupBoard = async (
  boardSize: number,
  handicap: number,
  moves?: (Coords | null)[],
) => {
  const engine = getEngineState();
  const moveCommands: string[] = [];

  if (moves && Array.isArray(moves)) {
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const moveColor =
        handicap > 0 ? (i % 2 === 0 ? "W" : "B") : i % 2 === 0 ? "B" : "W";
      const cmd = move
        ? `play ${moveColor} ${coordsToGtp(move.x, move.y, boardSize)}`
        : `play ${moveColor} pass`;
      moveCommands.push(cmd);
    }
  }

  const needsFullReset =
    engine.boardSize !== boardSize ||
    engine.handicap !== handicap ||
    engine.moves.length > moveCommands.length;

  let matchingPrefixCount = 0;
  if (!needsFullReset) {
    for (let i = 0; i < engine.moves.length; i++) {
      if (engine.moves[i] === moveCommands[i]) {
        matchingPrefixCount++;
      } else {
        break;
      }
    }
  }

  if (needsFullReset || matchingPrefixCount < engine.moves.length) {
    // Full reset
    await sendCommand(`boardsize ${boardSize}`);
    await sendCommand(`komi 6.5`);
    await sendCommand("clear_board");

    if (handicap > 0) {
      const stones = getHandicapStones(boardSize, handicap);
      const handicapGtp = stones
        .map((s) => coordsToGtp(s.x, s.y, boardSize))
        .join(" ");
      if (handicapGtp) await sendCommand(`set_free_handicap ${handicapGtp}`);
    }

    // Play all moves
    for (const cmd of moveCommands) {
      try {
        await sendCommand(cmd);
      } catch (e) {
        console.warn(`Ignoring illegal move: ${cmd}`, (e as Error).message);
      }
    }
  } else {
    // Incremental update - play only new moves
    for (let i = matchingPrefixCount; i < moveCommands.length; i++) {
      try {
        await sendCommand(moveCommands[i]);
      } catch (e) {
        console.warn(
          `Ignoring illegal move: ${moveCommands[i]}`,
          (e as Error).message,
        );
      }
    }
  }

  engine.boardSize = boardSize;
  engine.handicap = handicap;
  engine.moves = moveCommands;
};

router.post("/move", async (req: Request, res: Response) => {
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
    boardSize = 19,
    handicap = 0,
  } = req.body as AIMoveBody;

  const engine = getEngineState();
  if (!engine.isReady)
    return res.status(503).json({ error: "AI Engine not ready yet" });

  const executeKataGoTask = async (): Promise<void> => {
    try {
      const targetVisits = isHintRequest
        ? teacherVisits || 330
        : aiDifficulty
          ? VISITS_MAP[aiDifficulty] || 100
          : 100;

      if (engine.maxVisits !== targetVisits) {
        try {
          await sendCommand(`kata-set-param maxVisits ${targetVisits}`);
          engine.maxVisits = targetVisits;
        } catch (e) {
          console.warn("Failed to set maxVisits:", (e as Error).message);
        }
      }

      // Adjust parameters for amateur levels
      if (!isHintRequest && aiDifficulty) {
        try {
          let temperature = 0.1;
          let playoutAdvantage = 0.0;

          if (aiDifficulty <= 5) {
            temperature = 1.5;
            playoutAdvantage = -2.0;
          } else if (aiDifficulty <= 10) {
            temperature = 1.0;
            playoutAdvantage = -1.0;
          } else if (aiDifficulty <= 15) {
            temperature = 0.5;
            playoutAdvantage = -0.5;
          }

          await sendCommand(
            `kata-set-param chosenMoveTemperature ${temperature}`,
          );
          await sendCommand(
            `kata-set-param playoutDoublingAdvantage ${playoutAdvantage}`,
          );
        } catch (e) {
          console.warn("Failed to set amateur params:", (e as Error).message);
        }
      } else {
        try {
          await sendCommand(`kata-set-param chosenMoveTemperature 0.1`);
          await sendCommand(`kata-set-param playoutDoublingAdvantage 0.0`);
        } catch {
          // Ignore reset errors
        }
      }

      await setupBoard(boardSize, handicap, moves);

      const color = currentPlayer === "BLACK" ? "B" : "W";

      // Generate critique if user ignored recommendations
      let critique: string | null = null;
      if (
        lastUserMove &&
        lastRecommendations &&
        lastRecommendations.length > 0
      ) {
        const isFollowed = lastRecommendations.some(
          (rec) => rec.x === lastUserMove.x && rec.y === lastUserMove.y,
        );
        if (!isFollowed) {
          const lastBestMove = lastRecommendations[0];
          const uT = getMoveTactics(
            lastUserMove.x,
            lastUserMove.y,
            board,
            color,
            language,
            boardSize,
          );
          const bT = getMoveTactics(
            lastBestMove.x,
            lastBestMove.y,
            board,
            color,
            language,
            boardSize,
          );
          if (bT.urgency < uT.urgency)
            critique =
              language === "en"
                ? `It's a pity you missed a more urgent ${bT.label}(${coordsToGtp(lastBestMove.x, lastBestMove.y, boardSize)}) than your move(${coordsToGtp(lastUserMove.x, lastUserMove.y, boardSize)}).`
                : `방금 두신 수(${coordsToGtp(lastUserMove.x, lastUserMove.y, boardSize)})보다 더 급한 ${bT.label}(${coordsToGtp(lastBestMove.x, lastBestMove.y, boardSize)}) 자리를 놓치신 것이 아쉽습니다.`;
          else
            critique =
              language === "en"
                ? `Your move(${coordsToGtp(lastUserMove.x, lastUserMove.y, boardSize)}) is good, but AI thinks ${bT.label}(${coordsToGtp(lastBestMove.x, lastBestMove.y, boardSize)}) or around is slightly more efficient.`
                : `두신 수(${coordsToGtp(lastUserMove.x, lastUserMove.y, boardSize)})도 좋은 자리입니다만, AI는 ${bT.label}(${coordsToGtp(lastBestMove.x, lastBestMove.y, boardSize)})나 주변 지점이 조금 더 효율적이라고 판단했습니다.`;
        }
      }

      if (isHintRequest) {
        engine.resetRecommendations();
        const response = await sendCommand(`genmove ${color}`);
        const coords = gtpToCoords(response, boardSize);
        if (!coords) {
          res.json({
            pass: true,
            explanation:
              language === "en"
                ? "AI considers there's nowhere else to play."
                : "AI가 더 이상 둘 곳이 없다고 판단했습니다.",
            critique,
          });
          return;
        }

        let recs = engine.recommendations
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 3)
          .map((r) => {
            const loc = gtpToCoords(r.move, boardSize)!;
            return {
              ...loc,
              gtpMove: r.move,
              winRate: r.winrate,
              visits: r.visits,
              explanation: getDetailedExplanation(
                loc.x,
                loc.y,
                board,
                color,
                language,
                boardSize,
              ),
            };
          });

        if (recs.length === 0)
          recs.push({
            ...coords,
            gtpMove: response,
            winRate: engine.winRate,
            visits: 100,
            explanation: getDetailedExplanation(
              coords.x,
              coords.y,
              board,
              color,
              language,
              boardSize,
            ),
          });

        const lowRes = response.toLowerCase();
        if (lowRes !== "pass" && lowRes !== "resign") {
          try {
            await sendCommand("undo");
          } catch (e) {
            console.warn("Undo failed:", (e as Error).message);
          }
        }

        res.json({
          recommendations: recs,
          winRate: engine.winRate,
          critique,
        });
      } else {
        const response = await sendCommand(`genmove ${color}`);
        const lowRes = response.toLowerCase();

        if (lowRes === "pass") {
          engine.moves.push(`play ${color} pass`);
          res.json({ pass: true });
          return;
        }
        if (lowRes === "resign") {
          res.json({ resign: true });
          return;
        }

        // Track the generated move to prevent re-playing it as an illegal move next turn
        engine.moves.push(`play ${color} ${response}`);

        res.json({
          move: gtpToCoords(response, boardSize),
          winRate: engine.winRate,
        });
      }
    } catch (err) {
      console.error("API Error in /api/ai/move:", err);
      if (!res.headersSent)
        res.status(500).json({
          error: "GTP command failed",
          details: (err as Error).message,
        });
    }
  };

  enqueueApiTask(executeKataGoTask);
});

router.post("/analyze-game", (req: Request, res: Response) => {
  const { moves, boardSize = 19, handicap = 0 } = req.body as AnalyzeBody;
  const engine = getEngineState();
  if (!engine.isReady)
    return res.status(503).json({ error: "AI Engine not ready yet" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let aborted = false;
  res.on("close", () => {
    aborted = true;
  });

  const queueState = getApiQueueState();

  (async () => {
    try {
      while (queueState.isProcessing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      queueState.isProcessing = true;

      const prevMaxVisits = engine.maxVisits;
      try {
        await sendCommand(`kata-set-param maxVisits 50`);
        engine.maxVisits = 50;
      } catch (e) {
        console.warn("Failed to set maxVisits:", (e as Error).message);
      }

      await sendCommand(`boardsize ${boardSize}`);
      await sendCommand(`komi 6.5`);
      await sendCommand("clear_board");
      if (handicap > 0) {
        const stones = getHandicapStones(boardSize, handicap);
        const handicapGtp = stones
          .map((s) => coordsToGtp(s.x, s.y, boardSize))
          .join(" ");
        if (handicapGtp) await sendCommand(`set_free_handicap ${handicapGtp}`);
      }

      if (!aborted)
        res.write(`data: ${JSON.stringify({ moveIndex: 0, winRate: 50 })}\n\n`);

      for (let i = 1; i < moves.length; i++) {
        if (aborted) break;
        const move = moves[i];
        const color =
          handicap > 0
            ? (i - 1) % 2 === 0
              ? "W"
              : "B"
            : (i - 1) % 2 === 0
              ? "B"
              : "W";

        if (move) {
          try {
            await sendCommand(
              `play ${color} ${coordsToGtp(move.x, move.y, boardSize)}`,
            );
          } catch {
            res.write(
              `data: ${JSON.stringify({ moveIndex: i, winRate: 50 })}\n\n`,
            );
            continue;
          }
        } else {
          await sendCommand(`play ${color} pass`);
        }

        if (aborted) break;

        const nextColor = color === "B" ? "W" : "B";
        try {
          await sendCommand(`genmove ${nextColor}`);
          await new Promise((resolve) => setTimeout(resolve, 50));
          await sendCommand("undo");
        } catch {
          res.write(
            `data: ${JSON.stringify({ moveIndex: i, winRate: 50 })}\n\n`,
          );
          continue;
        }

        const blackWinRate =
          nextColor === "B" ? engine.winRate : 100 - engine.winRate;
        res.write(
          `data: ${JSON.stringify({ moveIndex: i, winRate: Math.round(blackWinRate * 100) / 100 })}\n\n`,
        );
      }

      if (!aborted) res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

      if (prevMaxVisits && prevMaxVisits !== 50) {
        try {
          await sendCommand(`kata-set-param maxVisits ${prevMaxVisits}`);
          engine.maxVisits = prevMaxVisits;
        } catch {
          // Ignore restore errors
        }
      }

      res.end();
    } catch (err) {
      console.error("[Analysis] Error:", err);
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ error: (err as Error).message })}\n\n`,
        );
        res.end();
      }
    } finally {
      queueState.isProcessing = false;
      queueState.triggerProcess();
    }
  })();
});

router.post("/score", async (req: Request, res: Response) => {
  const { moves, boardSize = 19, handicap = 0 } = req.body as ScoreBody;
  const engine = getEngineState();
  if (!engine.isReady)
    return res.status(503).json({ error: "AI Engine not ready yet" });

  const executeScoreTask = async (): Promise<void> => {
    try {
      await setupBoard(boardSize, handicap, moves);

      let scoreResponse: string;
      let scoreUnavailable = false;
      try {
        const rawScore = await sendCommand("final_score");
        scoreResponse = rawScore.trim();
      } catch (e) {
        console.warn("final_score failed:", (e as Error).message);
        scoreResponse = "Score unavailable (game may not be finished)";
        scoreUnavailable = true;
      }

      let deadStones: Coords[] = [];
      try {
        const deadStonesResponse = await sendCommand("final_status_list dead");
        if (deadStonesResponse?.trim()) {
          deadStones = deadStonesResponse
            .trim()
            .split(/\s+/)
            .filter((gtp) => gtp.length >= 2)
            .map((gtp) => gtpToCoords(gtp, boardSize))
            .filter((coord): coord is Coords => coord !== null);
        }
      } catch (e) {
        console.warn("final_status_list dead failed:", (e as Error).message);
      }

      res.json({
        score: scoreResponse,
        deadStones,
        error: scoreUnavailable ? "NOT_FINISHED" : null,
      });
    } catch (err) {
      console.error("API Error in /api/ai/score:", err);
      if (!res.headersSent)
        res.status(500).json({
          error: "GTP command failed",
          details: (err as Error).message,
        });
    }
  };

  enqueueApiTask(executeScoreTask);
});

router.post("/restart", (req: Request, res: Response) => {
  try {
    startKataGo();
    res.json({ success: true, message: "Engine restarted manually." });
  } catch (err) {
    console.error("API Error in /api/ai/restart:", err);
    res
      .status(500)
      .json({
        error: "Failed to restart engine",
        details: (err as Error).message,
      });
  }
});

export default router;
