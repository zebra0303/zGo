import { BoardState, PlayerColor } from "@/shared/types/board";

export interface HistoryNode {
  id: string;
  x: number | null; // null for pass or initial node
  y: number | null;
  color: PlayerColor | null;
  board: BoardState;
  capturedByBlack: number;
  capturedByWhite: number;
  winRate: number;
  children: HistoryNode[];
  parent: HistoryNode | null;
  moveIndex: number;
}

export interface GameState {
  board: BoardState;
  currentPlayer: PlayerColor;
  isTeacherMode: boolean;

  // Tree-based History
  gameTree: HistoryNode;
  currentNode: HistoryNode;

  // Game Settings
  gameMode: "PvP" | "PvAI" | "Online";
  aiDifficulty: number;
  humanPlayerColor: PlayerColor;
  language: "ko" | "en";
  boardSize: number;
  handicap: number;

  // Game Status
  consecutivePasses: number;
  isGameOver: boolean;
  isReviewMode: boolean;
  showDeadStones: boolean;
  boardScale: number;
  soundEnabled: boolean;
  soundVolume: number;
  teacherVisits: number;
  ignoredRecommendation: { x: number; y: number }[] | null;
  teacherCritique: string | null;
  deadStones: { x: number; y: number }[] | null;
  reviewChat: {
    chat: { sender: string; message: string; createdAt: string }[];
    hostNickname?: string;
    hostCharacter?: string;
    guestNickname?: string;
    guestCharacter?: string;
  } | null;
  gameResultText: string | null;
  winner: PlayerColor | "DRAW" | null;
  isScoring: boolean;
  isAnalyzing: boolean;
  analysisProgress: { current: number; total: number } | null;
  undoUsedInGame: boolean;
  aiForceTurnCounter: number;

  placeStone: (x: number, y: number) => void;
  passTurn: () => void;
  resignGame: () => void;
  toggleTeacherMode: () => void;
  toggleDeadStones: () => void;
  setTeacherCritique: (c: string | null) => void;
  setDeadStones: (stones: { x: number; y: number }[] | null) => void;
  setGameResultText: (text: string | null) => void;
  setWinner: (winner: PlayerColor | "DRAW" | null) => void;
  setIsScoring: (isScoring: boolean) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setAnalysisProgress: (
    progress: { current: number; total: number } | null,
  ) => void;
  forceAITurn: () => void;
  undoMove: () => void;
  goToPreviousMove: () => void;
  goToNextMove: (variationIndex?: number) => void;
  setMoveIndex: (index: number) => void;
  setCurrentNode: (nodeId: string) => void;
  updateWinRate: (nodeId: string, winRate: number) => void;
  updateWinRates: (updates: { nodeId: string; winRate: number }[]) => void;
  loadMatch: (
    moves: ({ x: number; y: number } | null)[],
    winRates?: number[],
    resultText?: string,
    savedBoardSize?: number,
    savedHandicap?: number,
    winner?: PlayerColor | "DRAW" | null,
    reviewChat?: GameState["reviewChat"],
  ) => void;
  setGameConfig: (
    config: Partial<
      Pick<
        GameState,
        | "gameMode"
        | "aiDifficulty"
        | "humanPlayerColor"
        | "boardScale"
        | "soundEnabled"
        | "soundVolume"
        | "teacherVisits"
        | "language"
        | "boardSize"
        | "handicap"
      >
    >,
  ) => void;
  setIgnoredRecommendation: (coords: { x: number; y: number }[] | null) => void;
  resetGame: () => void;
}
