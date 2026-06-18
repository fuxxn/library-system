'use strict';

const BOOKS = [
  // 小說 × 10
  { title: '百年孤寂',           genre: '小說', author: '賈西亞·馬奎斯' },
  { title: '挪威的森林',         genre: '小說', author: '村上春樹' },
  { title: '1984',               genre: '小說', author: '喬治·歐威爾' },
  { title: '了不起的蓋茲比',     genre: '小說', author: '費茲傑羅' },
  { title: '傲慢與偏見',         genre: '小說', author: '珍·奧斯汀' },
  { title: '魔戒',               genre: '小說', author: '托爾金' },
  { title: '追風箏的孩子',       genre: '小說', author: '卡勒德·胡賽尼' },
  { title: '哈利波特：神秘的魔法石', genre: '小說', author: 'J.K.羅琳' },
  { title: '解憂雜貨店',         genre: '小說', author: '東野圭吾' },
  { title: '小王子',             genre: '小說', author: '聖修伯里' },
  // 科普 × 10
  { title: '時間簡史',           genre: '科普', author: '史蒂芬·霍金' },
  { title: '人類大歷史',         genre: '科普', author: '尤瓦爾·赫拉利' },
  { title: '物種起源',           genre: '科普', author: '查爾斯·達爾文' },
  { title: '費曼物理學講義',     genre: '科普', author: '理查·費曼' },
  { title: '萬物簡史',           genre: '科普', author: '比爾·布萊森' },
  { title: '上帝擲骰子嗎',       genre: '科普', author: '曹天元' },
  { title: '基因：人類最親密的歷史', genre: '科普', author: '悉達多·穆克吉' },
  { title: '宇宙的結構',         genre: '科普', author: '布萊恩·格林' },
  { title: '果殼中的宇宙',       genre: '科普', author: '史蒂芬·霍金' },
  { title: '大腦解密手冊',       genre: '科普', author: '大衛·伊葛門' },
  // 商業 × 10
  { title: '從A到A+',            genre: '商業', author: '詹姆·柯林斯' },
  { title: '精實創業',           genre: '商業', author: '艾瑞克·萊斯' },
  { title: '誰說人是理性的',     genre: '商業', author: '丹·艾瑞利' },
  { title: '窮爸爸富爸爸',       genre: '商業', author: '羅伯特·清崎' },
  { title: '引爆趨勢',           genre: '商業', author: '麥爾坎·葛拉威爾' },
  { title: '零到一',             genre: '商業', author: '彼得·提爾' },
  { title: '影響力',             genre: '商業', author: '羅伯特·席爾迪尼' },
  { title: '快思慢想',           genre: '商業', author: '丹尼爾·康納曼' },
  { title: '執行力',             genre: '商業', author: '麥克切斯尼' },
  { title: '財務自由',           genre: '商業', author: '葛蘭特·薩巴提爾' },
  // 歷史 × 10
  { title: '史記',               genre: '歷史', author: '司馬遷' },
  { title: '槍炮、病菌與鋼鐵',  genre: '歷史', author: '賈德·戴蒙' },
  { title: '羅馬帝國衰亡史',     genre: '歷史', author: '愛德華·吉本' },
  { title: '明朝那些事兒',       genre: '歷史', author: '當年明月' },
  { title: '中國近代史',         genre: '歷史', author: '蔣廷黻' },
  { title: '歐洲史',             genre: '歷史', author: '諾曼·戴維斯' },
  { title: '二戰史',             genre: '歷史', author: '約翰·濟普斯' },
  { title: '台灣史100件大事',    genre: '歷史', author: '蕭阿勤' },
  { title: '漢書',               genre: '歷史', author: '班固' },
  { title: '文明的衝突',         genre: '歷史', author: '亨廷頓' },
  // 漫畫 × 10
  { title: '進擊的巨人',         genre: '漫畫', author: '諫山創' },
  { title: '鬼滅之刃',           genre: '漫畫', author: '吾峠呼世晴' },
  { title: '海賊王',             genre: '漫畫', author: '尾田榮一郎' },
  { title: '火影忍者',           genre: '漫畫', author: '岸本齊史' },
  { title: '龍珠',               genre: '漫畫', author: '鳥山明' },
  { title: '死神BLEACH',         genre: '漫畫', author: '久保帶人' },
  { title: '全職獵人',           genre: '漫畫', author: '冨樫義博' },
  { title: '鋼之鍊金術師',       genre: '漫畫', author: '荒川弘' },
  { title: '咒術迴戰',           genre: '漫畫', author: '芥見下下' },
  { title: '我的英雄學院',       genre: '漫畫', author: '堀越耕平' },
];

