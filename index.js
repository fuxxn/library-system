'use strict';

const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const classify = require('./decisionTree');
const seed = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 資料庫初始化 ──────────────────────────────────────────────────────────────
const db = new DatabaseSync(path.join(__dirname, 'library.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    title   TEXT NOT NULL,
    genre   TEXT NOT NULL,
    author  TEXT
  );
  CREATE TABLE IF NOT EXISTS borrow_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id       INTEGER NOT NULL REFERENCES books(id),
    borrower_name TEXT NOT NULL,
    borrow_date   DATE NOT NULL
  );
`);

seed(db);

// ── 共用：計算借閱者特徵 ──────────────────────────────────────────────────────
function getBorrowerFeatures(name) {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total_borrows,
      (
        SELECT b2.genre
        FROM borrow_records br2
        JOIN books b2 ON b2.id = br2.book_id
        WHERE br2.borrower_name = ?
        GROUP BY b2.genre
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS top_genre,
      CAST((
        SELECT COUNT(*)
        FROM borrow_records br3
        JOIN books b3 ON b3.id = br3.book_id
        WHERE br3.borrower_name = ?
          AND b3.genre = (
            SELECT b4.genre
            FROM borrow_records br4
            JOIN books b4 ON b4.id = br4.book_id
            WHERE br4.borrower_name = ?
            GROUP BY b4.genre
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
      ) AS REAL) / COUNT(*) AS top_genre_ratio
    FROM borrow_records
    WHERE borrower_name = ?
  `).get(name, name, name, name);

  return row;
}

const VALID_GENRES = ['小說', '科普', '商業', '歷史', '漫畫'];

// ── API: 書籍 ─────────────────────────────────────────────────────────────────

// GET /api/books?genre=小說
app.get('/api/books', (req, res) => {
  const { genre } = req.query;
  if (genre) {
    const books = db.prepare(
      'SELECT * FROM books WHERE genre = ? ORDER BY id'
    ).all(genre);
    return res.json(books);
  }
  res.json(db.prepare('SELECT * FROM books ORDER BY id').all());
});

// POST /api/books  body: { title, genre, author }
app.post('/api/books', (req, res) => {
  const { title, genre, author } = req.body ?? {};
  if (!title || !genre) {
    return res.status(400).json({ error: '書名（title）與類型（genre）為必填' });
  }
  if (!VALID_GENRES.includes(genre)) {
    return res.status(400).json({ error: `類型必須是：${VALID_GENRES.join('、')}` });
  }
  const result = db.prepare(
    'INSERT INTO books (title, genre, author) VALUES (?, ?, ?)'
  ).run(title, genre, author ?? null);
  res.status(201).json({ id: Number(result.lastInsertRowid), title, genre, author: author ?? null });
});

// PUT /api/books/:id  body: { title, genre, author }
app.put('/api/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '找不到該書籍' });

  // fix: 用 !== undefined 而非 ??，避免空字串靜默覆寫現有值
  const title  = req.body?.title  !== undefined ? req.body.title  : existing.title;
  const genre  = req.body?.genre  !== undefined ? req.body.genre  : existing.genre;
  const author = req.body?.author !== undefined ? req.body.author : existing.author;

  if (!title) {
    return res.status(400).json({ error: '書名（title）不能為空' });
  }
  if (!VALID_GENRES.includes(genre)) {
    return res.status(400).json({ error: `類型必須是：${VALID_GENRES.join('、')}` });
  }

  db.prepare('UPDATE books SET title = ?, genre = ?, author = ? WHERE id = ?')
    .run(title, genre, author, id);
  res.json({ id, title, genre, author });
});

// DELETE /api/books/:id
app.delete('/api/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '找不到該書籍' });

  // 先刪借閱紀錄，再刪書籍
  db.prepare('DELETE FROM borrow_records WHERE book_id = ?').run(id);
  db.prepare('DELETE FROM books WHERE id = ?').run(id);
  res.json({ message: '刪除成功', id });
});

// ── API: 借閱紀錄 ─────────────────────────────────────────────────────────────

// POST /api/borrow  body: { book_id, borrower_name, borrow_date }
app.post('/api/borrow', (req, res) => {
  const { book_id, borrower_name, borrow_date } = req.body ?? {};
  if (!book_id || !borrower_name || !borrow_date) {
    return res.status(400).json({ error: 'book_id、borrower_name、borrow_date 均為必填' });
  }
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(Number(book_id));
  if (!book) return res.status(404).json({ error: '找不到該書籍' });

  // fix: 驗證格式 + 語意（拒絕 2024-02-30、9999-99-99 等不存在日期）
  if (!/^\d{4}-\d{2}-\d{2}$/.test(borrow_date)) {
    return res.status(400).json({ error: 'borrow_date 格式應為 YYYY-MM-DD' });
  }
  const parsed = new Date(borrow_date);
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== borrow_date) {
    return res.status(400).json({ error: 'borrow_date 不是有效的日期' });
  }

  const result = db.prepare(
    'INSERT INTO borrow_records (book_id, borrower_name, borrow_date) VALUES (?, ?, ?)'
  ).run(Number(book_id), String(borrower_name).trim(), borrow_date);

  res.status(201).json({ id: Number(result.lastInsertRowid), book_id: Number(book_id), borrower_name, borrow_date });
});

