import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

interface CommandTask {
  command: string;
  resolve: (val: string) => void;
  reject: (err: Error) => void;
  pending: boolean;
}

interface MoveRecommendation {
  move: string;
  winrate: number;
  visits: number;
}

// KataGo engine state
let katagoProcess: ChildProcessWithoutNullStreams | null = null;
let isKatagoReady = false;
let isShuttingDown = false;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
const commandQueue: CommandTask[] = [];
let isProcessingQueue = false;
let responseBuffer = "";
let latestWinRate = 50.0;
let currentMultiRecommendations: MoveRecommendation[] = [];
let currentMaxVisits: number | null = null;
let currentBoardSize: number | null = null;
let currentHandicap: number | null = null;
let currentMoves: string[] = [];

// API queue state
const apiRequestQueue: { execute: () => Promise<void> }[] = [];
let isProcessingApiQueue = false;
let processedApiCount = 0;
const MAX_API_CALLS_BEFORE_RESTART = 500;
const MAX_API_QUEUE_SIZE = 50;

export const getEngineState = () => ({
  get isReady() {
    return isKatagoReady;
  },
  get winRate() {
    return latestWinRate;
  },
  get recommendations() {
    return currentMultiRecommendations;
  },
  get maxVisits() {
    return currentMaxVisits;
  },
  set maxVisits(v: number | null) {
    currentMaxVisits = v;
  },
  get boardSize() {
    return currentBoardSize;
  },
  set boardSize(v: number | null) {
    currentBoardSize = v;
  },
  get handicap() {
    return currentHandicap;
  },
  set handicap(v: number | null) {
    currentHandicap = v;
  },
  get moves() {
    return currentMoves;
  },
  set moves(v: string[]) {
    currentMoves = v;
  },
  resetRecommendations() {
    currentMultiRecommendations = [];
  },
});

const rejectAllPendingCommands = (reason: string) => {
  const pending = commandQueue.splice(0, commandQueue.length);
  isProcessingQueue = false;
  for (const task of pending) {
    task.reject(new Error(reason));
  }
};

const processNextCommand = () => {
  if (
    commandQueue.length === 0 ||
    isProcessingQueue ||
    !katagoProcess ||
    !isKatagoReady
  )
    return;
  const task = commandQueue[0];
  if (task.pending) return;
  isProcessingQueue = true;
  task.pending = true;
  try {
    katagoProcess.stdin.write(`${task.command}\n`);
  } catch (err) {
    commandQueue.shift();
    isProcessingQueue = false;
    task.reject(
      err instanceof Error ? err : new Error("Failed writing to KataGo stdin"),
    );
    processNextCommand();
  }
};

