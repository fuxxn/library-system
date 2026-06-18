'use strict';
/**
 * 資訊增益（Information Gain）分析腳本
 *
 * 針對種子資料的 20 位借閱者，計算 4 個候選特徵在各層節點的 IG，
 * 找出最佳特徵 + 最佳門檻值，取代手動設定的 10 次 / 70% 門檻。
 *
 * 執行：node compute_ig.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'library.db'));

// ── Step 1：從 DB 計算每位借閱者的 4 個候選特徵 ──────────────────────────────

const rawData = db.prepare(`
  SELECT
    br.borrower_name,
    COUNT(*) AS total_borrows,
    COUNT(DISTINCT br.book_id) AS distinct_books,
    CAST((
      SELECT COUNT(*)
      FROM borrow_records br3
      JOIN books b3 ON b3.id = br3.book_id
      WHERE br3.borrower_name = br.borrower_name
        AND b3.genre = (
          SELECT b4.genre
          FROM borrow_records br4
          JOIN books b4 ON b4.id = br4.book_id
          WHERE br4.borrower_name = br.borrower_name
          GROUP BY b4.genre
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )
    ) AS REAL) / COUNT(*) AS top_genre_ratio
  FROM borrow_records br
  GROUP BY br.borrower_name
  ORDER BY total_borrows DESC
`).all();

// 計算「平均借閱間隔天數」（用 distinct 日期排序後相鄰差的平均）
for (const b of rawData) {
  const dates = db.prepare(`
    SELECT DISTINCT borrow_date FROM borrow_records
    WHERE borrower_name = ?
    ORDER BY borrow_date
  `).all(b.borrower_name).map(r => new Date(r.borrow_date).getTime());

  if (dates.length < 2) {
    b.avg_interval = 0;
  } else {
    let total = 0;
    for (let i = 1; i < dates.length; i++) {
      total += (dates[i] - dates[i - 1]) / 86_400_000;   // 毫秒 → 天
    }
    b.avg_interval = total / (dates.length - 1);
  }
}

// ── Step 2：附上已知真實標籤（從種子資料設計得知）───────────────────────────
const GROUND_TRUTH = {
  '王大明': 'FH', '林小芳': 'FH', '陳志偉': 'FH', '張美玲': 'FH', '李建宏': 'FH',
  '吳雅惠': 'WH', '黃俊傑': 'WH', '劉淑貞': 'WH', '蔡文豪': 'WH', '徐雅君': 'WH',
  '周冠廷': 'FL', '鄭佳穎': 'FL', '許志勝': 'FL', '蕭婷婷': 'FL', '謝宗翰': 'FL',
  '盧建志': 'SL', '江怡君': 'SL', '洪嘉豪': 'SL', '游雅婷': 'SL', '柯俊宏': 'SL',
};
// FH=專注型重度  WH=博覽型重度  FL=專注型輕度  SL=探索型輕度

const data = rawData.map(b => ({ ...b, label: GROUND_TRUTH[b.borrower_name] }));

// ── Step 3：Information Gain 計算函式 ────────────────────────────────────────

function entropy(labels) {
  if (!labels.length) return 0;
  const cnt = {};
  for (const l of labels) cnt[l] = (cnt[l] || 0) + 1;
  let h = 0;
  for (const c of Object.values(cnt)) {
    const p = c / labels.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function computeIG(subset, feature, threshold, classOf) {
  const labels = subset.map(classOf);
  const H      = entropy(labels);
  const left   = subset.filter(d => d[feature] <= threshold);
  const right  = subset.filter(d => d[feature] >  threshold);
  if (!left.length || !right.length) return 0;
  const n = subset.length;
  return H
    - (left.length  / n) * entropy(left.map(classOf))
    - (right.length / n) * entropy(right.map(classOf));
}

function bestSplit(subset, feature, classOf) {
  // 嘗試每個相鄰值的中點作為門檻
  const vals = [...new Set(subset.map(d => d[feature]))].sort((a, b) => a - b);
  let best = { ig: -Infinity, threshold: null };
  for (let i = 0; i < vals.length - 1; i++) {
    const t  = (vals[i] + vals[i + 1]) / 2;
    const ig = computeIG(subset, feature, t, classOf);
    if (ig > best.ig) best = { ig, threshold: t };
  }
  return best;
}

const FEATURES = [
  { key: 'total_borrows',   label: '總借閱次數',        unit: '次' },
  { key: 'top_genre_ratio', label: '偏好集中度（ratio）', unit: '' },
  { key: 'distinct_books',  label: '借過的不同書籍數',   unit: '本' },
  { key: 'avg_interval',    label: '平均借閱間隔',       unit: '天' },
];

function analyzeLayer(title, subset, classOf) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));

  const rows = FEATURES.map(f => {
    const r = bestSplit(subset, f.key, classOf);
    return { ...f, ...r };
  }).sort((a, b) => b.ig - a.ig);

  for (const r of rows) {
    const t = r.threshold != null ? r.threshold.toFixed(3) : '—';
    const bar = '█'.repeat(Math.round(r.ig * 20));
    console.log(`  ${r.label.padEnd(20)}  門檻=${t.padStart(7)}${r.unit.padEnd(3)}  IG=${r.ig.toFixed(4)}  ${bar}`);
  }
  const best = rows[0];
  console.log(`\n  ★ 最佳：${best.label}，門檻 = ${best.threshold?.toFixed(3)} ${best.unit}，IG = ${best.ig.toFixed(4)}`);
  return best;
}

// ── Step 4：顯示原始特徵數值（方便核對） ─────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('  原始特徵數值（20 位借閱者）');
console.log('═'.repeat(60));
console.log('  姓名    類型  總次  distinct  ratio  間隔(天)');
const TYPE_SHORT = { FH:'專注重', WH:'博覽重', FL:'專注輕', SL:'探索輕' };
for (const d of data) {
  console.log(
    `  ${d.borrower_name.padEnd(4)} ${TYPE_SHORT[d.label]}` +
    `  ${String(d.total_borrows).padStart(4)}` +
    `  ${String(d.distinct_books).padStart(8)}` +
    `  ${d.top_genre_ratio.toFixed(2).padStart(6)}` +
    `  ${d.avg_interval.toFixed(1).padStart(8)}`
  );
}

// ── Step 5：逐層分析 ──────────────────────────────────────────────────────────

// Layer 1：全部 20 人，重度（FH/WH）vs 輕度（FL/SL）
const best1 = analyzeLayer(
  'Layer 1：重度讀者 vs 輕度讀者（全部 20 人）',
  data,
  d => ['FH', 'WH'].includes(d.label) ? 'heavy' : 'light'
);

// Layer 2A：重度子集（10 人），專注（FH）vs 博覽（WH）
const heavySide = data.filter(d => ['FH', 'WH'].includes(d.label));
const best2A = analyzeLayer(
  'Layer 2A：專注型重度 vs 博覽型重度（重度子集 10 人）',
  heavySide,
  d => d.label === 'FH' ? 'focused' : 'wide'
);

// Layer 2B：輕度子集（10 人），專注（FL）vs 探索（SL）
const lightSide = data.filter(d => ['FL', 'SL'].includes(d.label));
const best2B = analyzeLayer(
  'Layer 2B：專注型輕度 vs 探索型輕度（輕度子集 10 人）',
  lightSide,
  d => d.label === 'FL' ? 'focused' : 'scattered'
);

// ── Step 6：用計算出的門檻驗證分類正確率 ─────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('  驗證：用最佳門檻重新分類全部 20 位借閱者');
console.log('═'.repeat(60));

function classifyWithIG(d) {
  const isHeavy = d[best1.key] > best1.threshold;
  if (isHeavy) {
    return d[best2A.key] > best2A.threshold ? 'FH' : 'WH';
  } else {
    return d[best2B.key] > best2B.threshold ? 'FL' : 'SL';
  }
}

const TYPE_NAME = { FH:'專注型重度讀者', WH:'博覽型重度讀者', FL:'專注型輕度讀者', SL:'探索型輕度讀者' };
let correct = 0;
for (const d of data) {
  const pred = classifyWithIG(d);
  const ok   = pred === d.label;
  if (ok) correct++;
  const mark = ok ? '✅' : '❌';
  console.log(`  ${mark} ${d.borrower_name.padEnd(4)} | 預測：${TYPE_NAME[pred]} | 正確：${TYPE_NAME[d.label]}`);
}
console.log(`\n  準確率：${correct} / ${data.length} = ${(correct / data.length * 100).toFixed(0)}%`);

// ── Step 7：輸出最終建議門檻 ─────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('  最終建議：更新 decisionTree.js 的門檻值');
console.log('═'.repeat(60));
console.log(`\n  Layer 1  特徵：${best1.label}`);
console.log(`           門檻：${best1.key} > ${best1.threshold?.toFixed(2)}`);
console.log(`           IG  ：${best1.ig.toFixed(4)}`);
console.log(`\n  Layer 2A 特徵：${best2A.label}`);
console.log(`           門檻：${best2A.key} > ${best2A.threshold?.toFixed(2)}`);
console.log(`           IG  ：${best2A.ig.toFixed(4)}`);
console.log(`\n  Layer 2B 特徵：${best2B.label}`);
console.log(`           門檻：${best2B.key} > ${best2B.threshold?.toFixed(2)}`);
console.log(`           IG  ：${best2B.ig.toFixed(4)}\n`);

// 把結果存回 JSON 方便主程式讀取
const result = {
  layer1:  { feature: best1.key,  threshold: best1.threshold,  ig: best1.ig  },
  layer2A: { feature: best2A.key, threshold: best2A.threshold, ig: best2A.ig },
  layer2B: { feature: best2B.key, threshold: best2B.threshold, ig: best2B.ig },
};

const fs = require('fs');
fs.writeFileSync(
  path.join(__dirname, 'ig_result.json'),
  JSON.stringify(result, null, 2)
);
console.log('  已將結果寫入 ig_result.json\n');
