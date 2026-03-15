import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbDir = path.resolve(__dirname, "../database");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "zgo.db");
const db: InstanceType<typeof Database> = new Database(dbPath);

// perf: WAL mode for concurrent reads
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  aiDifficulty INTEGER,
  humanColor TEXT,
  winner TEXT,
  date TEXT NOT NULL,
  sgfData TEXT NOT NULL
)`);

// refactor: system_settings for auth + admin config
db.exec(`CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`);

// Online rooms for multiplayer
db.exec(`CREATE TABLE IF NOT EXISTS online_rooms (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'waiting',
  board_size INTEGER NOT NULL DEFAULT 19,
  handicap INTEGER NOT NULL DEFAULT 0,
  host_nickname TEXT NOT NULL,
  host_character TEXT NOT NULL,
  host_color TEXT NOT NULL DEFAULT 'BLACK',
  guest_nickname TEXT,
  guest_character TEXT,
  moves TEXT DEFAULT '[]',
  current_player TEXT DEFAULT 'BLACK',
  undo_host_used INTEGER DEFAULT 0,
  undo_guest_used INTEGER DEFAULT 0,
  winner TEXT,
  result_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

db.exec(`CREATE TABLE IF NOT EXISTS online_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES online_rooms(id)
)`);

console.log("Connected to the SQLite database at", dbPath);

export default db;
