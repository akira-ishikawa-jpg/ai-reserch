// ============================================================
// BattleScene — 四季廻りの職人 バトル画面描画・UI・アニメーション
// ============================================================
// 設計方針:
//   - ステートマシンは update() の switch で駆動し、各フレームで1つの状態だけ処理する
//   - 状態遷移は uiState の書き換えのみで行い、遷移先の処理は次フレームに委ねる
//   - _beginNextUnitAction() のような同期再帰呼び出しは一切行わない
//   - 安全装置: 1フレーム内の状態遷移回数をカウントし、上限でbreak
// ============================================================

class BattleScene extends Scene {
  constructor(game) {
    super();
    this.game = game;

    // engine
    this.engine = null;

    // UI state
    //   idle → message → startTurn → (enemyAction | command) → animating → startTurn ...
    //   → turnEnd → startTurn
    //   → result
    this.uiState = 'idle';
    this.selectedCommand = 0;
    this.selectedSkill = 0;
    this.selectedItem = 0;
    this.selectedTarget = 0;
    this.currentAllyIndex = 0;

    // animation queue
    this.animQueue = [];
    this.currentAnim = null;
    this.animTimer = 0;

    // message
    this.messageQueue = [];
    this.messageTimer = 0;
    this.currentMessage = '';
    this._afterMessage = null; // state to transition to after messages are done

    // battle data
    this.background = SEASON.SPRING;

    // visual positions
    this.allyPositions = [];
    this.enemyPositions = [];

    // sprite offsets for attack animation
    this.spriteOffsets = new Map();

    // floating damage numbers
    this.floatingTexts = [];

    // result screen
    this.resultData = null;
    this.resultTimer = 0;

    // commands
    this.commands = [
      { name: '巡る', key: '1', desc: '季節を進め攻撃' },
      { name: '留まる', key: '2', desc: '防御+次スキル強化' },
      { name: 'スキル', key: '3', desc: 'スキル発動' },
      { name: 'アイテム', key: '4', desc: '回復アイテム使用' },
    ];
  }

  // ============ Scene lifecycle ============

  enter(data) {
    this.bgColor = data.background || '#FFF0F5';
    this.background = data.season || SEASON.SPRING;

    // Create BattleUnits from party
    const partyMembers = this.game.state.party.getActiveMembers();
    const allies = partyMembers.map(c => new BattleUnit(c, false));

    // Create enemy BattleUnits
    const enemies = (data.enemies || []).map(e => new BattleUnit(e, true));

    this.engine = new BattleEngine(allies, enemies);

    // Calculate positions
    this._layoutPositions(allies, enemies);

    // Init sprite offsets
    for (const u of [...allies, ...enemies]) {
      this.spriteOffsets.set(u, { x: 0, y: 0 });
    }

    // Reset state
    this.animQueue = [];
    this.currentAnim = null;
    this.messageQueue = [];
    this.floatingTexts = [];
    this.resultData = null;
    this._afterMessage = null;

    // フェードイン（探索シーンがフェードアウトしているので戻す）
    this.game.renderer.fadeAlpha = 1;
    this.game.renderer.startFade(0, 0.05);

    // BGM: バトル曲開始
    if (this.game.audio && this.game.audio.ctx) {
      const bgmId = (data.isBoss) ? 'boss' : 'battle';
      this.game.audio.playBgm(bgmId);
    }

    // Show encounter message, then go to startTurn
    this._showMessages(['敵が現れた!'], 'firstTurn');
  }

  exit() {
    this.engine = null;
  }

  // ============ Position layout ============

  _layoutPositions(allies, enemies) {
    const allyBaseX = 120;
    const allyBaseY = 220;
    this.allyPositions = allies.map((_, i) => ({
      x: allyBaseX + i * 90,
      y: allyBaseY + i * 40,
    }));

    const enemyBaseX = 600;
    const enemyBaseY = 140;
    this.enemyPositions = enemies.map((_, i) => ({
      x: enemyBaseX + i * 100,
      y: enemyBaseY + i * 50,
    }));
  }

  // ============ Safe message system ============
  // _showMessages: queue messages and specify which state to go to after all are shown.
  // No callbacks, no recursive calls — just a state name string.

