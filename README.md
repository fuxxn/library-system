# 圖書借閱者分類與推薦系統

## 環境需求

- Node.js **v22.5.0 以上**（使用內建 `node:sqlite`，不需額外安裝資料庫驅動）

## 啟動方式

```bash
npm install
node index.js
```

瀏覽器開啟 → http://localhost:3000

## 專案結構

```
library-system/
├── index.js          # Express 主程式、API 路由
├── decisionTree.js   # 決策樹分類邏輯（classify 函式）
├── seed.js           # 種子資料（50 本書、20 位借閱者、~200 筆紀錄）
├── library.db        # SQLite 資料庫（首次啟動自動建立）
├── package.json
└── public/
    └── index.html    # 前端單頁應用（Vanilla JS）
```

## API 端點

| 方法   | 路徑                                  | 說明                                        |
|--------|---------------------------------------|---------------------------------------------|
| GET    | /api/books                            | 取得所有書籍，支援 `?genre=小說` 篩選       |
| POST   | /api/books                            | 新增書籍 `{ title, genre, author }`         |
| PUT    | /api/books/:id                        | 修改書籍                                    |
| DELETE | /api/books/:id                        | 刪除書籍（連同借閱紀錄）                    |
| POST   | /api/borrow                           | 新增借閱紀錄 `{ book_id, borrower_name, borrow_date }` |
| GET    | /api/borrowers                        | 取得所有不重複的借閱者名稱                  |
| GET    | /api/borrowers/:name/type             | 回傳分類結果與特徵數值                      |
| GET    | /api/borrowers/:name/recommendations  | 依分類回傳推薦書單（3-5 本）                |

## 決策樹邏輯

位於 `decisionTree.js`，門檻值由 `compute_ig.js` 對 20 位種子借閱者實際計算**資訊增益（Information Gain）**得出：

```
total_borrows > 11.5（重度讀者，IG=0.9984）
  ├─ top_genre_ratio > 0.5167 → 專注型重度讀者（推薦：同類型熱門書）
  └─ top_genre_ratio ≤ 0.5167 → 博覽型重度讀者（推薦：各類型精選一本）
total_borrows ≤ 11.5（輕度讀者）
  ├─ top_genre_ratio > 0.7083 → 專注型輕度讀者（推薦：同類型入門書，IG=1.0000）
  └─ top_genre_ratio ≤ 0.7083 → 探索型輕度讀者（推薦：最受歡迎的書，IG=1.0000）
```

### 資訊增益計算（進階功能）

執行 `node compute_ig.js` 可對以下 4 個候選特徵自動掃描最佳門檻：

| 特徵 | 說明 |
|------|------|
| `total_borrows` | 總借閱次數 |
| `top_genre_ratio` | 偏好集中度（最多類型次數 ÷ 總借閱次數） |
| `distinct_books` | 借過的不同書籍數 |
| `avg_interval` | 平均借閱間隔天數 |

計算結果存入 `ig_result.json`，並自動驗證對 20 位種子借閱者的分類準確率（100%）。

## 種子資料說明

| 類型             | 人數 | 借閱次數  | 偏好集中度     |
|-----------------|------|-----------|----------------|
| 專注型重度讀者   | 5    | 16–24 次  | ≥ 85%（同一類型）|
| 博覽型重度讀者   | 5    | 15–25 次  | ~20%（均衡分散）|
| 專注型輕度讀者   | 5    | 4–8 次   | ≥ 85%（同一類型）|
| 探索型輕度讀者   | 5    | 3–7 次   | ≤ 40%（類型分散）|