// 20 位借閱者，依分類設計借閱行為
// 決策樹閾值：total_borrows >= 10 為重度；top_genre_ratio >= 0.7 為專注型
const BORROWERS = [
  // ── 專注型重度讀者（total>=10, ratio>=0.7）──
  // 借閱 17~21 次，同一類型佔 85%
  { name: '王大明',   type: 'focused_heavy', total: 20, focus: '小說' },
  { name: '林小芳',   type: 'focused_heavy', total: 22, focus: '科普' },
  { name: '陳志偉',   type: 'focused_heavy', total: 18, focus: '漫畫' },
  { name: '張美玲',   type: 'focused_heavy', total: 24, focus: '歷史' },
  { name: '李建宏',   type: 'focused_heavy', total: 16, focus: '商業' },

  // ── 博覽型重度讀者（total>=10, ratio<0.7）──
  // 各類型各借 20% 左右，均衡分布
  { name: '吳雅惠',   type: 'wide_heavy',    total: 20 },
  { name: '黃俊傑',   type: 'wide_heavy',    total: 25 },
  { name: '劉淑貞',   type: 'wide_heavy',    total: 15 },
  { name: '蔡文豪',   type: 'wide_heavy',    total: 20 },
  { name: '徐雅君',   type: 'wide_heavy',    total: 20 },

  // ── 專注型輕度讀者（total<10, ratio>=0.7）──
  // 借閱 4~8 次，同一類型佔 85%
  { name: '周冠廷',   type: 'focused_light', total: 7,  focus: '漫畫' },
  { name: '鄭佳穎',   type: 'focused_light', total: 5,  focus: '小說' },
  { name: '許志勝',   type: 'focused_light', total: 8,  focus: '商業' },
  { name: '蕭婷婷',   type: 'focused_light', total: 4,  focus: '科普' },
  { name: '謝宗翰',   type: 'focused_light', total: 6,  focus: '歷史' },

  // ── 探索型輕度讀者（total<10, ratio<0.7）──
  // 各類型均衡分布（≤2次），最高佔比遠低於 0.7
  { name: '盧建志',   type: 'scattered_light', total: 5 },
  { name: '江怡君',   type: 'scattered_light', total: 7 },
  { name: '洪嘉豪',   type: 'scattered_light', total: 5 },
  { name: '游雅婷',   type: 'scattered_light', total: 6 },
  { name: '柯俊宏',   type: 'scattered_light', total: 3 },
];

const GENRES = ['小說', '科普', '商業', '歷史', '漫畫'];

function randDate() {
  const s = new Date('2023-01-01').getTime();
  const e = new Date('2024-12-31').getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().slice(0, 10);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM books').get().c;
  if (count > 0) return;

  // 插入書籍
  const insBook = db.prepare('INSERT INTO books (title, genre, author) VALUES (?, ?, ?)');
  for (const b of BOOKS) insBook.run(b.title, b.genre, b.author);

  // 取得各類型書 id
  const genreIds = {};
  for (const g of GENRES) {
    genreIds[g] = db.prepare('SELECT id FROM books WHERE genre = ?').all(g).map(r => r.id);
  }

  const insRec = db.prepare(
    'INSERT INTO borrow_records (book_id, borrower_name, borrow_date) VALUES (?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    for (const b of BORROWERS) {
      if (b.type === 'focused_heavy' || b.type === 'focused_light') {
        // 85% 在主要類型，其餘分散到其他類型
        const focusCount = Math.round(b.total * 0.85);
        const otherCount = b.total - focusCount;
        for (let i = 0; i < focusCount; i++)
          insRec.run(pick(genreIds[b.focus]), b.name, randDate());
        const others = GENRES.filter(g => g !== b.focus);
        for (let i = 0; i < otherCount; i++)
          insRec.run(pick(genreIds[pick(others)]), b.name, randDate());

      } else if (b.type === 'wide_heavy') {
        // 均衡分布到 5 個類型（各 20%）
        const base = Math.floor(b.total / GENRES.length);
        let extra = b.total - base * GENRES.length;
        for (const g of GENRES) {
          const cnt = base + (extra-- > 0 ? 1 : 0);
          for (let i = 0; i < cnt; i++)
            insRec.run(pick(genreIds[g]), b.name, randDate());
        }

      } else {
        // scattered_light：每類型最多借 2 次，確保最高比例遠低於 0.7
        // 例：5 次 → 1+1+1+1+1，7 次 → 2+2+1+1+1
        let remaining = b.total;
        const shuffled = [...GENRES].sort(() => Math.random() - 0.5);
        for (let gi = 0; gi < shuffled.length && remaining > 0; gi++) {
          const isLast = gi === shuffled.length - 1;
          const cnt = isLast ? remaining : Math.min(2, remaining);
          for (let i = 0; i < cnt; i++)
            insRec.run(pick(genreIds[shuffled[gi]]), b.name, randDate());
          remaining -= cnt;
        }
      }
    }
    db.exec('COMMIT');
    console.log('✅ 種子資料已建立（50 本書、20 位借閱者）');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = seed;