  _showMessages(texts, afterState) {
    this.messageQueue = texts.slice();
    this._afterMessage = afterState;
    this._advanceMessageQueue();
  }

  _advanceMessageQueue() {
    if (this.messageQueue.length === 0) {
      // All messages shown — transition to the designated next state
      this.uiState = this._afterMessage || 'startTurn';
      this._afterMessage = null;
      return;
    }
    this.currentMessage = this.messageQueue.shift();
    this.messageTimer = 1.2;
    this.uiState = 'message';
  }

  // ============ Update ============

  update(dt) {
    if (!this.engine) return;

    const input = this.game.input;

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.timer -= dt;
      ft.y += ft.vy * dt;
      ft.vy -= 60 * dt;
      if (ft.timer <= 0) this.floatingTexts.splice(i, 1);
    }

    // seasonal particles
    if (Math.random() < 0.1) {
      this.game.renderer.addParticle(this.background, Math.random() * GAME_WIDTH, Math.random() * 300);
    }

    // State machine — each case does ONE thing and sets uiState for the NEXT frame
    switch (this.uiState) {

      case 'message':
        this._updateMessage(dt, input);
        break;

      case 'firstTurn':
        // One-time state: start the first turn after encounter message
        this.engine.startTurn();
        this.uiState = 'startTurn';
        break;

      case 'startTurn':
        this._handleStartTurn();
        break;

      case 'enemyAction':
        this._handleEnemyAction();
        break;

      case 'command':
        this._updateCommand(dt, input);
        break;

      case 'skillSelect':
        this._updateSkillSelect(dt, input);
        break;

      case 'itemSelect':
        this._updateItemSelect(dt, input);
        break;

      case 'targetSelect':
        this._updateTargetSelect(dt, input);
        break;

      case 'animating':
        this._updateAnimation(dt);
        break;

      case 'turnEnd':
        this._handleTurnEnd();
        break;

      case 'result':
        this._updateResult(dt, input);
        break;
    }
  }

  // ============ Message display ============

  _updateMessage(dt, input) {
    this.messageTimer -= dt;
    const tap = input.consumeTap();
    if (tap || input.isJustPressed('Enter') || input.isJustPressed(' ')) {
      this.messageTimer = 0;
    }
    if (this.messageTimer <= 0) {
      this._advanceMessageQueue();
    }
  }

  // ============ Turn flow (no recursion) ============

  /**
   * startTurn state: determine what the current unit should do.
   * Runs once per frame — sets uiState and returns.
   */
  _handleStartTurn() {
    // Check victory/defeat first
    if (this.engine.phase === 'victory') {
      this._showVictory();
      return;
    }
    if (this.engine.phase === 'defeat') {
      this._showDefeat();
      return;
    }

    // If the engine says turnEnd, go to turnEnd state (processed next frame)
    if (this.engine.phase === 'turnEnd') {
      this.uiState = 'turnEnd';
      return;
    }

    const unit = this.engine.currentUnit;
    if (!unit) {
      // No unit available — treat as turnEnd
      this.uiState = 'turnEnd';
      return;
    }

    if (unit.isEnemy) {
      // Enemy: go to enemyAction state (processed next frame, guaranteeing 1-frame gap)
      this.uiState = 'enemyAction';
    } else {
      // Player: show command menu
      this.selectedCommand = 0;
      this.uiState = 'command';
    }
  }

  /**
   * enemyAction state: decide and execute enemy action, then go to animating.
   */
  _handleEnemyAction() {
    const unit = this.engine.currentUnit;
    if (!unit || !unit.isEnemy) {
      // Safety: shouldn't happen, go back to startTurn
      this.uiState = 'startTurn';
      return;
    }
    const action = this.engine.decideEnemyAction(unit);
    this._executeAndAnimate(action);
  }

  /**
   * turnEnd state: run end-of-turn logic, then start a new turn.
   */
  _handleTurnEnd() {
    this.engine.endTurn();

    // Check victory/defeat before starting a new turn
    if (this.engine.enemies.every(e => !e.alive)) {
      this._showVictory();
      return;
    }
    if (this.engine.allies.every(a => !a.alive)) {
      this._showDefeat();
      return;
    }

    this.engine.startTurn();
    // After startTurn(), phase should be 'input' and currentIndex set.
    // Go to startTurn state on the NEXT frame.
    this.uiState = 'startTurn';
  }

  _executeAndAnimate(action) {
    const results = this.engine.executeAction(action);
    this._queueAnimations(action, results);

    // If there are animations, play them. If not, go straight to startTurn (next frame).
    if (this.animQueue.length > 0) {
      this.uiState = 'animating';
    } else {
      this.uiState = 'startTurn';
    }
  }

  // ============ Command input ============

  _updateCommand(dt, input) {
    const unit = this.engine.currentUnit;
    if (!unit) return;

    // Keyboard: arrows for nav
    if (input.isJustPressed('ArrowUp') || input.isJustPressed('w')) {
      this.selectedCommand = (this.selectedCommand + 3) % 4;
    }
    if (input.isJustPressed('ArrowDown') || input.isJustPressed('s')) {
      this.selectedCommand = (this.selectedCommand + 1) % 4;
    }
    if (input.isJustPressed('ArrowLeft') || input.isJustPressed('a')) {
      this.selectedCommand = (this.selectedCommand + 3) % 4;
    }
    if (input.isJustPressed('ArrowRight') || input.isJustPressed('d')) {
      this.selectedCommand = (this.selectedCommand + 1) % 4;
    }

    // Number keys
    for (let i = 0; i < 4; i++) {
      if (input.isJustPressed(String(i + 1))) {
        this.selectedCommand = i;
        this._confirmCommand();
        return;
      }
    }

    // Enter to confirm
    if (input.isJustPressed('Enter') || input.isJustPressed(' ')) {
      this._confirmCommand();
      return;
    }

    // Tap
    const tap = input.consumeTap();
    if (tap) {
      const cmdIdx = this._hitTestCommand(tap.x, tap.y);
      if (cmdIdx >= 0) {
        this.selectedCommand = cmdIdx;
        this._confirmCommand();
        return;
      }
      // Check unity button
      if (this._hitTestUnity(tap.x, tap.y) && this.engine.checkUnityAvailable()) {
        this._executeAndAnimate({ type: 'unity', actor: unit });
        return;
      }
    }
  }

  _confirmCommand() {
    const unit = this.engine.currentUnit;
    if (!unit) return;

    switch (this.selectedCommand) {
      case 0: // 巡る
        this._executeAndAnimate({
          type: 'advance',
          actor: unit,
          target: this.engine.enemies.find(e => e.alive),
        });
        break;
      case 1: // 留まる
        this._executeAndAnimate({ type: 'guard', actor: unit });
        break;
      case 2: // スキル
        if (unit.skillSealTurns > 0) {
          this._showMessages(['スキルが封印されている!'], 'command');
          return;
        }
        if (!unit.skills || unit.skills.length === 0) {
          this._showMessages(['使えるスキルがない!'], 'command');
          return;
        }
        this.selectedSkill = 0;
        this.uiState = 'skillSelect';
        break;
      case 3: // アイテム
        this._showMessages(['アイテムがない!'], 'command');
        break;
    }
  }

  // ============ Skill select ============

  _updateSkillSelect(dt, input) {
    const unit = this.engine.currentUnit;
    if (!unit) return;
    const skills = unit.skills;

    if (input.isJustPressed('ArrowUp') || input.isJustPressed('w')) {
      this.selectedSkill = (this.selectedSkill - 1 + skills.length) % skills.length;
    }
    if (input.isJustPressed('ArrowDown') || input.isJustPressed('s')) {
      this.selectedSkill = (this.selectedSkill + 1) % skills.length;
    }

    if (input.isJustPressed('Escape') || input.isJustPressed('Backspace')) {
      this.uiState = 'command';
      return;
    }

    if (input.isJustPressed('Enter') || input.isJustPressed(' ')) {
      this._confirmSkill();
      return;
    }

    const tap = input.consumeTap();
    if (tap) {
      const idx = this._hitTestSkillList(tap.x, tap.y, skills.length);
      if (idx >= 0) {
        this.selectedSkill = idx;
        this._confirmSkill();
      } else {
        if (tap.x < 500) {
          this.uiState = 'command';
        }
      }
    }
  }

  _confirmSkill() {
    const unit = this.engine.currentUnit;
    const skill = unit.skills[this.selectedSkill];
    if (!skill) return;

    if (unit.mp < (skill.mpCost || 0)) {
      this._showMessages(['MPが足りない!'], 'skillSelect');
      return;
    }

    if (skill.target === TARGETS.ALLY_ALL || skill.target === TARGETS.ENEMY_ALL) {
      this._executeAndAnimate({ type: 'skill', actor: unit, skill });
    } else if (skill.type === SKILL_TYPES.HEAL) {
      const allies = this.engine.allies.filter(a => a.alive);
      const target = allies.reduce((low, a) => (a.hp / a.maxHp) < (low.hp / low.maxHp) ? a : low, allies[0]);
      this._executeAndAnimate({ type: 'skill', actor: unit, target, skill });
    } else if (skill.target === TARGETS.SELF) {
      this._executeAndAnimate({ type: 'skill', actor: unit, target: unit, skill });
    } else {
      const target = this.engine.enemies.find(e => e.alive);
      this._executeAndAnimate({ type: 'skill', actor: unit, target, skill });
    }
  }

  // ============ Target select (future use) ============

  _updateTargetSelect(dt, input) {
    if (input.isJustPressed('Escape')) {
      this.uiState = 'command';
    }
  }

  // ============ Item select (placeholder) ============

  _updateItemSelect(dt, input) {
    if (input.isJustPressed('Escape')) {
      this.uiState = 'command';
    }
  }

  // ============ Animation system ============

  _queueAnimations(action, results) {
    this.animQueue = [];

    for (const r of results) {
      switch (r.type) {
        case 'seasonChange':
          this.animQueue.push({ type: 'flash', season: r.to, duration: 0.3, unit: r.unit, text: r.text });
          break;
        case 'damage':
          this.animQueue.push({ type: 'attack', actor: r.actor, target: r.target, duration: 0.5 });
          this.animQueue.push({ type: 'hit', target: r.target, damage: r.damage, season: r.season, critical: r.critical, duration: 0.6 });
          break;
        case 'heal':
          this.animQueue.push({ type: 'healAnim', target: r.target, amount: r.amount, duration: 0.6 });
          break;
        case 'mpHeal':
          this.animQueue.push({ type: 'healAnim', target: r.target, amount: r.amount, duration: 0.6, isMp: true });
          break;
        case 'buff':
          this.animQueue.push({ type: 'message', text: r.text, duration: 0.8 });
          break;
        case 'guard':
          this.animQueue.push({ type: 'guard', unit: r.unit, duration: 0.5, text: r.text });
          break;
        case 'unity':
          this.animQueue.push({ type: 'unity', season: r.season, duration: 1.5, text: r.text });
          break;
        case 'fail':
          this.animQueue.push({ type: 'message', text: r.text, duration: 0.8 });
          break;
      }
    }

    this.currentAnim = null;
    this.animTimer = 0;
  }

  _updateAnimation(dt) {
    // Currently playing an animation step
    if (this.currentAnim) {
      this.animTimer -= dt;
      this._tickAnim(this.currentAnim, dt);
      if (this.animTimer <= 0) {
        this._finishAnim(this.currentAnim);
        this.currentAnim = null;
      }
      return; // wait for next frame
    }

    // Pick next animation from queue
    if (this.animQueue.length > 0) {
      this.currentAnim = this.animQueue.shift();
      this.animTimer = this.currentAnim.duration || 0.5;
      this._startAnim(this.currentAnim);
      return; // wait for next frame
    }

    // All animations done — drain engine log and go to startTurn (next frame)
    this.engine.log.splice(0);
    this.uiState = 'startTurn';
  }

  _startAnim(anim) {
    switch (anim.type) {
      case 'attack': {
        const actorPos = this._getUnitPosition(anim.actor);
        const targetPos = this._getUnitPosition(anim.target);
        if (actorPos && targetPos) {
          const dx = (targetPos.x - actorPos.x) * 0.4;
          const dy = (targetPos.y - actorPos.y) * 0.4;
          const offset = this.spriteOffsets.get(anim.actor);
          if (offset) { offset.x = dx; offset.y = dy; }
        }
        break;
      }
      case 'hit': {
        const pos = this._getUnitPosition(anim.target);
        if (pos) {
          const color = anim.critical ? '#FFD700' : '#FFF';
          this.floatingTexts.push({
            text: String(anim.damage),
            x: pos.x + 20 + (Math.random() - 0.5) * 20,
            y: pos.y - 10,
            color,
            timer: 1.2,
            vy: -80,
            size: anim.critical ? 28 : 22,
          });
          if (anim.damage > 30 || anim.critical) {
            this.game.renderer.screenShake = Math.min(12, anim.damage * 0.2);
          }
          if (anim.season) {
            for (let i = 0; i < 8; i++) {
              this.game.renderer.addParticle(anim.season, pos.x + Math.random() * 40, pos.y + Math.random() * 40);
            }
          }
        }
        break;
      }
      case 'healAnim': {
        const pos = this._getUnitPosition(anim.target);
        if (pos) {
          const color = anim.isMp ? '#4488FF' : '#44FF44';
          this.floatingTexts.push({
            text: `+${anim.amount}`,
            x: pos.x + 20,
            y: pos.y,
            color,
            timer: 1.0,
            vy: -60,
            size: 20,
          });
        }
        break;
      }
      case 'guard': {
        break;
      }
      case 'flash': {
        if (anim.text) {
          this.currentMessage = anim.text;
        }
        break;
      }
      case 'unity': {
        this.game.renderer.screenShake = 15;
        if (anim.text) {
          this.currentMessage = anim.text;
        }
        const season = anim.season;
        for (let i = 0; i < 30; i++) {
          this.game.renderer.addParticle(season, Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT * 0.7);
        }
        break;
      }
      case 'message': {
        this.currentMessage = anim.text || '';
        break;
      }
    }
  }

  _tickAnim(anim, dt) {
    if (anim.type === 'attack') {
      const offset = this.spriteOffsets.get(anim.actor);
      if (offset && this.animTimer < anim.duration * 0.4) {
        offset.x *= 0.8;
        offset.y *= 0.8;
      }
    }
  }

  _finishAnim(anim) {
    if (anim.type === 'attack') {
      const offset = this.spriteOffsets.get(anim.actor);
      if (offset) { offset.x = 0; offset.y = 0; }
    }
    if (anim.type === 'flash' || anim.type === 'message' || anim.type === 'unity') {
      this.currentMessage = '';
    }
  }

  _getUnitPosition(unit) {
    if (!unit) return null;
    const list = unit.isEnemy ? this.engine.enemies : this.engine.allies;
    const positions = unit.isEnemy ? this.enemyPositions : this.allyPositions;
    const idx = list.indexOf(unit);
    return idx >= 0 && positions[idx] ? positions[idx] : null;
  }

  // ============ Victory / Defeat ============

  _showVictory() {
    const exp = this.engine.calcExpReward();
    this.resultData = { result: 'victory', exp };
    this.resultTimer = 0;
    this.uiState = 'result';
    this._syncBackToParty();
    if (this.game.state.party) {
      this.game.state.party.distributeExp(exp);
    }
  }

  _showDefeat() {
    this.resultData = { result: 'defeat', exp: 0 };
    this.resultTimer = 0;
    this.uiState = 'result';
  }

  _syncBackToParty() {
    const partyMembers = this.game.state.party.getActiveMembers();
    for (let i = 0; i < this.engine.allies.length && i < partyMembers.length; i++) {
      const bu = this.engine.allies[i];
      const pm = partyMembers[i];
      pm.hp = bu.hp;
      pm.mp = bu.mp;
      pm.currentSeason = bu.currentSeason;
    }
  }

  _updateResult(dt, input) {
    this.resultTimer += dt;
    if (this.resultTimer > 1.0) {
      if (input.isJustPressed('Enter') || input.isJustPressed(' ') || input.consumeTap()) {
        this.game.scenes.pop(this.resultData);
      }
    }
  }

  // ============ Hit testing ============

  _hitTestCommand(x, y) {
    const panelX = 520;
    const panelY = 430;
    const btnW = 100;
    const btnH = 42;
    const gap = 8;

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = panelX + col * (btnW + gap);
      const by = panelY + row * (btnH + gap);
      if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) return i;
    }
    return -1;
  }

  _hitTestUnity(x, y) {
    return x >= 740 && x <= 940 && y >= 430 && y <= 472;
  }

  _hitTestSkillList(x, y, count) {
    const panelX = 510;
    const panelY = 424;
    const itemH = 28;
    for (let i = 0; i < count; i++) {
      const iy = panelY + 6 + i * itemH;
      if (x >= panelX && x <= 940 && y >= iy && y <= iy + itemH) return i;
    }
    return -1;
  }

  // ============ Draw ============

  draw(renderer) {
    if (!this.engine) return;
    renderer.ctx.globalAlpha = 1;

    this._drawBackground(renderer);
    this._drawUnits(renderer);
    this._drawFloatingTexts(renderer);
    this._drawStatusPanel(renderer);

    switch (this.uiState) {
      case 'command':
        this._drawCommandMenu(renderer);
        break;
      case 'skillSelect':
        this._drawSkillMenu(renderer);
        break;
      case 'message':
        this._drawMessageBox(renderer, this.currentMessage);
        break;
      case 'animating':
        if (this.currentMessage) {
          this._drawMessageBox(renderer, this.currentMessage);
        }
        break;
      case 'result':
        this._drawResultScreen(renderer);
        break;
    }

    // turn indicator
    const curUnit = this.engine.currentUnit;
    if (curUnit && (this.uiState === 'command' || this.uiState === 'skillSelect')) {
      renderer.drawText(`${curUnit.name}のターン`, GAME_WIDTH / 2, 8, {
        size: 18, align: 'center', color: '#FFD700',
      });
    }
  }

  // ---- Background ----

  _drawBackground(renderer) {
    const colors = SEASON_COLORS[this.background] || SEASON_COLORS[SEASON.SPRING];
    renderer.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT, colors.bg);
    renderer.drawRect(0, 0, GAME_WIDTH, 80, colors.secondary, 0.3);
    renderer.drawRect(0, 350, GAME_WIDTH, 190, colors.primary, 0.15);
    renderer.drawRect(0, 380, GAME_WIDTH, 160, '#2a2a3a', 0.8);
  }

  // ---- Units ----

  _drawUnits(renderer) {
    for (let i = 0; i < this.engine.allies.length; i++) {
      const u = this.engine.allies[i];
      const pos = this.allyPositions[i];
      if (!pos) continue;
      this._drawUnit(renderer, u, pos, false);
    }
    for (let i = 0; i < this.engine.enemies.length; i++) {
      const u = this.engine.enemies[i];
      const pos = this.enemyPositions[i];
      if (!pos) continue;
      this._drawUnit(renderer, u, pos, true);
    }
  }

  _drawUnit(renderer, unit, pos, isEnemy) {
    const offset = this.spriteOffsets.get(unit) || { x: 0, y: 0 };
    const x = pos.x + offset.x;
    const y = pos.y + offset.y;
    const w = 48;
    const h = 64;

    if (!unit.alive) {
      renderer.drawRect(x, y + h * 0.6, w, h * 0.4, '#555', 0.4);
      return;
    }

    if (unit.isGuarding) {
      renderer.drawRoundedRect(x - 6, y - 6, w + 12, h + 12, 6, null, SEASON_COLORS[unit.currentSeason].primary);
      renderer.drawRect(x - 4, y - 4, w + 8, h + 8, SEASON_COLORS[unit.currentSeason].primary, 0.15);
    }

    const seasonColor = SEASON_COLORS[unit.currentSeason];
    const sprite = unit.spriteData || { bodyColor: isEnemy ? '#8B0000' : '#336699', headColor: isEnemy ? '#CC4444' : '#6699CC' };
    renderer.drawSprite(x, y, w, h, {
      bodyColor: sprite.bodyColor,
      headColor: sprite.headColor,
      season: unit.currentSeason,
    });

    renderer.drawText(unit.name, x + w / 2, y - 18, {
      size: 12, align: 'center', color: isEnemy ? '#FF9999' : '#99CCFF',
    });

    if (isEnemy) {
      renderer.drawBar(x, y - 8, w, 5, unit.hp, unit.maxHp, '#E74C3C', '#333');
    }

    const dotColor = seasonColor.primary;
    renderer.drawRect(x + w / 2 - 4, y + h + 4, 8, 8, dotColor);
    renderer.drawText(SEASON_NAMES[unit.currentSeason], x + w / 2, y + h + 14, {
      size: 10, align: 'center', color: dotColor,
    });

    if (unit.stunTurns > 0) {
      renderer.drawText('凍結', x + w / 2, y + h / 2, {
        size: 14, align: 'center', color: '#88CCFF',
      });
    }
    if (unit.skillSealTurns > 0) {
      renderer.drawText('封印', x + w / 2, y + h / 2 + 16, {
        size: 12, align: 'center', color: '#CC88FF',
      });
    }
  }

  // ---- Floating texts ----

  _drawFloatingTexts(renderer) {
    for (const ft of this.floatingTexts) {
      renderer.drawText(ft.text, ft.x, ft.y, {
        size: ft.size || 22,
        color: ft.color,
        align: 'center',
        shadow: true,
      });
    }
  }

  // ---- Status panel (left bottom) ----

  _drawStatusPanel(renderer) {
    const panelX = 8;
    const panelY = 412;
    const panelW = 500;
    const panelH = 122;

    renderer.drawRoundedRect(panelX, panelY, panelW, panelH, 8, 'rgba(0,0,0,0.75)', '#555');

    const allies = this.engine.allies;
    const rowH = Math.min(38, Math.floor((panelH - 12) / Math.max(allies.length, 1)));

    for (let i = 0; i < allies.length; i++) {
      const a = allies[i];
      const ry = panelY + 8 + i * rowH;

      const isCurrent = (this.engine.currentUnit === a && (this.uiState === 'command' || this.uiState === 'skillSelect'));
      if (isCurrent) {
        renderer.drawRect(panelX + 2, ry - 1, panelW - 4, rowH - 2, '#FFD700', 0.15);
      }

      const nameColor = a.alive ? '#FFF' : '#666';
      renderer.drawText(a.name, panelX + 12, ry + 2, { size: 13, color: nameColor });
      renderer.drawSeasonGauge(panelX + 90, ry + 2, a.currentSeason);

      const barX = panelX + 240;
      const hpColor = (a.hp / a.maxHp) < 0.3 ? '#E74C3C' : '#2ECC71';
      renderer.drawText('HP', barX, ry + 2, { size: 11, color: '#AAA' });
      renderer.drawBar(barX + 22, ry + 4, 100, 10, a.hp, a.maxHp, hpColor);
      renderer.drawText(`${a.hp}/${a.maxHp}`, barX + 125, ry + 2, { size: 11, color: '#CCC' });

      const mpX = panelX + 400;
      renderer.drawText('MP', mpX, ry + 2, { size: 11, color: '#AAA' });
      renderer.drawBar(mpX + 22, ry + 4, 50, 10, a.mp, a.maxMp, '#3498DB');
      renderer.drawText(`${a.mp}`, mpX + 75, ry + 2, { size: 11, color: '#88BBFF' });
    }
  }

  // ---- Command menu (right bottom) ----

  _drawCommandMenu(renderer) {
    const panelX = 520;
    const panelY = 420;
    const panelW = 430;
    const panelH = 114;

    renderer.drawRoundedRect(panelX, panelY, panelW, panelH, 8, 'rgba(0,0,0,0.8)', '#777');

    const btnW = 100;
    const btnH = 42;
    const gap = 8;

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = panelX + 10 + col * (btnW + gap);
      const by = panelY + 10 + row * (btnH + gap);
      const selected = (i === this.selectedCommand);

      const bgColor = selected ? 'rgba(255,215,0,0.3)' : 'rgba(60,60,80,0.8)';
      const borderColor = selected ? '#FFD700' : '#555';
      renderer.drawRoundedRect(bx, by, btnW, btnH, 6, bgColor, borderColor);

      renderer.drawText(this.commands[i].name, bx + btnW / 2, by + 6, {
        size: 16, align: 'center', color: selected ? '#FFD700' : '#DDD',
      });
      renderer.drawText(`[${this.commands[i].key}]`, bx + btnW / 2, by + 26, {
        size: 10, align: 'center', color: '#888',
      });
    }

    // Unity button (if available)
    const unitySeason = this.engine.checkUnityAvailable();
    if (unitySeason) {
      const ux = panelX + 230;
      const uy = panelY + 10;
      const uw = 190;
      const uh = 42;
      const uColor = SEASON_COLORS[unitySeason].primary;
      renderer.drawRoundedRect(ux, uy, uw, uh, 6, 'rgba(255,255,255,0.15)', uColor);
      renderer.drawText('四季の合一', ux + uw / 2, uy + 6, {
        size: 16, align: 'center', color: uColor,
      });
      renderer.drawText(`[${SEASON_NAMES[unitySeason]}]`, ux + uw / 2, uy + 26, {
        size: 11, align: 'center', color: '#DDD',
      });
    }

    // Command description
    renderer.drawText(this.commands[this.selectedCommand].desc, panelX + panelW / 2, panelY + panelH - 14, {
      size: 11, align: 'center', color: '#AAA',
    });
  }

  // ---- Skill menu ----

  _drawSkillMenu(renderer) {
    const unit = this.engine.currentUnit;
    if (!unit) return;
    const skills = unit.skills;

    const panelX = 510;
    const panelY = 418;
    const panelW = 440;
    const panelH = Math.max(116, skills.length * 28 + 20);

    renderer.drawRoundedRect(panelX, panelY, panelW, panelH, 8, 'rgba(0,0,0,0.85)', '#777');
    renderer.drawText('スキル選択 [ESC:戻る]', panelX + 10, panelY + 4, { size: 11, color: '#888' });

    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      const iy = panelY + 22 + i * 28;
      const selected = (i === this.selectedSkill);

      if (selected) {
        renderer.drawRect(panelX + 4, iy - 2, panelW - 8, 26, 'rgba(255,215,0,0.2)');
      }

      const sSeason = s.season || unit.currentSeason;
      const sColor = SEASON_COLORS[sSeason].primary;
      renderer.drawRect(panelX + 12, iy + 6, 12, 12, sColor);

      const canUse = unit.mp >= (s.mpCost || 0);
      renderer.drawText(s.name, panelX + 32, iy + 4, {
        size: 14, color: canUse ? (selected ? '#FFD700' : '#FFF') : '#666',
      });

      renderer.drawText(`MP:${s.mpCost || 0}`, panelX + 200, iy + 6, {
        size: 11, color: canUse ? '#88BBFF' : '#555',
      });

      renderer.drawText(SEASON_NAMES[sSeason], panelX + 260, iy + 6, {
        size: 11, color: sColor,
      });

      if (s.power) {
        renderer.drawText(`威力:${s.power}`, panelX + 310, iy + 6, {
          size: 11, color: '#AAA',
        });
      }

      const typeLabel = s.type === 'heal' ? '回復' : s.type === 'magic' ? '魔法' : '物理';
      renderer.drawText(typeLabel, panelX + 380, iy + 6, {
        size: 11, color: '#999',
      });
    }
  }

  // ---- Message box ----

  _drawMessageBox(renderer, text) {
    if (!text) return;
    const bx = 80;
    const by = 360;
    const bw = GAME_WIDTH - 160;
    const bh = 44;
    renderer.drawRoundedRect(bx, by, bw, bh, 8, 'rgba(0,0,0,0.85)', '#888');
    renderer.drawText(text, GAME_WIDTH / 2, by + 12, {
      size: 16, align: 'center', color: '#FFF',
    });
  }

  // ---- Result screen ----

  _drawResultScreen(renderer) {
    if (!this.resultData) return;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    renderer.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT, '#000', 0.6);
    renderer.drawRoundedRect(cx - 180, cy - 80, 360, 160, 12, 'rgba(20,20,40,0.95)', '#888');

    if (this.resultData.result === 'victory') {
      renderer.drawText('勝利!', cx, cy - 55, {
        size: 32, align: 'center', color: '#FFD700',
      });
      renderer.drawText(`獲得EXP: ${this.resultData.exp}`, cx, cy - 10, {
        size: 18, align: 'center', color: '#FFF',
      });
    } else {
      renderer.drawText('全滅...', cx, cy - 55, {
        size: 32, align: 'center', color: '#E74C3C',
      });
    }

    if (this.resultTimer > 1.0) {
      const blink = Math.sin(Date.now() / 300) > 0;
      if (blink) {
        renderer.drawText('決定キーで続ける', cx, cy + 40, {
          size: 14, align: 'center', color: '#AAA',
        });
      }
    }
  }
}
