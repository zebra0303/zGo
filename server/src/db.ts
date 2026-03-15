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

console.log("Connected to the SQLite database at", dbPath);

export default db;