export const stopKataGo = () => {
  isShuttingDown = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  rejectAllPendingCommands("KataGo Engine stopped.");
  if (katagoProcess) {
    const proc = katagoProcess;
    katagoProcess = null;
    isKatagoReady = false;
    console.log("Stopping KataGo Engine...");
    proc.kill("SIGTERM");
    // Escalate to SIGKILL if KataGo hangs during shutdown
    setTimeout(() => {
      if (proc.exitCode === null && proc.signalCode === null) {
        try {
          proc.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
    }, 3000).unref();
  }
};

export const startKataGo = () => {
  isShuttingDown = false;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (katagoProcess) {
    const oldProc = katagoProcess;
    katagoProcess = null;
    isKatagoReady = false;
    oldProc.kill("SIGTERM");
  }

  rejectAllPendingCommands("KataGo Engine restarted. Command aborted.");

  const modelPath = path.join(__dirname, "../../katago/katago-model.bin.gz");
  const configPath = path.join(__dirname, "../../katago/gtp_config.cfg");

  console.log("Starting KataGo Engine...");
  const proc = spawn("katago", [
    "gtp",
    "-model",
    modelPath,
    "-config",
    configPath,
  ]);
  katagoProcess = proc;

  responseBuffer = "";
  currentMaxVisits = null;
  currentBoardSize = null;
  currentHandicap = null;
  currentMoves = [];

  // Guard every handler against stale process instances so old exit events never clobber new engine
  proc.on("error", (err) => {
    if (proc !== katagoProcess) return;
    console.error("KataGo process spawn/runtime error:", err.message);
    isKatagoReady = false;
    rejectAllPendingCommands(`KataGo process error: ${err.message}`);
  });

  proc.stdin.on("error", (err) => {
    if (proc !== katagoProcess) return;
    console.warn("KataGo stdin error:", err.message);
  });

  proc.stdout.on("data", (data: Buffer) => {
    if (proc !== katagoProcess) return;
    responseBuffer += data.toString();
    let doubleNewlineIndex = responseBuffer.search(/\n\s*\n/);
    while (doubleNewlineIndex !== -1) {
      const response = responseBuffer.substring(0, doubleNewlineIndex).trim();
      responseBuffer = responseBuffer
        .substring(doubleNewlineIndex)
        .replace(/^\s+/, "");
      if (commandQueue.length > 0 && commandQueue[0].pending) {
        const task = commandQueue.shift()!;
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
  proc.stderr.on("data", (data: Buffer) => {
    if (proc !== katagoProcess) return;
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() || "";
    for (const line of lines) {
      const output = line.trim();
      if (!isKatagoReady && output.includes("GTP ready")) {
        console.log("KataGo Engine is fully loaded and ready.");
        isKatagoReady = true;
        processNextCommand();
      }
      const winrateMatch = output.match(/winrate\s*[:=]?\s*([0-9.]+)/i);
      if (winrateMatch) {
        const raw = parseFloat(winrateMatch[1]);
        // Normalize both 0..1 and 0..100 formats and clamp safely
        const pct = raw <= 1 ? raw * 100 : raw;
        latestWinRate = Math.min(Math.max(pct, 0), 100);
      }

      const rootTreeMatch = output.match(
        /^:\s*T\s+[-+0-9.a-z]+\s+W\s+([-+]?[0-9.]+)([c]?)/i,
      );
      if (rootTreeMatch) {
        currentMultiRecommendations = [];
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

      const moveTreeMatch = output.match(
        /^([A-Z][0-9]{1,2})\s*:\s*T\s+.*?\s+W\s+([-+]?[0-9.]+)([c]?).*?\sN\s+(\d+)/i,
      );
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

  proc.on("exit", (code, signal) => {
    if (proc !== katagoProcess) return;
    katagoProcess = null;
    isKatagoReady = false;
    console.log(`KataGo Process exited with code ${code} and signal ${signal}`);
    if (stderrBuffer) {
      console.log("KataGo stderr before exit:", stderrBuffer);
    }
    rejectAllPendingCommands("KataGo process exited unexpectedly.");

    // Auto-recover from unexpected crashes unless shutting down intentionally
    if (!isShuttingDown) {
      restartTimer = setTimeout(() => {
        restartTimer = null;
        if (!isShuttingDown && !katagoProcess) {
          startKataGo();
        }
      }, 3000);
    }
  });
};

export const sendCommand = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const task: CommandTask = {
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
    };

    // Match by task object identity rather than command string to avoid removing duplicates
    const timeout = setTimeout(() => {
      const index = commandQueue.indexOf(task);
      if (index !== -1) {
        commandQueue.splice(index, 1);
        isProcessingQueue = false;
        console.error(`GTP command timeout: ${command}. Restarting engine...`);
        startKataGo();
        reject(new Error(`GTP command timeout: ${command}`));
      }
    }, 60000);

    commandQueue.push(task);
    if (!isProcessingQueue) processNextCommand();
  });
};

export const enqueueApiTask = (execute: () => Promise<void>): boolean => {
  if (apiRequestQueue.length >= MAX_API_QUEUE_SIZE) {
    return false;
  }
  apiRequestQueue.push({ execute });
  void processApiQueue();
  return true;
};

const processApiQueue = async () => {
  if (isProcessingApiQueue) return;
  isProcessingApiQueue = true;
  while (apiRequestQueue.length > 0) {
    const task = apiRequestQueue.shift()!;
    try {
      await task.execute();
      processedApiCount++;
    } catch (err) {
      console.error("Task failed in queue:", err);
    }
  }
  isProcessingApiQueue = false;
  if (processedApiCount > MAX_API_CALLS_BEFORE_RESTART && !isProcessingQueue) {
    console.log(
      `Processed ${processedApiCount} AI requests. Restarting KataGo to free memory...`,
    );
    processedApiCount = 0;
    startKataGo();
  }
};
