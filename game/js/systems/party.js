// ====================================
// party.js — パーティ・キャラクター管理
// 読み込み順: constants.js → jobs.js → skills.js → enemies.js → party.js
// ====================================

class Character {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.level = data.level || 1;
    this.exp = 0;

    // HP/MP
    this.maxHp = data.maxHp;
    this.hp = data.maxHp;
    this.maxMp = data.maxMp;
    this.mp = data.maxMp;

    // ステータス
    this.atk = data.atk;
    this.def = data.def;
    this.matk = data.matk;
    this.mdef = data.mdef;
    this.spd = data.spd;

    // 季節・ジョブ
    this.currentSeason = data.startingSeason || SEASON.SPRING;
    this.job = data.jobId;
    this.availableJobs = [data.jobId];

    // 遺憶の痕（パッシブ）
    this.iokuSlots = [];
    this.maxIokuSlots = 1;

    // 留まるシステム
    this.isStaying = false;
    this.stayBonus = false;

    // バフ・デバフ
    this.buffs = [];
    this.debuffs = [];

    // 状態異常
    this.ailments = [];

    // 描画用
    this.spriteData = data.spriteData || {};
  }

  // -------------------------------------------
  // スキル取得
  // -------------------------------------------

  /** 現在のジョブでレベル条件を満たすスキルを返す */
  get skills() {
    const job = JOBS[this.job];
    if (!job) return [];
    return job.skillIds
      .map(id => SKILLS[id])
      .filter(skill => skill && skill.levelReq <= this.level);
  }

  /** 指定スキルを使用可能か（MP＋レベル条件） */
  canUseSkill(skillId) {
    const skill = SKILLS[skillId];
    if (!skill) return false;
    if (skill.levelReq > this.level) return false;
    if (skill.mpCost > this.mp) return false;
    return true;
  }

  // -------------------------------------------
  // 生死判定
  // -------------------------------------------

  isAlive() {
    return this.hp > 0;
  }

  // -------------------------------------------
  // 季節操作
  // -------------------------------------------

  /** 次の季節へ進む */
  advanceSeason() {
    this.currentSeason = getNextSeason(this.currentSeason);
  }

  /** 留まる（季節を変えない） */
  stay() {
    this.isStaying = true;
    this.stayBonus = true;
  }

  /** 留まり状態をリセット */
  resetStay() {
    this.isStaying = false;
    this.stayBonus = false;
  }

  // -------------------------------------------
  // ダメージ・回復
  // -------------------------------------------

  /** ダメージを適用（0以下にならない） */
  takeDamage(amount) {
    const actual = Math.max(0, Math.floor(amount));
    this.hp = Math.max(0, this.hp - actual);

    // パッシブ: 生命の記憶チェック
    if (this.hp > 0 && this._hasPassive('seimeiNoKioku')) {
      const autoHeal = Math.floor(this.maxHp * 0.10);
      this.hp = Math.min(this.maxHp, this.hp + autoHeal);
    }

    return actual;
  }

  /** HPを回復 */
  healHp(amount) {
    const actual = Math.floor(amount);
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + actual);
    return this.hp - before;
  }

  /** MPを消費 */
  consumeMp(amount) {
    this.mp = Math.max(0, this.mp - amount);
  }

  /** MPを回復 */
  healMp(amount) {
    const before = this.mp;
    this.mp = Math.min(this.maxMp, this.mp + Math.floor(amount));
    return this.mp - before;
  }

  /** HP/MP全回復 */
  fullRestore() {
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.ailments = [];
    this.buffs = [];
    this.debuffs = [];
  }

  // -------------------------------------------
  // バフ・デバフ管理
  // -------------------------------------------

  /** バフを追加 */
  addBuff(buff) {
    // 同種のバフがあれば上書き
    this.buffs = this.buffs.filter(b => b.type !== buff.type);
    this.buffs.push({ ...buff });
  }

  /** デバフを追加 */
  addDebuff(debuff) {
    this.debuffs = this.debuffs.filter(d => d.type !== debuff.type);
    this.debuffs.push({ ...debuff });
  }

  /** ターン経過処理（バフ・デバフのターン消費） */
  tickBuffs() {
    this.buffs = this.buffs
      .map(b => ({ ...b, turns: b.turns - 1 }))
      .filter(b => b.turns > 0);

    this.debuffs = this.debuffs
      .map(d => ({ ...d, turns: d.turns - 1 }))
      .filter(d => d.turns > 0);
  }

  /** 状態異常を追加 */
  addAilment(ailment) {
    if (!this.ailments.find(a => a.type === ailment.type)) {
      this.ailments.push({ ...ailment });
    }
  }

  /** 状態異常を解除 */
  removeAilment(type) {
    this.ailments = this.ailments.filter(a => a.type !== type);
  }

  /** 全状態異常を解除 */
  clearAllAilments() {
    this.ailments = [];
  }

  /** 状態異常のターン経過（DoTダメージ等） */
  tickAilments() {
    let totalDot = 0;
    this.ailments = this.ailments
      .map(a => {
        if (a.damage) {
          totalDot += a.damage;
        }
        return { ...a, turns: a.turns - 1 };
      })
      .filter(a => a.turns > 0);

    if (totalDot > 0) {
      this.takeDamage(totalDot);
    }
    return totalDot;
  }

  // -------------------------------------------
  // バフ込みステータス取得
  // -------------------------------------------

  getEffectiveAtk() {
    let value = this.atk;
    for (const b of this.buffs) {
      if (b.type === 'atkUp') value = Math.floor(value * (1 + b.value / 100));
    }
    for (const d of this.debuffs) {
      if (d.type === 'atkDown') value = Math.floor(value * (1 - d.value / 100));
    }
    return value;
  }

  getEffectiveDef() {
    let value = this.def;
    for (const b of this.buffs) {
      if (b.type === 'defUp') value = Math.floor(value * (1 + b.value / 100));
    }
    for (const d of this.debuffs) {
      if (d.type === 'defDown') value = Math.floor(value * (1 - d.value / 100));
    }
    return value;
  }

  getEffectiveMatk() {
    let value = this.matk;
    for (const b of this.buffs) {
      if (b.type === 'matkUp') value = Math.floor(value * (1 + b.value / 100));
    }
    return value;
  }

  getEffectiveMdef() {
    let value = this.mdef;
    for (const b of this.buffs) {
      if (b.type === 'mdefUp') value = Math.floor(value * (1 + b.value / 100));
    }
    return value;
  }

  getEffectiveSpd() {
    let value = this.spd;
    // 留まりボーナス: 速度+10%
    if (this.stayBonus) {
      value = Math.floor(value * 1.1);
    }
    return value;
  }

  getCritRate() {
    let rate = 5; // 基本クリティカル率5%
    if (this._hasPassive('rekkaNoTamashii')) {
      rate += 15;
    }
    return rate;
  }

  // -------------------------------------------
  // ジョブ管理
  // -------------------------------------------

  /** ジョブを変更 */
  changeJob(jobId) {
    if (!this.availableJobs.includes(jobId)) return false;
    this.job = jobId;
    // ジョブ変更時にステータスを基本値に戻す
    const job = JOBS[jobId];
    if (job) {
      this.maxHp = job.baseStats.hp;
      this.maxMp = job.baseStats.mp;
      this.atk = job.baseStats.atk;
      this.def = job.baseStats.def;
      this.matk = job.baseStats.matk;
      this.mdef = job.baseStats.mdef;
      this.spd = job.baseStats.spd;
      this.hp = Math.min(this.hp, this.maxHp);
      this.mp = Math.min(this.mp, this.maxMp);
    }
    return true;
  }

  /** ジョブを解放 */
  unlockJob(jobId) {
    if (!this.availableJobs.includes(jobId)) {
      this.availableJobs.push(jobId);
    }
  }

  // -------------------------------------------
  // 遺憶の痕（パッシブ）管理
  // -------------------------------------------

  /** パッシブをスロットにセット */
  equipPassive(passiveId) {
    if (this.iokuSlots.length >= this.maxIokuSlots) return false;
    if (this.iokuSlots.includes(passiveId)) return false;
    this.iokuSlots.push(passiveId);
    return true;
  }

  /** パッシブをスロットから外す */
  unequipPassive(passiveId) {
    this.iokuSlots = this.iokuSlots.filter(id => id !== passiveId);
  }

  /** 指定パッシブを持っているか（ジョブ固有 or スロット装備） */
  _hasPassive(passiveId) {
    const job = JOBS[this.job];
    if (job && job.passiveId === passiveId) return true;
    return this.iokuSlots.includes(passiveId);
  }

  // -------------------------------------------
  // 経験値・レベルアップ
  // -------------------------------------------

  /** 必要経験値テーブル */
  static expForLevel(level) {
    return Math.floor(20 * Math.pow(level, 1.5));
  }

  /** 経験値を加算し、レベルアップを処理 */
  gainExp(amount) {
    this.exp += amount;
    let leveled = false;
    while (this.exp >= Character.expForLevel(this.level + 1)) {
      this.exp -= Character.expForLevel(this.level + 1);
      this.level++;
      this._applyLevelUp();
      leveled = true;
    }
    return leveled;
  }

  /** レベルアップ時のステータス上昇 */
  _applyLevelUp() {
    const job = JOBS[this.job];
    if (!job) return;

    // ロール別の成長率
    const growthRates = {
      healer:   { hp: 8,  mp: 6, atk: 1, def: 2, matk: 3, mdef: 3, spd: 1 },
      attacker: { hp: 12, mp: 3, atk: 4, def: 2, matk: 1, mdef: 1, spd: 2 },
      hybrid:   { hp: 10, mp: 5, atk: 2, def: 2, matk: 3, mdef: 2, spd: 2 },
    };
    const growth = growthRates[job.role] || growthRates.hybrid;

    this.maxHp += growth.hp;
    this.maxMp += growth.mp;
    this.atk += growth.atk;
    this.def += growth.def;
    this.matk += growth.matk;
    this.mdef += growth.mdef;
    this.spd += growth.spd;

    // レベルアップ時HP/MP全回復
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }
}

