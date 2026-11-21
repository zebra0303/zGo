import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import {
  sendCommand,
  getEngineState,
  enqueueApiTask,
  startKataGo,
} from "../katago/engine";
import {
  coordsToGtp,
  gtpToCoords,
  getHandicapStones,
  Coords,
} from "../katago/coords";
import { getMoveTactics, getDetailedExplanation } from "../katago/tactics";
import { t } from "../shared/lib/i18n";
import { requireAdmin, requireAdminOrRoomToken } from "../middleware/auth";

import db from "../db";

const router = Router();

// Rate-limit KataGo endpoints to prevent CPU/queue exhaustion
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests, please slow down." },
});

/** Validate boardSize, handicap, and move coordinates to prevent GTP command injection. */
function isValidBoardParams(
  boardSize: unknown,
  handicap: unknown,
  moves?: unknown,
): boardSize is number {
  if (
    typeof boardSize !== "number" ||
    !Number.isInteger(boardSize) ||
    boardSize < 5 ||
    boardSize > 19
  ) {
    return false;
  }
  if (
    typeof handicap !== "number" ||
    !Number.isInteger(handicap) ||
    handicap < 0 ||
    handicap > 9
  ) {
    return false;
  }
  if (moves !== undefined) {
    if (!Array.isArray(moves) || moves.length > 1000) return false;
    for (const m of moves) {
      if (m === null) continue;
      if (
        typeof m !== "object" ||
        !Number.isInteger((m as Coords).x) ||
        !Number.isInteger((m as Coords).y) ||
        (m as Coords).x < 0 ||
        (m as Coords).x >= boardSize ||
        (m as Coords).y < 0 ||
        (m as Coords).y >= boardSize
      ) {
        return false;
      }
    }
  }
  return true;
}

