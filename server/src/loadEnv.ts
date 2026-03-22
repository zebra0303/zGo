import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Robust .env loading: check multiple potential locations
const envPaths = [
  path.resolve(__dirname, "../../.env"), // root from dist
  path.resolve(process.cwd(), ".env"), // current working directory
  path.resolve(process.cwd(), "server/.env"),
];

let envFound = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`Loaded environment variables from: ${envPath}`);
    envFound = true;
    break;
  }
}

if (!envFound) {
  console.warn("WARNING: No .env file found in expected locations.");
}
