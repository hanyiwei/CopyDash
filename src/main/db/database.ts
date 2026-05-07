import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let dbPath: string;
let imagesPath: string;
let db: any;

function updatePaths() {
  dbPath = path.join(app.getPath('userData'), 'copydash.db');
  imagesPath = path.join(app.getPath('userData'), 'images');
  
  // Ensure images directory exists
  if (!fs.existsSync(imagesPath)) {
    fs.mkdirSync(imagesPath, { recursive: true });
  }
}

async function initDB() {
  updatePaths();
  try {
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
        console.log('Database loaded from:', dbPath);
      } catch (err) {
        console.error('Failed to load database, creating new one:', err);
        db = new SQL.Database();
        initSchema();
      }
    } else {
      console.log('Database file not found, creating new one');
      db = new SQL.Database();
      initSchema();
    }
  } catch (err) {
    console.error('Failed to initialize SQL.js:', err);
    throw err;
  }
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS clip_history ( 
        id            TEXT PRIMARY KEY,          
        type          INTEGER NOT NULL,         -- 0=内部哨兵(不存储), 1=文本, 2=图片, 4=文件
        content_text  TEXT,
        content_html  TEXT,                     -- 富文本源码(仅type=1且从网页复制时存储)
        image_path    TEXT,                     
        thumbnail     TEXT,                     
        source_app    TEXT,                     
        source_icon   TEXT,                     
        has_color     INTEGER DEFAULT 0,        
        color_hex     TEXT,                     
        color_rgb     TEXT,                     
        is_pinned     INTEGER DEFAULT 0,        
        created_at    TEXT NOT NULL,            
        content_hash  TEXT NOT NULL UNIQUE      
    ); 

    CREATE INDEX IF NOT EXISTS idx_clip_created ON clip_history(created_at DESC); 
    CREATE INDEX IF NOT EXISTS idx_clip_pinned ON clip_history(is_pinned) WHERE is_pinned = 1; 

    CREATE TABLE IF NOT EXISTS settings ( 
        key   TEXT PRIMARY KEY, 
        value TEXT NOT NULL 
    ); 

    INSERT OR IGNORE INTO settings (key, value) VALUES ('max_history', '200');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut_toggle', 'Alt+Shift+V');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut_paste_plain', 'Shift');
  `);
  saveDB();
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Helper to run queries with persistence
export const dbQuery = {
  run: (sql: string, params: any[] = []) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }
    try {
      if (params.length > 0) {
        db.run(sql, params);
      } else {
        db.run(sql);
      }
      saveDB();
    } catch (err) {
      console.error('DB Run Error:', err, 'SQL:', sql, 'Params:', params);
    }
  },
  cleanup: (maxHistory: number) => {
    if (!db) return;
    // Delete non-pinned items beyond maxHistory
    // ORDER BY is_pinned DESC ensures pinned items count toward LIMIT but are
    // never deleted (outer WHERE is_pinned = 0). Pinned items are always retained.
    db.run(`
      DELETE FROM clip_history 
      WHERE is_pinned = 0 
      AND id NOT IN (
        SELECT id FROM clip_history 
        ORDER BY is_pinned DESC, created_at DESC 
        LIMIT ?
      )
    `, [maxHistory]);
    saveDB();
  },
  all: (sql: string, params: any[] = []) => {
    if (!db) {
      console.error('Database not initialized');
      return [];
    }
    try {
      const stmt = db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('DB All Error:', err, 'SQL:', sql, 'Params:', params);
      return [];
    }
  },
  get: (sql: string, params: any[] = []) => {
    if (!db) {
      console.error('Database not initialized');
      return null;
    }
    try {
      const stmt = db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    } catch (err) {
      console.error('DB Get Error:', err, 'SQL:', sql, 'Params:', params);
      return null;
    }
  }
};

export { initDB, imagesPath };
