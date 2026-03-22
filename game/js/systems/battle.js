// ============================================================
// BattleEngine — 四季廻りの職人 バトルロジック
// ============================================================

/**
 * BattleAction: 行動を表すオブジェクト
 * { type: 'advance'|'guard'|'skill'|'item'|'unity',
 *   actor: BattleUnit,
 *   target?: BattleUnit,
 *   skill?: SkillDef,
 *   item?: ItemDef }
 */

// --------------------------------------------------
// BattleUnit — バトル中のキャラ/敵の状態ラッパー
// --------------------------------------------------
class BattleUnit {
  /**
   * @param {object} src - Character or enemy definition
   * @param {boolean} isEnemy
   */
  constructor(src, isEnemy = false) {
    this.name = src.name;
    this.isEnemy = isEnemy;

    // stats (copy so we don't mutate the original)
    this.hp = src.hp;
    this.maxHp = src.maxHp ?? src.hp;
    this.mp = src.mp ?? 0;
    this.maxMp = src.maxMp ?? src.mp ?? 0;
    this.atk = src.atk;
    this.def = src.def;
    this.matk = src.matk ?? src.atk;
    this.mdef = src.mdef ?? src.def;
    this.spd = src.spd ?? 10;
    this.level = src.level ?? 1;

    this.currentSeason = src.currentSeason || src.season || SEASON.SPRING;
    this.job = src.job || null;
    // Resolve skill IDs to skill objects
    const rawSkills = src.skills || [];
    this.skills = rawSkills.map(s => {
      if (typeof s === 'string') {
        return (typeof SKILLS !== 'undefined' && SKILLS[s]) ? SKILLS[s] : { id: s, name: s, mpCost: 0, power: 10, type: 'attack', target: 'enemy_single', season: SEASON.SPRING };
      }
      return s;
    });

    // battle-local state
    this.isGuarding = false;        // 「留まる」中
    this.guardBoosted = false;      // 次ターンのスキル威力2倍フラグ
    this.defBonus = 0;              // 防御ボーナス
    this.skillSealTurns = 0;        // スキル封印残りターン
    this.stunTurns = 0;             // 行動停止残りターン
    this.alive = true;

    // enemy AI extras
    this.seasonTimer = 0;           // 敵の季節巡りカウンタ
    this.seasonInterval = src.seasonInterval ?? src.seasonChangeRate ?? (2 + Math.floor(Math.random() * 2)); // 2-3ターン

    // visual
    this.spriteData = src.spriteData || { bodyColor: '#888', headColor: '#AAA' };

    // reference to source (for EXP award etc.)
    this._src = src;
  }

  get isDead() { return this.hp <= 0; }

  takeDamage(amount) {
    const actual = Math.max(0, Math.floor(amount));
    this.hp = Math.max(0, this.hp - actual);
    if (this.hp === 0) this.alive = false;
    return actual;
  }

  heal(amount) {
    const actual = Math.min(this.maxHp - this.hp, Math.max(0, Math.floor(amount)));
    this.hp += actual;
    return actual;
  }

  restoreMp(amount) {
    const actual = Math.min(this.maxMp - this.mp, Math.max(0, Math.floor(amount)));
    this.mp += actual;
    return actual;
  }

  advanceSeason() {
    this.currentSeason = getNextSeason(this.currentSeason);
  }

  /** ターン終了時の状態更新 */
  tickEndOfTurn() {
    if (this.skillSealTurns > 0) this.skillSealTurns--;
    if (this.stunTurns > 0) this.stunTurns--;
    // guardBoosted は使用後にリセットされるのでここでは触らない
    this.defBonus = 0;
    this.isGuarding = false;
  }
}

// --------------------------------------------------
// BattleEngine — ターン管理・ダメージ計算・敵AI
// --------------------------------------------------
class BattleEngine {
  /**
   * @param {BattleUnit[]} allies
   * @param {BattleUnit[]} enemies
   */
  constructor(allies, enemies) {
    this.allies = allies;
    this.enemies = enemies;
    this.allUnits = [...allies, ...enemies];

    this.turnOrder = [];
    this.currentIndex = 0;
    this.turnCount = 0;

    this.phase = 'start';  // start | input | execute | turnEnd | victory | defeat
    this.pendingAction = null;
    this.log = [];  // {text, type}
  }

  // ================ Turn management ================

