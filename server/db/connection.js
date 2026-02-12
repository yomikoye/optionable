import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Data directory - uses /data in Docker, ./data locally
const DATA_DIR = process.env.DATA_DIR || './data';
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
export const dbPath = join(DATA_DIR, 'optionable.db');
export const db = new Database(dbPath);

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');

// Foreign keys disabled during migrations, enabled after
db.pragma('foreign_keys = OFF');
