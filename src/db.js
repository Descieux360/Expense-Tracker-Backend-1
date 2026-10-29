const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'expenses.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'expense',
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL
  );
`);

// Upgrade an older database that was created before the "type" column existed
const columns = db.prepare('PRAGMA table_info(expenses)').all();
if (!columns.some((c) => c.name === 'type')) {
  db.exec("ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'");
}

module.exports = db;