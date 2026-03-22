// ====================================
// jobs.js — ジョブ定義データ
// 前世×今世マトリクス（16種中プロトタイプ6種）
// 読み込み順: constants.js → jobs.js
// ====================================

const JOB_ROLES = {
  HEALER: 'healer',
  ATTACKER: 'attacker',
  HYBRID: 'hybrid',
  BOSS: 'boss',
  MOB: 'mob',
};

const JOBS = {
  // ==========================================
  // 花煙国（春）出身ジョブ
  // ==========================================

  // 春×春 — 純回復型
  souShunYakushi: {
    id: 'souShunYakushi',
    name: '双春の薬師',
    nation: 'spring',
    pastLife: 'spring',
    role: JOB_ROLES.HEALER,
    baseStats: { hp: 280, mp: 120, atk: 15, def: 20, matk: 35, mdef: 30, spd: 18 },
    skillIds: ['harukazeNoTeate', 'kafunNoKekkai', 'shinryokuNoIbuki', 'mankaiNoIyashi', 'harusame'],
    passiveId: 'seimeiNoKioku',
    description: '前世も今世も春。純粋な癒しの力を持つ職人。',
  },

  // 春×夏 — 攻撃回復型
  enYakushi: {
    id: 'enYakushi',
    name: '焔薬師',
    nation: 'spring',
    pastLife: 'summer',
    role: JOB_ROLES.HYBRID,
    baseStats: { hp: 300, mp: 100, atk: 20, def: 22, matk: 30, mdef: 25, spd: 20 },
    skillIds: ['shakuSakuKou', 'hakkaChougou', 'shakunetsuNoYakutou', 'shakuSou'],
    passiveId: 'nekketsuNoKioku',
    description: '春に生まれ夏の記憶を宿す。炎の薬で味方を癒し敵を焼く。',
  },

  // ==========================================
  // 炎陽国（夏）出身ジョブ
  // ==========================================

  // 夏×春 — 吸収アタッカー
  hanaKenshi: {
    id: 'hanaKenshi',
    name: '花剣士',
    nation: 'summer',
    pastLife: 'spring',
    role: JOB_ROLES.ATTACKER,
    baseStats: { hp: 320, mp: 80, atk: 32, def: 24, matk: 18, mdef: 20, spd: 24 },
    skillIds: ['hanabiraGiri', 'inochigariNoTachi', 'oukaRanbu', 'inochigari'],
    passiveId: 'hanaNoKenki',
    description: '夏に生まれ春の前世を持つ。花の力で命を刈り取り吸収する剣士。',
  },

  // 夏×夏 — 純アタッカー
  rekkaNoKenshi: {
    id: 'rekkaNoKenshi',
    name: '烈火の剣士',
    nation: 'summer',
    pastLife: 'summer',
    role: JOB_ROLES.ATTACKER,
    baseStats: { hp: 350, mp: 60, atk: 38, def: 28, matk: 15, mdef: 18, spd: 25 },
    skillIds: ['kaenZan', 'ikariNoIchigeki', 'enJin', 'goukaZan'],
    passiveId: 'rekkaNoTamashii',
    description: '前世も今世も夏。燃え盛る魂で敵を斬り伏せる純粋な剣士。',
  },

  // ==========================================
  // ボス・ザコ用ジョブ
  // ==========================================

  // 花守（春ボス）
  hanamori: {
    id: 'hanamori',
    name: '花守',
    nation: 'spring',
    pastLife: 'spring',
    role: JOB_ROLES.BOSS,
    baseStats: { hp: 500, mp: 200, atk: 25, def: 20, matk: 35, mdef: 25, spd: 12 },
    skillIds: ['haruNoToiki', 'hanaArashi', 'hanaNoKekkai'],
    passiveId: null,
    description: '千年桜に宿る精霊。春の力を司り、春属性攻撃を吸収する。',
  },

  // 妖精系（ザコ）
  yousei: {
    id: 'yousei',
    name: '妖精系',
    nation: 'spring',
    pastLife: null,
    role: JOB_ROLES.MOB,
    baseStats: { hp: 80, mp: 30, atk: 12, def: 8, matk: 18, mdef: 15, spd: 14 },
    skillIds: ['hanabiraDan', 'taiatari'],
    passiveId: null,
    description: '花煙国に生息する小さな精霊たち。',
  },
};