// ==========================================
// PartyManager
// ==========================================

class PartyManager {
  constructor() {
    this.members = [];
    this.activeSlots = 3;
  }

  /** メンバーを追加 */
  addMember(character) {
    this.members.push(character);
  }

  /** メンバーを除外 */
  removeMember(characterId) {
    this.members = this.members.filter(m => m.id !== characterId);
  }

  /** バトルに出すアクティブメンバー（先頭から最大activeSlots人） */
  getActiveMembers() {
    return this.members.slice(0, this.activeSlots);
  }

  /** 全メンバー */
  getAllMembers() {
    return this.members;
  }

  /** 生存メンバーのみ */
  getAliveMembers() {
    return this.getActiveMembers().filter(m => m.isAlive());
  }

  /** 全滅判定 */
  isWiped() {
    return this.getActiveMembers().every(m => !m.isAlive());
  }

  /** 宿屋：全員HP/MP全回復 */
  healAll() {
    for (const member of this.members) {
      member.fullRestore();
    }
  }

  /** 全員の季節を進める */
  advanceAllSeasons() {
    for (const member of this.getActiveMembers()) {
      if (!member.isStaying) {
        member.advanceSeason();
      }
      member.resetStay();
    }
  }

  /** 全員のバフ・状態異常ターン経過 */
  tickAll() {
    for (const member of this.getActiveMembers()) {
      member.tickBuffs();
      member.tickAilments();
    }
  }