/** Helper to fetch system settings from DB with fallback */
const getSetting = (key: string, defaultValue: string): string => {
  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  7: 5,
  8: 10,
  9: 50,
  10: 100,
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

router.post(
  "/move",
  requireAdmin,
  aiLimiter,
  async (req: Request, res: Response) => {
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
    } = (req.body ?? {}) as AIMoveBody;

    if (!isValidBoardParams(boardSize, handicap, moves)) {
      return res
        .status(400)
        .json({ error: "Invalid board parameters or moves" });
    }
    if (currentPlayer !== "BLACK" && currentPlayer !== "WHITE") {
      return res.status(400).json({ error: "Invalid currentPlayer" });
    }

    const engine = getEngineState();
    if (!engine.isReady)
      return res.status(503).json({ error: "AI Engine not ready yet" });

    const executeKataGoTask = async (): Promise<void> => {
      const startTime = Date.now();
      try {
        const moveDelay = parseInt(getSetting("ai_move_delay", "0"), 10);

        let targetVisits = isHintRequest
          ? teacherVisits || 330
          : aiDifficulty
            ? VISITS_MAP[aiDifficulty] || 100
            : 100;

        // Apply global engine performance tuning (Thinking Depth Multiplier)
        const visitsMultiplier = parseFloat(
          getSetting("ai_visits_multiplier", "1.0"),
        );
        targetVisits = Math.max(1, Math.round(targetVisits * visitsMultiplier));

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

            if (aiDifficulty === 1) {
              temperature = 5.0; // 극단적인 무작위성 (초보자 수준)
              playoutAdvantage = -3.0; // KataGo 허용 최솟값
            } else if (aiDifficulty <= 3) {
              temperature = 3.0;
              playoutAdvantage = -3.0;
            } else if (aiDifficulty <= 5) {
              temperature = 2.0;
              playoutAdvantage = -2.0;
            } else if (aiDifficulty <= 7) {
              temperature = 1.0;
              playoutAdvantage = -1.0;
            } else if (aiDifficulty <= 9) {
              temperature = 0.5;
              playoutAdvantage = -0.5;
            }

            // Apply global engine performance tuning (Error Frequency Multiplier)
            const tempMultiplier = parseFloat(
              getSetting("ai_temp_multiplier", "1.0"),
            );
            temperature = Math.min(5.0, temperature * tempMultiplier);

            await sendCommand(
              `kata-set-param chosenMoveTemperature ${temperature}`,
            );
            await sendCommand(
              `kata-set-param playoutDoublingAdvantage ${playoutAdvantage}`,
            );

            // Disable resignation for all amateur levels (1-10) to ensure completion
            if (aiDifficulty <= 10) {
              await sendCommand("kata-set-param allowResignation false");
            } else {
              await sendCommand("kata-set-param allowResignation true");
            }

            // Level 1: Make it randomly pick from more candidates by not pruning bad moves
            if (aiDifficulty === 1) {
              await sendCommand(`kata-set-param chosenMoveSubtract 0`);
              await sendCommand(`kata-set-param chosenMovePrune 0`);
            } else {
              // Reset to defaults
              await sendCommand(`kata-set-param chosenMoveSubtract 0`);
              await sendCommand(`kata-set-param chosenMovePrune 1`);
            }
          } catch (e) {
            console.warn("Failed to set amateur params:", (e as Error).message);
          }
        } else {
          try {
            await sendCommand(`kata-set-param chosenMoveTemperature 0.1`);
            await sendCommand(`kata-set-param playoutDoublingAdvantage 0.0`);
            await sendCommand("kata-set-param allowResignation true");
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
              critique = t(language, "ai.critique.missedUrgent", {
                label: bT.label,
                bestMove: coordsToGtp(
                  lastBestMove.x,
                  lastBestMove.y,
                  boardSize,
                ),
                userMove: coordsToGtp(
                  lastUserMove.x,
                  lastUserMove.y,
                  boardSize,
                ),
              });
            else
              critique = t(language, "ai.critique.efficientMove", {
                label: bT.label,
                bestMove: coordsToGtp(
                  lastBestMove.x,
                  lastBestMove.y,
                  boardSize,
                ),
                userMove: coordsToGtp(
                  lastUserMove.x,
                  lastUserMove.y,
                  boardSize,
                ),
              });
          }
        }

        const sendDelayedResponse = (data: any) => {
          const elapsedTime = Date.now() - startTime;
          const remainingDelay = Math.max(0, moveDelay - elapsedTime);
          if (remainingDelay > 0) {
            setTimeout(() => res.json(data), remainingDelay);
          } else {
            res.json(data);
          }
        };

        if (isHintRequest) {
          engine.resetRecommendations();
          const response = await sendCommand(`genmove ${color}`);
          const coords = gtpToCoords(response, boardSize);
          if (!coords) {
            sendDelayedResponse({
              pass: true,
              explanation: t(language, "ai.critique.noPlayable"),
              critique,
            });
            return;
          }

          const recs = engine.recommendations
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 3)
            .map((r) => {
              // Filter out non-coordinate moves (e.g. "pass") to prevent null dereference
              const loc = gtpToCoords(r.move, boardSize);
              if (!loc) return null;
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
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

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
          // In GTP, genmove returning "pass" still plays a pass on the engine board — undo everything except "resign"
          if (lowRes !== "resign") {
            try {
              await sendCommand("undo");
            } catch (e) {
              console.warn("Undo failed:", (e as Error).message);
            }
          }

          sendDelayedResponse({
            recommendations: recs,
            winRate: engine.winRate,
            critique,
          });
        } else {
          const response = await sendCommand(`genmove ${color}`);
          const lowRes = response.toLowerCase();

          if (lowRes === "pass") {
            engine.moves.push(`play ${color} pass`);
            sendDelayedResponse({ pass: true });
            return;
          }
          if (lowRes === "resign") {
            sendDelayedResponse({ resign: true });
            return;
          }

          engine.moves.push(`play ${color} ${response}`);

          sendDelayedResponse({
            move: gtpToCoords(response, boardSize),
            winRate: engine.winRate,
          });
        }
      } catch (err) {
        console.error("API Error in /api/ai/move:", err);
        if (!res.headersSent)
          res.status(500).json({ error: "AI move generation failed" });
      }
    };

    if (!enqueueApiTask(executeKataGoTask)) {
      return res.status(503).json({ error: "AI queue is busy, please retry." });
    }
  },
);

