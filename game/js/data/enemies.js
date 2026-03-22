// ====================================
// enemies.js — 敵定義データ
// 花煙国（第1章）のザコ敵・ボス
// 読み込み順: constants.js → jobs.js → skills.js → enemies.js
// ====================================

const ENEMY_AI = {
  BASIC: 'basic',
  AGGRESSIVE: 'aggressive',
  BOSS: 'boss',
};

const ENEMIES = {

  // ==========================================
  // 花煙国ザコ敵
  // ==========================================

  // 花精 — 春の小型精霊。弱い
  springFairy: {
    id: 'springFairy',
    name: '花精',
    season: 'spring',
    hp: 80,
    atk: 12,
    def: 8,
    matk: 18,
    mdef: 15,
    spd: 14,
    exp: 15,
    gold: 10,
    skills: ['hanabiraDan', 'taiatari'],
    spriteData: { bodyColor: '#FFB7C5', headColor: '#FF69B4' },
    ai: ENEMY_AI.BASIC,
    seasonChangeRate: 3,
  },

  // 花蜂 — 夏寄り。毒攻撃あり
  springBee: {
    id: 'springBee',
    name: '花蜂',
    season: 'spring',
    hp: 95,
    atk: 16,
    def: 10,
    matk: 14,
    mdef: 10,
    spd: 20,
    exp: 20,
    gold: 12,
    skills: ['taiatari', 'dokubari'],
    spriteData: { bodyColor: '#FFD700', headColor: '#FFA500', stripes: '#8B4513' },
    ai: ENEMY_AI.AGGRESSIVE,
    seasonChangeRate: 3,
  },

  // 霧狐 — 秋寄り。回避が高い
  kiriGitsune: {
    id: 'kiriGitsune',
    name: '霧狐',
    season: 'autumn',
    hp: 70,
    atk: 14,
    def: 9,
    matk: 22,
    mdef: 18,
    spd: 26,
    exp: 25,
    gold: 18,
    skills: ['kitsuneBi', 'kagerou', 'taiatari'],
    spriteData: { bodyColor: '#C0C0C0', headColor: '#DCDCDC', tailColor: '#B0B0B0' },
    ai: ENEMY_AI.BASIC,
    seasonChangeRate: 4,
    evasion: 20,
  },

  // ==========================================
  // 花煙国ボス
  // ==========================================

  // 花守 — 千年桜の洞のボス
  hanamori: {
    id: 'hanamori',
    name: '花守',
    season: 'spring',
    hp: 500,
    atk: 25,
    def: 20,
    matk: 35,
    mdef: 25,
    spd: 12,
    exp: 200,
    gold: 100,
    skills: ['haruNoToiki', 'hanaArashi', 'hanaNoKekkai'],
    spriteData: { bodyColor: '#FF69B4', headColor: '#FFB7C5', aura: '#FFF0F5' },
    ai: ENEMY_AI.BOSS,
    seasonChangeRate: 4,
    absorbSeason: 'spring',
  },
};

// ==========================================
// エンカウントテーブル（花煙国）
// ==========================================

const ENCOUNTER_TABLES = {
  springForest: {
    name: '花煙の森',
    encounterRate: 0.08,
    groups: [
      { enemies: ['springFairy'], weight: 40 },
      { enemies: ['springFairy', 'springFairy'], weight: 25 },
      { enemies: ['springBee'], weight: 20 },
      { enemies: ['springFairy', 'springBee'], weight: 10 },
      { enemies: ['kiriGitsune'], weight: 5 },
    ],
  },
  sennenZakura: {
    name: '千年桜の洞',
    encounterRate: 0.10,
    groups: [
      { enemies: ['springFairy', 'springFairy'], weight: 30 },
      { enemies: ['springBee', 'springBee'], weight: 25 },
      { enemies: ['springFairy', 'kiriGitsune'], weight: 20 },
      { enemies: ['kiriGitsune', 'kiriGitsune'], weight: 15 },
      { enemies: ['springBee', 'kiriGitsune'], weight: 10 },
    ],
    boss: 'hanamori',
  },
};
