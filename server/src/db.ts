import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

const sqlite = sqlite3.verbose();

const dbDir = path.resolve(__dirname, "../database");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "zgo.db");
const db = new sqlite.Database(dbPath, (err) => {
  if (err) console.error("DB Connection Error:", err.message);
  else console.log("Connected to the SQLite database at", dbPath);
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

export default db;