router.post(
  "/analyze-game",
  requireAdminOrRoomToken,
  aiLimiter,
  (req: Request, res: Response) => {
    const {
      moves,
      boardSize = 19,
      handicap = 0,
    } = (req.body ?? {}) as AnalyzeBody;

    if (
      !Array.isArray(moves) ||
      !isValidBoardParams(boardSize, handicap, moves)
    ) {
      return res
        .status(400)
        .json({ error: "Invalid board parameters or moves" });
    }

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

    const safeWrite = (payload: object) => {
      if (!aborted && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    // Route analysis through enqueueApiTask to eliminate concurrent spin-wait queue races
    const enqueued = enqueueApiTask(async () => {
      if (aborted) {
        if (!res.writableEnded) res.end();
        return;
      }

      const prevMaxVisits = engine.maxVisits;
      try {
        // Invalidate cached engine board state since analysis replays a separate game
        engine.boardSize = null;
        engine.handicap = null;
        engine.moves = [];

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
          if (handicapGtp)
            await sendCommand(`set_free_handicap ${handicapGtp}`);
        }

        safeWrite({ moveIndex: 0, winRate: 50 });

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
              safeWrite({ moveIndex: i, winRate: 50 });
              continue;
            }
          } else {
            await sendCommand(`play ${color} pass`);
          }

          if (aborted) break;

          const nextColor = color === "B" ? "W" : "B";
          try {
            const genRes = await sendCommand(`genmove ${nextColor}`);
            await new Promise((resolve) => setTimeout(resolve, 50));
            // Only undo if KataGo actually placed a move/pass (resign does not mutate board)
            if (genRes.trim().toLowerCase() !== "resign") {
              await sendCommand("undo");
            }
          } catch {
            safeWrite({ moveIndex: i, winRate: 50 });
            continue;
          }

          const blackWinRate =
            nextColor === "B" ? engine.winRate : 100 - engine.winRate;
          safeWrite({
            moveIndex: i,
            winRate: Math.round(blackWinRate * 100) / 100,
          });
        }

        safeWrite({ done: true });

        if (prevMaxVisits && prevMaxVisits !== 50) {
          try {
            await sendCommand(`kata-set-param maxVisits ${prevMaxVisits}`);
            engine.maxVisits = prevMaxVisits;
          } catch {
            /* ignore restore errors */
          }
        }
      } catch (err) {
        console.error("[Analysis] Error:", err);
        safeWrite({ error: "Game analysis failed" });
      } finally {
        // Force fresh board sync on next /move or /score request
        engine.boardSize = null;
        engine.handicap = null;
        engine.moves = [];
        if (!res.writableEnded) res.end();
      }
    });

    if (!enqueued) {
      safeWrite({ error: "AI queue is busy, please retry." });
      if (!res.writableEnded) res.end();
    }
  },
);

router.post(
  "/score",
  requireAdminOrRoomToken,
  aiLimiter,
  async (req: Request, res: Response) => {
    const {
      moves,
      boardSize = 19,
      handicap = 0,
    } = (req.body ?? {}) as ScoreBody;

    if (!isValidBoardParams(boardSize, handicap, moves)) {
      return res
        .status(400)
        .json({ error: "Invalid board parameters or moves" });
    }

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
          const deadStonesResponse = await sendCommand(
            "final_status_list dead",
          );
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
          res.status(500).json({ error: "Failed to score game" });
      }
    };

    if (!enqueueApiTask(executeScoreTask)) {
      return res.status(503).json({ error: "AI queue is busy, please retry." });
    }
  },
);

router.post(
  "/restart",
  requireAdmin,
  aiLimiter,
  (_req: Request, res: Response) => {
    try {
      startKataGo();
      res.json({ success: true, message: "Engine restarted manually." });
    } catch (err) {
      console.error("API Error in /api/ai/restart:", err);
      res.status(500).json({ error: "Failed to restart engine" });
    }
  },
);

export default router;
