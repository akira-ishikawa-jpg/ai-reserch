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
    this._error = null;
    try {
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
    } catch(e) {
      console.error('[BattleScene] enter error:', e.message, e.stack);
      this._error = e.message;
      // フェードを強制リセット
      this.game.renderer.fadeAlpha = 0;
      this.game.renderer.fadeTarget = 0;
    }
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
    // Safety: prevent infinite loop by limiting state transitions per frame
    if (this._updateGuard) { console.warn('[Battle] update re-entered!'); return; }
    this._updateGuard = true;
    try {

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

    } catch(e) {
      console.error('[Battle] update error:', e.message, e.stack);
      this._error = e.message;
    } finally {
      this._updateGuard = false;
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
    const panelY = 404;
    const btnW = 100;
    const btnH = 44;
    const gap = 8;

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = panelX + 10 + col * (btnW + gap);
      const by = panelY + 10 + row * (btnH + gap);
      if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) return i;
    }
    return -1;
  }

  _hitTestUnity(x, y) {
    return x >= 750 && x <= 940 && y >= 414 && y <= 458;
  }

  _hitTestSkillList(x, y, count) {
    const panelX = 510;
    const panelY = 404;
    const headerH = 24;
    const itemH = 30;
    for (let i = 0; i < count; i++) {
      const iy = panelY + headerH + 4 + i * itemH;
      if (x >= panelX && x <= 950 && y >= iy && y <= iy + itemH) return i;
    }
    return -1;
  }

  // ============ Draw ============

  draw(renderer) {
    renderer.ctx.globalAlpha = 1;
    // Force disable fade during battle (prevent black screen)
    renderer.fadeAlpha = 0;
    renderer.fadeTarget = 0;

    if (this._error) {
      renderer.clear('#300');
      renderer.drawText('Battle Error: ' + this._error, 20, 20, {size: 16, color: '#F00'});
      renderer.drawText('Press Space to return', 20, 50, {size: 14, color: '#FFF'});
      if (this.game.input.isJustPressed(' ')) this.game.scenes.pop();
      return;
    }
    if (!this.engine) {
      renderer.clear('#300');
      renderer.drawText('Engine not initialized', 20, 20, {size: 16, color: '#F00'});
      return;
    }

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

    // Turn indicator with panel
    const curUnit = this.engine.currentUnit;
    if (curUnit && (this.uiState === 'command' || this.uiState === 'skillSelect')) {
      const turnText = `${curUnit.name}のターン`;
      const tw = 200;
      renderer.drawRoundedRect(GAME_WIDTH / 2 - tw / 2, 4, tw, 28, 6, 'rgba(0,0,0,0.6)', 'rgba(255,215,0,0.4)');
      renderer.drawText(turnText, GAME_WIDTH / 2, 8, {
        size: 16, align: 'center', color: '#FFD700',
        outline: true, outlineColor: '#000', outlineWidth: 2,
      });
    }
  }

  // ---- Background ----

  _drawBackground(renderer) {
    const colors = SEASON_COLORS[this.background] || SEASON_COLORS[SEASON.SPRING];
    const season = this.background;
    const ctx = renderer.ctx;
    const now = Date.now();

    // === Sky gradient (3-stop for richer depth) ===
    const skyColors = {
      [SEASON.SPRING]: ['#FFE8F0', '#FFDAE8', '#F0C8D8'],
      [SEASON.SUMMER]: ['#68B8E8', '#4AA3DF', '#3888C0'],
      [SEASON.AUTUMN]: ['#FFD8B0', '#E8A060', '#C88040'],
      [SEASON.WINTER]: ['#D0E0F8', '#8AA8D0', '#6888B0'],
    };
    const sky = skyColors[season] || skyColors[SEASON.SPRING];
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 210);
    skyGrad.addColorStop(0, sky[0]);
    skyGrad.addColorStop(0.6, sky[1]);
    skyGrad.addColorStop(1, sky[2]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, 210);

    // === 大気遠近法: 3層の山シルエット（遠→近で色が濃くなる） ===

    // Mountain layer 1 (farthest — 最も薄い、空に近い色)
    const mtnFar = {
      [SEASON.SPRING]: 'rgba(200,210,190,0.35)',
      [SEASON.SUMMER]: 'rgba(100,160,100,0.3)',
      [SEASON.AUTUMN]: 'rgba(190,140,100,0.3)',
      [SEASON.WINTER]: 'rgba(180,185,210,0.35)',
    };
    ctx.fillStyle = mtnFar[season] || mtnFar[SEASON.SPRING];
    ctx.beginPath();
    ctx.moveTo(0, 170);
    ctx.lineTo(100, 120); ctx.lineTo(220, 145); ctx.lineTo(360, 95);
    ctx.lineTo(480, 135); ctx.lineTo(600, 85); ctx.lineTo(720, 125);
    ctx.lineTo(840, 100); ctx.lineTo(GAME_WIDTH, 115);
    ctx.lineTo(GAME_WIDTH, 190); ctx.lineTo(0, 190);
    ctx.closePath();
    ctx.fill();

    // Mountain layer 2 (mid — 中間の色)
    const mtnMid = {
      [SEASON.SPRING]: 'rgba(160,185,140,0.45)',
      [SEASON.SUMMER]: 'rgba(40,120,50,0.45)',
      [SEASON.AUTUMN]: 'rgba(160,100,60,0.4)',
      [SEASON.WINTER]: 'rgba(140,150,185,0.45)',
    };
    ctx.fillStyle = mtnMid[season] || mtnMid[SEASON.SPRING];
    ctx.beginPath();
    ctx.moveTo(0, 190);
    ctx.lineTo(80, 140); ctx.lineTo(180, 165); ctx.lineTo(300, 120);
    ctx.lineTo(420, 155); ctx.lineTo(540, 110); ctx.lineTo(660, 148);
    ctx.lineTo(780, 125); ctx.lineTo(880, 160); ctx.lineTo(GAME_WIDTH, 140);
    ctx.lineTo(GAME_WIDTH, 210); ctx.lineTo(0, 210);
    ctx.closePath();
    ctx.fill();

    // Mountain layer 3 (nearest — 最も濃い)
    const mtnNear = {
      [SEASON.SPRING]: 'rgba(110,150,90,0.55)',
      [SEASON.SUMMER]: 'rgba(20,80,30,0.55)',
      [SEASON.AUTUMN]: 'rgba(130,70,40,0.5)',
      [SEASON.WINTER]: 'rgba(100,110,150,0.5)',
    };
    ctx.fillStyle = mtnNear[season] || mtnNear[SEASON.SPRING];
    ctx.beginPath();
    ctx.moveTo(0, 215);
    ctx.lineTo(120, 175); ctx.lineTo(250, 195); ctx.lineTo(400, 165);
    ctx.lineTo(550, 190); ctx.lineTo(700, 170); ctx.lineTo(850, 188);
    ctx.lineTo(GAME_WIDTH, 178);
    ctx.lineTo(GAME_WIDTH, 235); ctx.lineTo(0, 235);
    ctx.closePath();
    ctx.fill();

    // === Forest/tree silhouettes ===
    const treeColor = {
      [SEASON.SPRING]: 'rgba(100,160,80,0.55)',
      [SEASON.SUMMER]: 'rgba(30,100,20,0.6)',
      [SEASON.AUTUMN]: 'rgba(180,80,30,0.5)',
      [SEASON.WINTER]: 'rgba(90,100,130,0.45)',
    };
    ctx.fillStyle = treeColor[season] || treeColor[SEASON.SPRING];
    for (let tx = -20; tx < GAME_WIDTH + 20; tx += 45 + Math.sin(tx * 0.1) * 15) {
      const treeH = 25 + Math.sin(tx * 0.05) * 12;
      ctx.beginPath();
      ctx.arc(tx, 238, treeH, Math.PI, 0);
      ctx.fill();
    }

    // === Mid-ground field ===
    const fieldTop = {
      [SEASON.SPRING]: '#C8E6B0',
      [SEASON.SUMMER]: '#4CAF50',
      [SEASON.AUTUMN]: '#C08040',
      [SEASON.WINTER]: '#B8C8E0',
    };
    const fieldBot = {
      [SEASON.SPRING]: '#A8D490',
      [SEASON.SUMMER]: '#2E7D32',
      [SEASON.AUTUMN]: '#8B5A2B',
      [SEASON.WINTER]: '#98A8C8',
    };
    renderer.drawGradientRect(0, 233, GAME_WIDTH, 120, fieldTop[season] || '#C8E6B0', fieldBot[season] || '#A8D490');

    // === Ground texture (grass + stone pattern) ===
    const groundTop = {
      [SEASON.SPRING]: '#8BB870',
      [SEASON.SUMMER]: '#1B5E20',
      [SEASON.AUTUMN]: '#6B4226',
      [SEASON.WINTER]: '#788098',
    };
    renderer.drawGradientRect(0, 350, GAME_WIDTH, 60, groundTop[season] || '#8BB870', '#2a2a3a');

    // 地面テクスチャ（草+石のパターン）
    ctx.save();
    for (let gx = 0; gx < GAME_WIDTH; gx += 16) {
      for (let gy = 350; gy < 395; gy += 12) {
        const rnd = seededRandom(gx, gy, 555);
        if (rnd < 0.15) {
          // 小石
          ctx.fillStyle = `rgba(60,50,40,${0.08 + rnd * 0.1})`;
          ctx.beginPath();
          ctx.ellipse(gx + rnd * 14, gy + rnd * 8, 2 + rnd * 3, 1.5 + rnd * 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (rnd < 0.35 && season !== SEASON.WINTER) {
          // 短い草
          const grassGreen = season === SEASON.AUTUMN ? 'rgba(120,80,40,0.15)' : 'rgba(60,120,40,0.15)';
          ctx.strokeStyle = grassGreen;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(gx + rnd * 12, gy + 6);
          ctx.lineTo(gx + rnd * 12 + Math.sin(now * 0.001 + gx) * 1.5, gy);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    renderer.drawRect(0, 395, GAME_WIDTH, GAME_HEIGHT - 395, '#1a1a2a');

    // === Ambient glow from season ===
    const glowAlpha = 0.08 + 0.04 * Math.sin(now / 2000);
    renderer.drawGlow(GAME_WIDTH / 2, 180, 400, colors.primary, glowAlpha);

    // === 花霞レイヤー（バトル用霧） ===
    ctx.save();
    const hazeColor = {
      [SEASON.SPRING]: [255, 220, 235],
      [SEASON.SUMMER]: [255, 248, 220],
      [SEASON.AUTUMN]: [255, 210, 180],
      [SEASON.WINTER]: [210, 220, 250],
    };
    const hc = hazeColor[season] || hazeColor[SEASON.SPRING];
    const hazeAlpha = 0.04 + 0.02 * Math.sin(now / 3000);
    const hazeY = 180 + Math.sin(now / 4000) * 8;
    const hazeGrad = ctx.createLinearGradient(0, hazeY, 0, hazeY + 120);
    hazeGrad.addColorStop(0, `rgba(${hc[0]},${hc[1]},${hc[2]},0)`);
    hazeGrad.addColorStop(0.4, `rgba(${hc[0]},${hc[1]},${hc[2]},${hazeAlpha})`);
    hazeGrad.addColorStop(0.6, `rgba(${hc[0]},${hc[1]},${hc[2]},${hazeAlpha * 0.7})`);
    hazeGrad.addColorStop(1, `rgba(${hc[0]},${hc[1]},${hc[2]},0)`);
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, hazeY, GAME_WIDTH, 120);
    ctx.restore();

    // === Season-specific decorative elements ===
    ctx.save();
    if (season === SEASON.SPRING) {
      // Cherry blossom trees in mid-ground
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#FFB7C5';
      ctx.beginPath(); ctx.arc(150, 255, 30, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(700, 260, 25, 0, Math.PI * 2); ctx.fill();
      // Scattered petals on ground
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 12; i++) {
        const petalX = seededRandom(i, 0, 888) * GAME_WIDTH;
        const petalY = 355 + seededRandom(i, 1, 888) * 35;
        ctx.fillStyle = `rgba(255,${170 + Math.floor(seededRandom(i, 2, 888) * 50)},${190 + Math.floor(seededRandom(i, 3, 888) * 30)},0.3)`;
        ctx.beginPath();
        ctx.ellipse(petalX, petalY, 2.5, 1.5, seededRandom(i, 4, 888) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (season === SEASON.SUMMER) {
      // Heat shimmer lines
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#FFD700';
      for (let sy = 200; sy < 350; sy += 20) {
        const wave = Math.sin(now / 1000 + sy * 0.1) * 3;
        renderer.drawRect(0, sy + wave, GAME_WIDTH, 2, '#FFD700', 0.06);
      }
      ctx.globalAlpha = 1;
    } else if (season === SEASON.AUTUMN) {
      // Scattered fallen leaves on ground
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 8; i++) {
        const lx = seededRandom(i, 0, 777) * GAME_WIDTH;
        const ly = 358 + seededRandom(i, 1, 777) * 30;
        const lc = seededRandom(i, 2, 777) > 0.5 ? '#DC143C' : '#DAA520';
        ctx.fillStyle = lc;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(seededRandom(i, 3, 777) * Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(2, 0);
        ctx.lineTo(0, 3);
        ctx.lineTo(-2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else if (season === SEASON.WINTER) {
      // Ground snow patches
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#E8F0FF';
      for (let sx = 30; sx < GAME_WIDTH; sx += 100 + Math.sin(sx) * 30) {
        ctx.beginPath();
        ctx.ellipse(sx, 370, 40 + Math.sin(sx * 0.1) * 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
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
    const w = 56;
    const h = 72;
    const scale = 4;

    if (!unit.alive) {
      // Dead unit: faded silhouette on the ground
      renderer.ctx.save();
      renderer.ctx.globalAlpha = 0.35;
      renderer.drawRect(x + 4, y + h * 0.65, w - 8, h * 0.35, '#444');
      renderer.drawText('×', x + w / 2, y + h * 0.55, {
        size: 24, align: 'center', color: '#888',
      });
      renderer.ctx.restore();
      return;
    }

    const seasonColor = SEASON_COLORS[unit.currentSeason];

    // === Guard shield effect ===
    if (unit.isGuarding) {
      const pulse = 0.15 + 0.08 * Math.sin(Date.now() / 400);
      renderer.drawGlow(x + w / 2, y + h / 2, w * 0.9, seasonColor.primary, pulse + 0.1);
      renderer.drawRoundedRect(x - 6, y - 6, w + 12, h + 12, 8, null, seasonColor.primary);
      renderer.drawRect(x - 4, y - 4, w + 8, h + 8, seasonColor.primary, 0.12);
    }

    // === Season aura glow (behind character) ===
    const auraPulse = 0.12 + 0.06 * Math.sin(Date.now() / 600);
    renderer.drawGlow(x + w / 2, y + h / 2, w * 0.7, seasonColor.primary, auraPulse);

    // === Character rendering with drawPixelChar ===
    const sprite = unit.spriteData || {};
    let pixelType = null;

    if (!isEnemy) {
      // Allies: use hero/healer pixel chars
      const allyIdx = this.engine.allies.indexOf(unit);
      pixelType = (allyIdx === 1) ? 'healer' : 'hero';
    } else {
      // Enemies: use pixelType from spriteData if available
      pixelType = sprite.pixelType || null;
    }

    if (pixelType && PIXEL_CHARS[pixelType]) {
      const frame = Math.floor(Date.now() / 500) % 2;
      const direction = isEnemy ? 'left' : 'right';
      renderer.drawPixelChar(x + 4, y + 4, scale, pixelType, {
        direction,
        frame,
        season: unit.currentSeason,
      });
    } else {
      // Fallback: drawSprite (for enemies without pixel data)
      const fallbackSprite = {
        bodyColor: sprite.bodyColor || (isEnemy ? '#8B0000' : '#336699'),
        headColor: sprite.headColor || (isEnemy ? '#CC4444' : '#6699CC'),
        season: unit.currentSeason,
      };
      renderer.drawSprite(x, y, w, h, fallbackSprite);
    }

    // === Character name (above) ===
    renderer.drawText(unit.name, x + w / 2, y - 22, {
      size: 13, align: 'center', color: isEnemy ? '#FF9999' : '#AADDFF',
      outline: true, outlineColor: '#000', outlineWidth: 3,
    });

    // === HP bar (below character, for ALL units) ===
    const barW = w + 4;
    const barX = x - 2;
    const barY = y + h + 2;
    const hpRatio = unit.hp / unit.maxHp;
    let hpColor;
    if (hpRatio > 0.5) {
      hpColor = '#2ECC71';
    } else if (hpRatio > 0.25) {
      hpColor = '#F1C40F';
    } else {
      hpColor = '#E74C3C';
    }
    renderer.drawBar(barX, barY, barW, 6, unit.hp, unit.maxHp, hpColor, '#222');
    // HP text
    if (!isEnemy) {
      renderer.drawText(`${unit.hp}/${unit.maxHp}`, x + w / 2, barY + 8, {
        size: 9, align: 'center', color: '#CCC',
      });
    }

    // === Season indicator dot + label ===
    const dotY = isEnemy ? barY + 10 : barY + 20;
    const dotColor = seasonColor.primary;
    renderer.drawRect(x + w / 2 - 5, dotY, 10, 10, dotColor);
    renderer.drawRectOutline(x + w / 2 - 5, dotY, 10, 10, '#FFF', 1);
    renderer.drawText(SEASON_NAMES[unit.currentSeason], x + w / 2, dotY + 12, {
      size: 10, align: 'center', color: dotColor,
    });

    // === Status effects ===
    const statusY = y + h / 2 - 8;
    if (unit.stunTurns > 0) {
      renderer.drawGlow(x + w / 2, statusY + 8, 30, '#88CCFF', 0.3);
      renderer.drawText('凍結', x + w / 2, statusY, {
        size: 14, align: 'center', color: '#88CCFF',
        outline: true, outlineColor: '#003', outlineWidth: 2,
      });
    }
    if (unit.skillSealTurns > 0) {
      renderer.drawGlow(x + w / 2, statusY + 24, 25, '#CC88FF', 0.25);
      renderer.drawText('封印', x + w / 2, statusY + 18, {
        size: 12, align: 'center', color: '#CC88FF',
        outline: true, outlineColor: '#200030', outlineWidth: 2,
      });
    }

    // === Guard buff icon ===
    if (unit.isGuarding) {
      renderer.drawText('🛡', x + w - 4, y - 4, { size: 14, align: 'center', color: '#FFD700' });
    }
  }

  // ---- Floating texts ----

  _drawFloatingTexts(renderer) {
    for (const ft of this.floatingTexts) {
      // Glow behind damage numbers for emphasis
      const glowAlpha = Math.min(1, ft.timer / 0.6) * 0.4;
      renderer.drawGlow(ft.x, ft.y + 8, (ft.size || 22) * 0.8, ft.color, glowAlpha);
      renderer.drawText(ft.text, ft.x, ft.y, {
        size: ft.size || 22,
        color: ft.color,
        align: 'center',
        outline: true,
        outlineColor: '#000',
        outlineWidth: 3,
      });
    }
  }

  // ---- Status panel (left bottom) ----

  _drawStatusPanel(renderer) {
    const panelX = 8;
    const panelY = 404;
    const panelW = 500;
    const panelH = 132;

    // Panel background with gradient feel
    renderer.drawRoundedRect(panelX, panelY, panelW, panelH, 10, 'rgba(10,10,30,0.85)', 'rgba(100,100,140,0.6)');

    const allies = this.engine.allies;
    const rowH = Math.min(42, Math.floor((panelH - 10) / Math.max(allies.length, 1)));

    for (let i = 0; i < allies.length; i++) {
      const a = allies[i];
      const ry = panelY + 6 + i * rowH;

      const isCurrent = (this.engine.currentUnit === a && (this.uiState === 'command' || this.uiState === 'skillSelect'));
      if (isCurrent) {
        renderer.drawRoundedRect(panelX + 3, ry - 1, panelW - 6, rowH - 2, 4, 'rgba(255,215,0,0.12)', 'rgba(255,215,0,0.35)');
        // Active indicator arrow
        renderer.drawText('\u25B6', panelX + 6, ry + 4, { size: 10, color: '#FFD700' });
      }

      // Name + Level
      const nameColor = a.alive ? '#FFF' : '#555';
      const lvlText = a.level ? `Lv.${a.level}` : '';
      renderer.drawText(a.name, panelX + 18, ry + 2, { size: 13, color: nameColor });
      if (lvlText) {
        renderer.drawText(lvlText, panelX + 18, ry + 17, { size: 9, color: '#888' });
      }

      // Season gauge
      renderer.drawSeasonGauge(panelX + 84, ry + 2, a.currentSeason);

      // HP Bar with color gradient (green > yellow > red)
      const barX = panelX + 224;
      const hpRatio = a.hp / a.maxHp;
      let hpColor;
      if (hpRatio > 0.5) {
        hpColor = '#2ECC71';
      } else if (hpRatio > 0.25) {
        hpColor = '#F1C40F';
      } else {
        hpColor = '#E74C3C';
      }
      renderer.drawText('HP', barX, ry + 2, { size: 10, color: '#8A8' });
      renderer.drawBar(barX + 20, ry + 4, 110, 11, a.hp, a.maxHp, hpColor, '#1a1a2a');
      renderer.drawText(`${a.hp}/${a.maxHp}`, barX + 134, ry + 2, { size: 10, color: '#CCC' });

      // MP Bar
      const mpX = panelX + 396;
      renderer.drawText('MP', mpX, ry + 2, { size: 10, color: '#88A' });
      renderer.drawBar(mpX + 20, ry + 4, 52, 11, a.mp, a.maxMp, '#3498DB', '#1a1a2a');
      renderer.drawText(`${a.mp}/${a.maxMp}`, mpX + 76, ry + 2, { size: 10, color: '#88BBFF' });

      // Buff indicators on second line
      let buffX = barX;
      if (a.isGuarding) {
        renderer.drawRect(buffX, ry + 20, 36, 14, 'rgba(100,180,255,0.25)');
        renderer.drawRectOutline(buffX, ry + 20, 36, 14, '#88BBFF');
        renderer.drawText('防御', buffX + 18, ry + 21, { size: 9, align: 'center', color: '#AADDFF' });
        buffX += 40;
      }
      if (a.nextSkillBoost) {
        renderer.drawRect(buffX, ry + 20, 42, 14, 'rgba(255,200,60,0.25)');
        renderer.drawRectOutline(buffX, ry + 20, 42, 14, '#FFD700');
        renderer.drawText('強化', buffX + 21, ry + 21, { size: 9, align: 'center', color: '#FFD700' });
        buffX += 46;
      }
      if (a.stunTurns > 0) {
        renderer.drawRect(buffX, ry + 20, 36, 14, 'rgba(100,180,255,0.2)');
        renderer.drawRectOutline(buffX, ry + 20, 36, 14, '#88CCFF');
        renderer.drawText('凍結', buffX + 18, ry + 21, { size: 9, align: 'center', color: '#88CCFF' });
        buffX += 40;
      }
      if (a.skillSealTurns > 0) {
        renderer.drawRect(buffX, ry + 20, 36, 14, 'rgba(180,100,255,0.2)');
        renderer.drawRectOutline(buffX, ry + 20, 36, 14, '#CC88FF');
        renderer.drawText('封印', buffX + 18, ry + 21, { size: 9, align: 'center', color: '#CC88FF' });
      }
    }
  }

  // ---- Command menu (right bottom) ----

  _drawCommandMenu(renderer) {
    const panelX = 520;
    const panelY = 404;
    const panelW = 430;
    const panelH = 132;

    // Panel background
    renderer.drawRoundedRect(panelX, panelY, panelW, panelH, 10, 'rgba(10,10,30,0.88)', 'rgba(100,100,140,0.6)');

    const btnW = 100;
    const btnH = 44;
    const gap = 8;

    // Season-themed accent colors for each command
    const seasonColors = SEASON_COLORS[this.background] || SEASON_COLORS[SEASON.SPRING];
    const cmdAccents = [
      seasonColors.primary,   // 巡る — season primary
      '#4488CC',              // 留まる — blue (defense)
      '#AA66DD',              // スキル — purple (magic)
      '#66BB66',              // アイテム — green (items)
    ];

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = panelX + 10 + col * (btnW + gap);
      const by = panelY + 10 + row * (btnH + gap);
      const selected = (i === this.selectedCommand);
      const accent = cmdAccents[i];

      if (selected) {
        // Glow behind selected button
        renderer.drawGlow(bx + btnW / 2, by + btnH / 2, btnW * 0.6, accent, 0.2);
        renderer.drawRoundedRect(bx, by, btnW, btnH, 6, 'rgba(255,215,0,0.25)', '#FFD700');
      } else {
        renderer.drawRoundedRect(bx, by, btnW, btnH, 6, 'rgba(40,40,60,0.85)', 'rgba(80,80,100,0.6)');
      }

      // Colored accent bar on the left of button
      renderer.drawRect(bx + 3, by + 6, 3, btnH - 12, accent);

      renderer.drawText(this.commands[i].name, bx + btnW / 2 + 4, by + 6, {
        size: 16, align: 'center', color: selected ? '#FFD700' : '#DDD',
      });
      renderer.drawText(`[${this.commands[i].key}]`, bx + btnW / 2 + 4, by + 27, {
        size: 10, align: 'center', color: selected ? '#BBA030' : '#666',
      });
    }

    // Unity button (if available)
    const unitySeason = this.engine.checkUnityAvailable();
    if (unitySeason) {
      const ux = panelX + 230;
      const uy = panelY + 10;
      const uw = 190;
      const uh = 44;
      const uColor = SEASON_COLORS[unitySeason].primary;
      const pulse = 0.15 + 0.1 * Math.sin(Date.now() / 400);

      renderer.drawGlow(ux + uw / 2, uy + uh / 2, uw * 0.5, uColor, pulse);
      renderer.drawRoundedRect(ux, uy, uw, uh, 6, 'rgba(255,255,255,0.12)', uColor);
      renderer.drawText('四季の合一', ux + uw / 2, uy + 6, {
        size: 16, align: 'center', color: uColor,
      });
      renderer.drawText(`[${SEASON_NAMES[unitySeason]}]`, ux + uw / 2, uy + 27, {
        size: 11, align: 'center', color: '#DDD',
      });
    }

    // Command description at bottom
    const descCmd = this.commands[this.selectedCommand];
    renderer.drawRect(panelX + 10, panelY + panelH - 22, panelW - 20, 16, 'rgba(255,255,255,0.04)');
    renderer.drawText(descCmd.desc, panelX + panelW / 2, panelY + panelH - 20, {
      size: 11, align: 'center', color: '#AAA',
    });
  }

  // ---- Skill menu ----

  _drawSkillMenu(renderer) {
    const unit = this.engine.currentUnit;
    if (!unit) return;
    const skills = unit.skills;

    const panelX = 510;
    const panelY = 404;
    const panelW = 440;
    const itemH = 30;
    const headerH = 24;
    const footerH = 28;
    const panelH = Math.max(132, skills.length * itemH + headerH + footerH + 8);

    renderer.drawRoundedRect(panelX, panelY, panelW, panelH, 10, 'rgba(10,10,30,0.92)', 'rgba(100,100,140,0.6)');

    // Header
    renderer.drawRect(panelX + 4, panelY + 2, panelW - 8, headerH, 'rgba(255,255,255,0.04)');
    renderer.drawText('スキル選択', panelX + 14, panelY + 5, { size: 12, color: '#CCC' });
    renderer.drawText('[ESC:戻る]', panelX + panelW - 14, panelY + 7, { size: 10, align: 'right', color: '#666' });

    // Skill list
    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      const iy = panelY + headerH + 4 + i * itemH;
      const selected = (i === this.selectedSkill);
      const canUse = unit.mp >= (s.mpCost || 0);
      const sSeason = s.season || unit.currentSeason;
      const sColor = SEASON_COLORS[sSeason].primary;

      // Selection highlight
      if (selected) {
        renderer.drawRoundedRect(panelX + 4, iy - 1, panelW - 8, itemH - 2, 4, 'rgba(255,215,0,0.15)', 'rgba(255,215,0,0.35)');
        // Selection indicator
        renderer.drawText('\u25B6', panelX + 8, iy + 5, { size: 10, color: '#FFD700' });
      }

      // Season color dot (rounded)
      if (canUse) {
        renderer.drawGlow(panelX + 24, iy + 12, 8, sColor, 0.4);
      }
      renderer.drawRect(panelX + 18, iy + 6, 12, 12, canUse ? sColor : '#444');
      renderer.drawRectOutline(panelX + 18, iy + 6, 12, 12, canUse ? '#FFF' : '#333', 1);

      // Skill name
      const nameColor = canUse ? (selected ? '#FFD700' : '#EEE') : '#555';
      renderer.drawText(s.name, panelX + 38, iy + 4, { size: 14, color: nameColor });

      // MP cost (right-aligned area)
      const mpColor = canUse ? '#88BBFF' : '#444';
      renderer.drawText(`MP:${s.mpCost || 0}`, panelX + 210, iy + 7, { size: 11, color: mpColor });

      // Season name
      renderer.drawText(SEASON_NAMES[sSeason], panelX + 270, iy + 7, {
        size: 11, color: canUse ? sColor : '#444',
      });

      // Power
      if (s.power) {
        renderer.drawText(`威力:${s.power}`, panelX + 320, iy + 7, {
          size: 11, color: canUse ? '#AAA' : '#444',
        });
      }

      // Type label
      const typeLabel = s.type === 'heal' ? '回復' : s.type === 'magic' ? '魔法' : '物理';
      const typeColor = s.type === 'heal' ? '#66CC66' : s.type === 'magic' ? '#AA88DD' : '#CC8866';
      renderer.drawText(typeLabel, panelX + 390, iy + 7, {
        size: 11, color: canUse ? typeColor : '#444',
      });

      // Grey-out overlay for unusable skills
      if (!canUse) {
        renderer.drawRect(panelX + 4, iy - 1, panelW - 8, itemH - 2, 'rgba(0,0,0,0.3)');
      }
    }

    // Footer: selected skill description
    const footerY = panelY + panelH - footerH;
    renderer.drawRect(panelX + 4, footerY, panelW - 8, footerH - 4, 'rgba(255,255,255,0.03)');
    const selSkill = skills[this.selectedSkill];
    if (selSkill) {
      const desc = selSkill.description || selSkill.desc || '';
      if (desc) {
        renderer.drawText(desc, panelX + panelW / 2, footerY + 6, {
          size: 11, align: 'center', color: '#999',
        });
      }
    }
  }

  // ---- Message box ----

  _drawMessageBox(renderer, text) {
    if (!text) return;
    const bx = 100;
    const by = 350;
    const bw = GAME_WIDTH - 200;
    const bh = 50;

    // Semi-transparent dark background with border
    renderer.drawRoundedRect(bx, by, bw, bh, 10, 'rgba(5,5,20,0.88)', 'rgba(200,200,220,0.6)');

    // Subtle inner glow at the edges
    const seasonColor = SEASON_COLORS[this.background] || SEASON_COLORS[SEASON.SPRING];
    renderer.drawRect(bx + 4, by + 2, bw - 8, 1, seasonColor.primary, 0.3);

    // Message text
    renderer.drawText(text, GAME_WIDTH / 2, by + 14, {
      size: 17, align: 'center', color: '#FFF',
      shadow: true, shadowColor: '#000',
    });
  }

  // ---- Result screen ----

  _drawResultScreen(renderer) {
    if (!this.resultData) return;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Dark overlay
    renderer.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT, '#000', 0.65);

    if (this.resultData.result === 'victory') {
      // Golden victory glow
      const glowPulse = 0.2 + 0.1 * Math.sin(Date.now() / 500);
      renderer.drawGlow(cx, cy - 30, 200, '#FFD700', glowPulse);
      renderer.drawGlow(cx, cy - 30, 120, '#FFF8DC', glowPulse * 0.6);

      // Result panel
      renderer.drawRoundedRect(cx - 200, cy - 90, 400, 180, 14, 'rgba(15,15,35,0.92)', 'rgba(255,215,0,0.5)');

      // Victory text with outline
      renderer.drawText('勝利!', cx, cy - 70, {
        size: 38, align: 'center', color: '#FFD700',
        outline: true, outlineColor: '#000', outlineWidth: 4,
      });

      // Decorative line
      renderer.drawGradientRect(cx - 100, cy - 30, 200, 2, '#FFD700', 'rgba(255,215,0,0)');

      // EXP display
      renderer.drawText('獲得経験値', cx, cy - 15, {
        size: 13, align: 'center', color: '#AAA',
      });
      renderer.drawText(`${this.resultData.exp} EXP`, cx, cy + 5, {
        size: 24, align: 'center', color: '#FFF',
        outline: true, outlineColor: '#000', outlineWidth: 2,
      });

      // Sparkle particles (add a few each frame during result)
      if (Math.random() < 0.15) {
        renderer.addParticle(this.background, cx + (Math.random() - 0.5) * 300, cy + (Math.random() - 0.5) * 150);
      }
    } else {
      // Defeat: red glow
      const defeatPulse = 0.15 + 0.08 * Math.sin(Date.now() / 600);
      renderer.drawGlow(cx, cy - 20, 160, '#E74C3C', defeatPulse);

      renderer.drawRoundedRect(cx - 200, cy - 90, 400, 180, 14, 'rgba(30,5,5,0.92)', 'rgba(200,50,50,0.5)');

      renderer.drawText('全滅...', cx, cy - 65, {
        size: 38, align: 'center', color: '#E74C3C',
        outline: true, outlineColor: '#000', outlineWidth: 4,
      });

      renderer.drawGradientRect(cx - 100, cy - 25, 200, 2, '#E74C3C', 'rgba(231,76,60,0)');
    }

    // Continue prompt (blinking)
    if (this.resultTimer > 1.0) {
      const alpha = 0.4 + 0.4 * Math.abs(Math.sin(Date.now() / 400));
      renderer.ctx.save();
      renderer.ctx.globalAlpha = alpha;
      renderer.drawText('Space / Enter で続ける', cx, cy + 55, {
        size: 14, align: 'center', color: '#CCC',
      });
      renderer.ctx.restore();
    }
  }
}