// ── API: 借閱者 ───────────────────────────────────────────────────────────────

// GET /api/borrowers  — 所有不重複的借閱者名稱
app.get('/api/borrowers', (req, res) => {
  const rows = db.prepare(
    'SELECT DISTINCT borrower_name FROM borrow_records ORDER BY borrower_name'
  ).all();
  res.json(rows.map(r => r.borrower_name));
});

// GET /api/borrowers/:name/type  — 分類結果 + 特徵數值
app.get('/api/borrowers/:name/type', (req, res) => {
  const name = req.params.name;
  const features = getBorrowerFeatures(name);

  if (!features || features.total_borrows === 0) {
    return res.status(404).json({ error: '找不到該借閱者的紀錄' });
  }

  // fix: classify 使用原始 ratio（避免四捨五入跨越門檻），回傳欄位才四捨五入至顯示用精度
  const result = classify(features.total_borrows, features.top_genre_ratio);

  res.json({
    borrower_name:   name,
    total_borrows:   features.total_borrows,
    top_genre:       features.top_genre,
    top_genre_ratio: Math.round(features.top_genre_ratio * 100) / 100,
    ...result,
  });
});

// GET /api/borrowers/:name/recommendations  — 推薦書單（3-5 本）
app.get('/api/borrowers/:name/recommendations', (req, res) => {
  const name = req.params.name;
  const features = getBorrowerFeatures(name);

  if (!features || features.total_borrows === 0) {
    return res.status(404).json({ error: '找不到該借閱者的紀錄' });
  }

  // fix: classify 使用原始 ratio
  const { type } = classify(features.total_borrows, features.top_genre_ratio);

  // 已借過的書 id
  const borrowedIds = db.prepare(
    'SELECT DISTINCT book_id FROM borrow_records WHERE borrower_name = ?'
  ).all(name).map(r => r.book_id);

  // fix: 用 ? 佔位符參數化 NOT IN，避免字串拼接；建立帶別名與不帶別名兩種版本
  const ph = borrowedIds.map(() => '?').join(',');
  const excB  = borrowedIds.length ? `AND b.id NOT IN (${ph})` : '';   // 有別名 b
  const excId = borrowedIds.length ? `AND id NOT IN (${ph})` : '';     // 無別名（單表查詢）
  const whereB = borrowedIds.length ? `WHERE b.id NOT IN (${ph})` : ''; // 探索型開頭 WHERE

  let books = [];

  if (type === '專注型重度讀者') {
    // 同類型熱門書（按被借次數排序）
    books = db.prepare(`
      SELECT b.id, b.title, b.genre, b.author, COUNT(br.id) AS borrow_count
      FROM books b
      LEFT JOIN borrow_records br ON br.book_id = b.id
      WHERE b.genre = ? ${excB}
      GROUP BY b.id
      ORDER BY borrow_count DESC
      LIMIT 5
    `).all(features.top_genre, ...borrowedIds);

  } else if (type === '博覽型重度讀者') {
    // 各類型各選一本（按被借次數排序，取第一名）
    for (const g of VALID_GENRES) {
      const book = db.prepare(`
        SELECT b.id, b.title, b.genre, b.author, COUNT(br.id) AS borrow_count
        FROM books b
        LEFT JOIN borrow_records br ON br.book_id = b.id
        WHERE b.genre = ? ${excB}
        GROUP BY b.id
        ORDER BY borrow_count DESC
        LIMIT 1
      `).get(g, ...borrowedIds);
      if (book) books.push(book);
    }

  } else if (type === '專注型輕度讀者') {
    // 同類型入門書（未借過，按被借次數排序）
    books = db.prepare(`
      SELECT b.id, b.title, b.genre, b.author, COUNT(br.id) AS borrow_count
      FROM books b
      LEFT JOIN borrow_records br ON br.book_id = b.id
      WHERE b.genre = ? ${excB}
      GROUP BY b.id
      ORDER BY borrow_count DESC
      LIMIT 5
    `).all(features.top_genre, ...borrowedIds);

    // fix: fallback 仍套用排除條件，不回傳已借過的書
    if (books.length < 3) {
      books = db.prepare(
        `SELECT id, title, genre, author FROM books WHERE genre = ? ${excId} LIMIT 5`
      ).all(features.top_genre, ...borrowedIds);
    }

  } else {
    // 探索型輕度讀者：全站最受歡迎（未借過）
    books = db.prepare(`
      SELECT b.id, b.title, b.genre, b.author, COUNT(br.id) AS borrow_count
      FROM books b
      LEFT JOIN borrow_records br ON br.book_id = b.id
      ${whereB}
      GROUP BY b.id
      ORDER BY borrow_count DESC
      LIMIT 5
    `).all(...borrowedIds);
  }

  res.json(books.slice(0, 5));
});

// ── 啟動伺服器 ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 圖書借閱者分類與推薦系統 → http://localhost:${PORT}`);
});