  /** 新ターンを開始し行動順を決定 */
  startTurn() {
    this.turnCount++;
    // 敵の季節タイマー進行
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.seasonTimer++;
      if (e.seasonTimer >= e.seasonInterval) {
        e.seasonTimer = 0;
        const oldSeason = e.currentSeason;
        e.advanceSeason();
        this.log.push({ text: `${e.name}の内なる季節が${SEASON_NAMES[oldSeason]}から${SEASON_NAMES[e.currentSeason]}に巡った`, type: 'info' });
      }
    }

    // 速度順にソート（同速はランダム）
    const living = this.allUnits.filter(u => u.alive);
    this.turnOrder = living.sort((a, b) => {
      const diff = b.spd - a.spd;
      return diff !== 0 ? diff : (Math.random() - 0.5);
    });
    this.currentIndex = 0;
    this.phase = 'input';
    this._advanceToNextAlive();
  }

  /** 現在の行動者 */
  get currentUnit() {
    if (this.currentIndex >= this.turnOrder.length) return null;
    return this.turnOrder[this.currentIndex];
  }

  /** 次の生存者まで index を進める */
  _advanceToNextAlive() {
    while (this.currentIndex < this.turnOrder.length) {
      const unit = this.turnOrder[this.currentIndex];
      if (unit.alive && unit.stunTurns <= 0) return;
      if (unit.alive && unit.stunTurns > 0) {
        this.log.push({ text: `${unit.name}は行動できない!`, type: 'info' });
      }
      this.currentIndex++;
    }
    // 全員行動終了
    this.phase = 'turnEnd';
  }

  /** 行動決定を受け取って実行結果を返す */
  executeAction(action) {
    const results = [];
    const actor = action.actor;

    switch (action.type) {

      case 'advance': {
        // 巡る: 季節を進める + 通常攻撃
        const oldSeason = actor.currentSeason;
        actor.advanceSeason();
        results.push({
          type: 'seasonChange',
          unit: actor,
          from: oldSeason,
          to: actor.currentSeason,
          text: `${actor.name}の季節が${SEASON_NAMES[oldSeason]}から${SEASON_NAMES[actor.currentSeason]}に巡った`,
        });

        // 通常攻撃（攻撃者の現在の季節属性）
        const target = action.target || this._pickDefaultTarget(actor);
        if (target && target.alive) {
          const dmgResult = this._calcPhysicalDamage(actor, target, 1.0, actor.currentSeason);
          const dealt = target.takeDamage(dmgResult.damage);
          results.push({
            type: 'damage',
            actor,
            target,
            damage: dealt,
            season: actor.currentSeason,
            multiplier: dmgResult.multiplier,
            critical: false,
            text: `${actor.name}の攻撃! ${target.name}に${dealt}ダメージ`,
          });
        }
        break;
      }

      case 'guard': {
        // 留まる: 防御+30% & 次ターン同季節スキル威力2倍
        actor.isGuarding = true;
        actor.defBonus = Math.floor(actor.def * 0.3);
        actor.guardBoosted = true;
        results.push({
          type: 'guard',
          unit: actor,
          text: `${actor.name}は季節に留まり身構えた (防御+30%, 次スキル威力2倍)`,
        });
        break;
      }

      case 'skill': {
        const skill = action.skill;
        if (!skill) break;

        // MP消費チェック
        if (actor.mp < (skill.mpCost || 0)) {
          results.push({ type: 'fail', text: `MPが足りない!`, actor });
          break;
        }
        // スキル封印チェック
        if (actor.skillSealTurns > 0) {
          results.push({ type: 'fail', text: `${actor.name}はスキルが封印されている!`, actor });
          break;
        }

        actor.mp -= (skill.mpCost || 0);

        if (skill.target === 'allEnemies' || skill.target === 'allAllies') {
          // 全体スキル
          const targets = skill.target === 'allEnemies'
            ? (actor.isEnemy ? this.allies : this.enemies).filter(u => u.alive)
            : (actor.isEnemy ? this.enemies : this.allies).filter(u => u.alive);

          for (const t of targets) {
            const r = this._applySkill(actor, t, skill);
            results.push(r);
          }
        } else {
          // 単体スキル
          const target = action.target || this._pickDefaultTarget(actor);
          if (target && target.alive) {
            const r = this._applySkill(actor, target, skill);
            results.push(r);
          }
        }

        // 留まるブーストを消費
        if (actor.guardBoosted) actor.guardBoosted = false;
        break;
      }

      case 'item': {
        const item = action.item;
        if (!item) break;
        const target = action.target || actor;

        if (item.effect === 'healHp') {
          const healed = target.heal(item.value || 50);
          results.push({
            type: 'heal',
            actor,
            target,
            amount: healed,
            text: `${actor.name}は${item.name}を使った! ${target.name}のHPが${healed}回復`,
          });
        } else if (item.effect === 'healMp') {
          const restored = target.restoreMp(item.value || 20);
          results.push({
            type: 'mpHeal',
            actor,
            target,
            amount: restored,
            text: `${actor.name}は${item.name}を使った! ${target.name}のMPが${restored}回復`,
          });
        }
        break;
      }

      case 'unity': {
        // 四季の合一
        const unityResult = this._executeUnity(actor);
        results.push(unityResult);
        break;
      }
    }

    // ログ追加
    for (const r of results) {
      if (r.text) this.log.push({ text: r.text, type: r.type });
    }

    // 次のユニットへ
    this.currentIndex++;
    this._advanceToNextAlive();

    // 勝敗判定
    if (this.enemies.every(e => !e.alive)) {
      this.phase = 'victory';
    } else if (this.allies.every(a => !a.alive)) {
      this.phase = 'defeat';
    }

    return results;
  }

  /** ターン終了処理 */
  endTurn() {
    for (const u of this.allUnits) {
      if (u.alive) u.tickEndOfTurn();
    }
  }

  // ================ Damage calculation ================

  _calcPhysicalDamage(attacker, defender, skillMultiplier, skillSeason) {
    const baseDmg = Math.max(1, (attacker.atk * skillMultiplier) - ((defender.def + defender.defBonus) * 0.5));
    const seasonMul = getSeasonMultiplier(skillSeason, defender.currentSeason);

    // 留まるブースト
    let guardBoost = 1.0;
    if (attacker.guardBoosted && skillMultiplier > 1.0) {
      guardBoost = 2.0;
    }

    // 小さなランダム幅 (0.9 ~ 1.1)
    const rand = 0.9 + Math.random() * 0.2;

    const damage = Math.floor(baseDmg * seasonMul * guardBoost * rand);
    return { damage: Math.max(1, damage), multiplier: seasonMul, guardBoosted: guardBoost > 1 };
  }

  _calcMagicalDamage(attacker, defender, skillMultiplier, skillSeason) {
    const baseDmg = Math.max(1, (attacker.matk * skillMultiplier) - ((defender.mdef + defender.defBonus) * 0.5));
    const seasonMul = getSeasonMultiplier(skillSeason, defender.currentSeason);

    let guardBoost = 1.0;
    if (attacker.guardBoosted) {
      guardBoost = 2.0;
    }

    const rand = 0.9 + Math.random() * 0.2;
    const damage = Math.floor(baseDmg * seasonMul * guardBoost * rand);
    return { damage: Math.max(1, damage), multiplier: seasonMul, guardBoosted: guardBoost > 1 };
  }

  _applySkill(actor, target, skill) {
    const season = skill.season || actor.currentSeason;
    const isHeal = skill.type === 'heal';

    if (isHeal) {
      const amount = Math.floor((actor.matk || actor.atk) * (skill.power || 1.0) * (0.9 + Math.random() * 0.2));
      const healed = target.heal(amount);
      return {
        type: 'heal',
        actor,
        target,
        amount: healed,
        season,
        text: `${actor.name}の${skill.name}! ${target.name}のHPが${healed}回復`,
      };
    }

    // 攻撃スキル
    const isMagic = skill.type === 'magic';
    const calcFn = isMagic ? this._calcMagicalDamage.bind(this) : this._calcPhysicalDamage.bind(this);
    const dmgResult = calcFn(actor, target, skill.power || 1.5, season);
    const dealt = target.takeDamage(dmgResult.damage);

    const bigHit = dmgResult.multiplier >= 1.5;
    const weak = dmgResult.multiplier <= 0.5;

    let text = `${actor.name}の${skill.name}! ${target.name}に${dealt}ダメージ`;
    if (bigHit) text += ' 【効果抜群!】';
    if (weak) text += ' 【いまひとつ...】';
    if (dmgResult.guardBoosted) text += ' 【留まりの力!】';

    return {
      type: 'damage',
      actor,
      target,
      damage: dealt,
      season,
      multiplier: dmgResult.multiplier,
      critical: bigHit,
      weak,
      text,
    };
  }

  // ================ Target selection ================

  _pickDefaultTarget(actor) {
    const candidates = actor.isEnemy
      ? this.allies.filter(u => u.alive)
      : this.enemies.filter(u => u.alive);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ================ Unity (四季の合一) ================

  /** パーティ全員の季節が揃っているかチェック */
  checkUnityAvailable() {
    const livingAllies = this.allies.filter(a => a.alive);
    if (livingAllies.length < 2) return null;
    const season = livingAllies[0].currentSeason;
    if (livingAllies.every(a => a.currentSeason === season)) return season;
    return null;
  }

  _executeUnity(actor) {
    const season = this.checkUnityAvailable();
    if (!season) {
      return { type: 'fail', text: '四季の合一は発動できない!', actor };
    }

    switch (season) {
      case SEASON.SPRING: {
        // 全体HP全回復
        for (const a of this.allies.filter(u => u.alive)) {
          a.heal(a.maxHp);
        }
        return { type: 'unity', season, text: '【四季の合一 - 春】全員のHPが全回復した!' };
      }
      case SEASON.SUMMER: {
        // 敵全体に大ダメージ
        let totalDmg = 0;
        for (const e of this.enemies.filter(u => u.alive)) {
          const dmg = Math.floor(actor.atk * 3.0);
          totalDmg += e.takeDamage(dmg);
        }
        return { type: 'unity', season, text: `【四季の合一 - 夏】灼熱の力で敵全体に${totalDmg}ダメージ!` };
      }
      case SEASON.AUTUMN: {
        // 敵全体スキル封印3ターン
        for (const e of this.enemies.filter(u => u.alive)) {
          e.skillSealTurns = 3;
        }
        return { type: 'unity', season, text: '【四季の合一 - 秋】敵全体のスキルを3ターン封印した!' };
      }
      case SEASON.WINTER: {
        // 敵全体3ターン行動停止
        for (const e of this.enemies.filter(u => u.alive)) {
          e.stunTurns = 3;
        }
        return { type: 'unity', season, text: '【四季の合一 - 冬】敵全体を3ターン凍結させた!' };
      }
    }
    return { type: 'fail', text: '四季の合一は発動できない!', actor };
  }

  // ================ Enemy AI ================

  /**
   * 敵ユニットの行動を決定
   * @param {BattleUnit} enemy
   * @returns {object} action
   */
  decideEnemyAction(enemy) {
    const hpRatio = enemy.hp / enemy.maxHp;
    const availableSkills = (enemy.skillSealTurns > 0)
      ? []
      : enemy.skills.filter(s => (s.mpCost || 0) <= enemy.mp);

    // HPが30%以下 → 強スキルを優先
    if (hpRatio <= 0.3 && availableSkills.length > 0) {
      // 最も威力が高いスキルを選ぶ
      const strongest = availableSkills.reduce((best, s) => (s.power || 0) > (best.power || 0) ? s : best, availableSkills[0]);
      const target = this._pickBestTarget(enemy, strongest);
      return { type: 'skill', actor: enemy, target, skill: strongest };
    }

    // 通常: 40%の確率でスキル使用（使えるスキルがある場合）
    if (availableSkills.length > 0 && Math.random() < 0.4) {
      const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
      const target = this._pickBestTarget(enemy, skill);
      return { type: 'skill', actor: enemy, target, skill };
    }

    // 通常攻撃（巡るとして扱う — 季節も進む）
    const target = this._pickDefaultTarget(enemy);
    return { type: 'advance', actor: enemy, target };
  }

  /** 季節相性が最も有利なターゲットを選ぶ */
  _pickBestTarget(enemy, skill) {
    const candidates = this.allies.filter(u => u.alive);
    if (candidates.length === 0) return null;

    const skillSeason = skill.season || enemy.currentSeason;
    let best = candidates[0];
    let bestMul = getSeasonMultiplier(skillSeason, best.currentSeason);

    for (let i = 1; i < candidates.length; i++) {
      const mul = getSeasonMultiplier(skillSeason, candidates[i].currentSeason);
      if (mul > bestMul) {
        bestMul = mul;
        best = candidates[i];
      }
    }
    return best;
  }

  // ================ EXP calculation ================

  calcExpReward() {
    let total = 0;
    for (const e of this.enemies) {
      total += (e.level || 1) * 10 + (e.maxHp || 0);
    }
    return Math.floor(total);
  }
}
