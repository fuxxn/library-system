'use strict';

/**
 * 決策樹分類邏輯
 *
 * 特徵：
 *   total_borrows    — 該借閱者的總借閱次數
 *   top_genre_ratio  — 最常借類型的次數 ÷ 總借閱次數
 *
 * 門檻值由 compute_ig.js 對 20 位種子借閱者的實際資料計算資訊增益（IG）得出：
 *   Layer 1 ：total_borrows   > 11.5   → 重度 vs 輕度  (IG=0.9984)
 *   Layer 2A：top_genre_ratio > 0.5167 → 專注重 vs 博覽重 (IG=1.0000)
 *   Layer 2B：top_genre_ratio > 0.7083 → 專注輕 vs 探索輕 (IG=1.0000)
 *
 * 樹狀結構：
 *   total_borrows > 11.5（重度）
 *     ├─ top_genre_ratio > 0.5167 → 專注型重度讀者
 *     └─ top_genre_ratio ≤ 0.5167 → 博覽型重度讀者
 *   total_borrows ≤ 11.5（輕度）
 *     ├─ top_genre_ratio > 0.7083 → 專注型輕度讀者
 *     └─ top_genre_ratio ≤ 0.7083 → 探索型輕度讀者
 */

// IG 最佳門檻值（由 compute_ig.js 計算，對 20 位種子借閱者準確率 100%）
const THRESHOLD_HEAVY   = 11.5;    // Layer 1：重度/輕度分界
const THRESHOLD_FOCUS_H = 0.5167;  // Layer 2A：專注重/博覽重分界
const THRESHOLD_FOCUS_L = 0.7083;  // Layer 2B：專注輕/探索輕分界

function classify(totalBorrows, topGenreRatio) {
  if (totalBorrows > THRESHOLD_HEAVY) {
    // 重度讀者分支
    if (topGenreRatio > THRESHOLD_FOCUS_H) {
      return {
        type: '專注型重度讀者',
        description: '借閱量大且偏好集中，對特定主題有深度興趣',
        recommendation_strategy: '同類型熱門書',
        color: '#e74c3c',
      };
    } else {
      return {
        type: '博覽型重度讀者',
        description: '借閱量大且廣泛涉獵，喜歡探索各種知識領域',
        recommendation_strategy: '各類型精選一本',
        color: '#e67e22',
      };
    }
  } else {
    // 輕度讀者分支
    if (topGenreRatio > THRESHOLD_FOCUS_L) {
      return {
        type: '專注型輕度讀者',
        description: '借閱量少但偏好集中，有明確的閱讀方向',
        recommendation_strategy: '同類型入門書',
        color: '#3498db',
      };
    } else {
      return {
        type: '探索型輕度讀者',
        description: '借閱量少且類型分散，仍在尋找閱讀興趣',
        recommendation_strategy: '最受歡迎的書',
        color: '#27ae60',
      };
    }
  }
}

module.exports = classify;
