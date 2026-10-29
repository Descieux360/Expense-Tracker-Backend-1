const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function validateEntry(body) {
  const { type, title, amount, category, date } = body;

  if (!['income', 'expense'].includes(type)) return 'Type must be income or expense';
  if (!title || !title.trim()) return 'Title is required';
  if (amount === undefined || amount === '' || isNaN(Number(amount)) || Number(amount) <= 0) {
    return 'Amount must be a number greater than 0';
  }
  if (!category || !category.trim()) return 'Category is required';
  if (!date || isNaN(Date.parse(date))) return 'A valid date is required (YYYY-MM-DD)';

  return null;
}

// GET /api/expenses/summary  (must come BEFORE '/:id' routes)
router.get('/summary', (req, res) => {
  const totals = db
    .prepare('SELECT type, SUM(amount) AS total FROM expenses WHERE user_id = ? GROUP BY type')
    .all(req.userId);

  const income = totals.find((t) => t.type === 'income')?.total || 0;
  const spent = totals.find((t) => t.type === 'expense')?.total || 0;

  // Category breakdown is for expenses only
  const categories = db
    .prepare(
      `SELECT category, SUM(amount) AS total, COUNT(*) AS count
       FROM expenses
       WHERE user_id = ? AND type = 'expense'
       GROUP BY category
       ORDER BY total DESC`
    )
    .all(req.userId);

  res.json({ income, spent, balance: income - spent, grandTotal: spent, categories });
});

// GET /api/expenses?type=income&category=Salary
router.get('/', (req, res) => {
  const { type, category } = req.query;

  let sql = 'SELECT * FROM expenses WHERE user_id = ?';
  const params = [req.userId];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY date DESC, id DESC';

  res.json(db.prepare(sql).all(...params));
});

// POST /api/expenses
router.post('/', (req, res) => {
  const error = validateEntry(req.body);
  if (error) return res.status(400).json({ error });

  const { type, title, amount, category, date } = req.body;
  const result = db
    .prepare(
      'INSERT INTO expenses (user_id, type, title, amount, category, date) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(req.userId, type, title.trim(), Number(amount), category.trim(), date);

  const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/expenses/:id
router.put('/:id', (req, res) => {
  const error = validateEntry(req.body);
  if (error) return res.status(400).json({ error });

  const { type, title, amount, category, date } = req.body;
  const result = db
    .prepare(
      `UPDATE expenses SET type = ?, title = ?, amount = ?, category = ?, date = ?
       WHERE id = ? AND user_id = ?`
    )
    .run(type, title.trim(), Number(amount), category.trim(), date, req.params.id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id));
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  res.json({ message: 'Entry deleted' });
});

module.exports = router;