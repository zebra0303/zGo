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
let commandQueue: CommandTask[] = [];
let isProcessingQueue = false;
let responseBuffer = "";
let latestWinRate = 50.0;
let currentMultiRecommendations: MoveRecommendation[] = [];
let currentMaxVisits: number | null = null;

// API queue state
const apiRequestQueue: { execute: () => Promise<void> }[] = [];
let isProcessingApiQueue = false;
let processedApiCount = 0;
const MAX_API_CALLS_BEFORE_RESTART = 10000;

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
  resetRecommendations() {
    currentMultiRecommendations = [];
  },
});

const processNextCommand = () => {
  if (commandQueue.length === 0 || isProcessingQueue || !katagoProcess) return;
  const task = commandQueue[0];
  if (task.pending) return;
  isProcessingQueue = true;
  task.pending = true;
  katagoProcess.stdin.write(`${task.command}\n`);
};

export const startKataGo = () => {
  if (katagoProcess) {
    katagoProcess.kill();
    isKatagoReady = false;
  }

  const modelPath = path.join(__dirname, "../katago/katago-model.bin.gz");
  const configPath = path.join(__dirname, "../katago/gtp_config.cfg");

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

  katagoProcess.stdout.on("data", (data: Buffer) => {
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
  katagoProcess.stderr.on("data", (data: Buffer) => {
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() || "";
    for (const line of lines) {
      const output = line.trim();
      if (!isKatagoReady && output.includes("GTP ready")) {
        console.log("KataGo Engine is fully loaded and ready.");
        isKatagoReady = true;
      }
      const winrateMatch = output.match(/winrate\s*[:=]?\s*([0-9.]+)/i);
      if (winrateMatch) latestWinRate = parseFloat(winrateMatch[1]) * 100;

      const rootTreeMatch = output.match(
        /^:\s*T\s+[-+0-9.a-z]+\s+W\s+([-+]?[0-9.]+)([c]?)/i,
      );
      if (rootTreeMatch) {
        currentMultiRecommendations = [];
        let utility = parseFloat(rootTreeMatch[1]);
        if (rootTreeMatch[2] === "c") utility /= 100;
        latestWinRate = Math.min(
          Math.max(((utility + 1) / 2) * 100, 0),
          100,
        );
      } else {
        const treeMatch = output.match(
          /:\s*T\s+[-+0-9.a-z]+\s+W\s+([-+]?[0-9.]+)([c]?)/i,
        );
        if (treeMatch) {
          let utility = parseFloat(treeMatch[1]);
          if (treeMatch[2] === "c") utility /= 100;
          latestWinRate = Math.min(
            Math.max(((utility + 1) / 2) * 100, 0),
            100,
          );
        }
      }

      const moveTreeMatch = output.match(
        /^([A-Z][0-9]{1,2})\s*:\s*T\s+.*?\s+W\s+([-+]?[0-9.]+)([c]?).*?\sN\s+(\d+)/i,
      );
      if (moveTreeMatch) {
        let utility = parseFloat(moveTreeMatch[2]);
        if (moveTreeMatch[3] === "c") utility /= 100;
        const winrate = Math.min(
          Math.max(((utility + 1) / 2) * 100, 0),
          100,
        );
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

export const sendCommand = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = commandQueue.findIndex((t) => t.command === command);
      if (index !== -1) {
        commandQueue.splice(index, 1);
        isProcessingQueue = false;
        console.error(
          `GTP command timeout: ${command}. Restarting engine...`,
        );
        startKataGo();
        reject(new Error(`GTP command timeout: ${command}`));
      }
    }, 60000);
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

export const enqueueApiTask = (execute: () => Promise<void>) => {
  apiRequestQueue.push({ execute });
  processApiQueue();
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
  if (
    processedApiCount > MAX_API_CALLS_BEFORE_RESTART &&
    !isProcessingQueue
  ) {
    console.log(
      `Processed ${processedApiCount} AI requests. Restarting KataGo to free memory...`,
    );
    processedApiCount = 0;
    startKataGo();
  }
};

// Expose for analyze-game endpoint which needs direct queue control
export const getApiQueueState = () => ({
  get isProcessing() {
    return isProcessingApiQueue;
  },
  set isProcessing(v: boolean) {
    isProcessingApiQueue = v;
  },
  triggerProcess() {
    processApiQueue();
  },
});