  /** 経験値を全生存メンバーに均等分配 */
  distributeExp(totalExp) {
    const alive = this.getAliveMembers();
    if (alive.length === 0) return [];
    const each = Math.floor(totalExp / alive.length);
    const leveledUp = [];
    for (const member of alive) {
      if (member.gainExp(each)) {
        leveledUp.push(member);
      }
    }
    return leveledUp;
  }

  /** ゴールドを取得（パーティ共有） */
  // ゴールドはGameStateなど上位で管理する想定
}

// ==========================================
// 初期パーティ生成ヘルパー
// ==========================================

function createInitialParty() {
  const party = new PartyManager();

  // 主人公
  const hero = new Character({
    id: 'hero',
    name: '（プレイヤー）',
    level: 5,
    maxHp: 350,
    maxMp: 60,
    atk: 35,
    def: 25,
    matk: 15,
    mdef: 18,
    spd: 22,
    jobId: 'rekkaNoKenshi',
    startingSeason: SEASON.SUMMER,
    spriteData: { bodyColor: '#4169E1', headColor: '#FFD700' },
  });

  // 紬
  const tsumugi = new Character({
    id: 'tsumugi',
    name: '紬',
    level: 4,
    maxHp: 280,
    maxMp: 120,
    atk: 15,
    def: 20,
    matk: 35,
    mdef: 30,
    spd: 18,
    jobId: 'souShunYakushi',
    startingSeason: SEASON.SPRING,
    spriteData: { bodyColor: '#FFB7C5', headColor: '#FFF0F5' },
  });

  party.addMember(hero);
  party.addMember(tsumugi);

  return party;
}

// ==========================================
// 敵キャラクター生成ヘルパー
// ==========================================

function createEnemyCharacter(enemyId) {
  const data = ENEMIES[enemyId];
  if (!data) return null;

  const enemy = new Character({
    id: data.id + '_' + Date.now(),
    name: data.name,
    level: 1,
    maxHp: data.hp,
    maxMp: 999,
    atk: data.atk,
    def: data.def,
    matk: data.matk,
    mdef: data.mdef,
    spd: data.spd,
    jobId: null,
    startingSeason: data.season,
    spriteData: data.spriteData,
  });

  // 敵用の追加プロパティ
  enemy._enemyData = data;
  enemy.exp = data.exp;
  enemy.gold = data.gold;
  enemy.ai = data.ai;
  enemy.absorbSeason = data.absorbSeason || null;
  enemy.seasonChangeRate = data.seasonChangeRate || 3;
  enemy.evasion = data.evasion || 0;

  return enemy;
}

/** エンカウントテーブルから敵グループを生成 */
function generateEncounter(tableId) {
  const table = ENCOUNTER_TABLES[tableId];
  if (!table) return [];

  const totalWeight = table.groups.reduce((sum, g) => sum + g.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const group of table.groups) {
    roll -= group.weight;
    if (roll <= 0) {
      return group.enemies.map(id => createEnemyCharacter(id));
    }
  }

  // フォールバック
  return [createEnemyCharacter(table.groups[0].enemies[0])];
}
