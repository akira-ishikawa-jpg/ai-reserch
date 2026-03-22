// ====================================
// exploration.js — 探索シーン
// マップ描画・プレイヤー移動・シンボルエンカウント・NPC・宝箱・セーブ
// 読み込み順: constants.js → maps.js → exploration.js
// ====================================

class ExplorationScene extends Scene {
  constructor(game) {
    super();
    this.game = game;

    // プレイヤー状態
    this.player = {
      x: 0, y: 0,             // グリッド座標（タイル単位）
      pixelX: 0, pixelY: 0,   // 描画座標（ピクセル単位）
      targetX: 0, targetY: 0, // 移動先グリッド座標
      moving: false,
      direction: 'down',       // up, down, left, right
      moveTimer: 0,
      speed: 4,                // tiles/sec
      animFrame: 0,            // アニメーションフレーム
      animTimer: 0,
    };

    // カメラ
    this.camera = { x: 0, y: 0 };

    // マップ関連
    this.currentMap = null;
    this.visitedTiles = {};      // { "mapId": Set of "x,y" }
    this.openedChests = {};      // { "chestId": true }
    this.defeatedEncounters = {}; // { "encId": true }

    // 敵シンボル
    this.enemySymbols = [];

    // UI状態
    this.mapNameTimer = 0;        // マップ名表示タイマー
    this.mapNameDuration = 3.0;   // 表示秒数
    this.messageText = '';
    this.messageTimer = 0;
    this.messageDuration = 2.0;

    // パーティクル生成タイマー
    this.particleTimer = 0;

    // 遷移状態
    this.transitioning = false;
    this.transitionTarget = null;

    // 敵リスポーンタイマー
    this.respawnTimers = {}; // { "encId": remainingTime }
    this.respawnDelay = 15;  // 15秒でリスポーン

    // タイル装飾用シード（マップ読み込み時に生成）
    this.tileDecorations = null;
  }

  // ==========================================
  // シーンライフサイクル
  // ==========================================

  enter(data) {
    const mapId = (data && data.mapId) || 'kasumikari';
    const targetX = data && data.targetX;
    const targetY = data && data.targetY;
    this.loadMap(mapId, targetX, targetY);
    this.transitioning = false;
    this.game.renderer.startFade(0, 0.03);

    // BGM: マップに応じて切り替え
    if (this.game.audio && this.game.audio.ctx) {
      const bgmId = mapId.startsWith('sennen') ? 'dungeon_spring' : 'town_spring';
      this.game.audio.playBgm(bgmId);
    }
  }

  exit() {
    // 状態保存（後で拡張用）
  }

  pause() {
    // バトル・会話に遷移する際に呼ばれる
  }

  resume(data) {
    // バトル/会話から戻ってきた
    this.game.renderer.startFade(0, 0.03);

    // BGMを探索曲に戻す
    if (this.game.audio && this.game.audio.ctx && this.currentMap) {
      const bgmId = this.currentMap.id.startsWith('sennen') ? 'dungeon_spring' : 'town_spring';
      this.game.audio.playBgm(bgmId);
    }

    if (data && data.result === 'victory') {
      // 倒した敵シンボルを処理
      if (this._lastEncounterId) {
        const enc = this.getEncounterDef(this._lastEncounterId);
        if (enc && !enc.respawn) {
          this.defeatedEncounters[this._lastEncounterId] = true;
        }
        // シンボル削除
        this.enemySymbols = this.enemySymbols.filter(e => e.id !== this._lastEncounterId);
        // リスポーン設定
        if (enc && enc.respawn) {
          this.respawnTimers[this._lastEncounterId] = this.respawnDelay;
        }
        this._lastEncounterId = null;
      }
      // 経験値表示
      if (data.exp) {
        this.showMessage('勝利! ' + data.exp + ' EXP獲得!');
      }
    } else if (data && data.result === 'defeat') {
      // プロトタイプ: HP1で復活
      this.showMessage('倒れてしまった... 町に戻された');
      const party = this.game.state.party;
      if (party && party.members) {
        for (const m of party.members) {
          m.hp = 1;
          m.mp = Math.floor(m.maxMp * 0.1);
        }
      }
      this.loadMap('kasumikari');
    } else if (data && data.result === 'dialogue_end') {
      // 会話終了
      if (data.action === 'heal') {
        this.healParty();
        this.showMessage('体力が回復した!');
      }
    }
  }

  // ==========================================
  // マップ読み込み
  // ==========================================

  loadMap(mapId, targetX, targetY) {
    console.log('[Exploration] loadMap:', mapId);
    const mapDef = MAPS[mapId];
    if (!mapDef) {
      console.error('[Exploration] Map not found:', mapId, 'Available:', Object.keys(MAPS));
      return;
    }

    this.currentMap = mapDef;
    this.game.state.currentMap = mapId;

    // プレイヤー開始位置
    const startX = (targetX !== undefined) ? targetX : mapDef.playerStart.x;
    const startY = (targetY !== undefined) ? targetY : mapDef.playerStart.y;
    this.player.x = startX;
    this.player.y = startY;
    this.player.targetX = startX;
    this.player.targetY = startY;
    this.player.pixelX = startX * TILE_SIZE;
    this.player.pixelY = startY * TILE_SIZE;
    this.player.moving = false;

    // 訪問済みタイル初期化
    if (!this.visitedTiles[mapId]) {
      this.visitedTiles[mapId] = new Set();
    }
    this.markVisited(startX, startY);

    // タイル装飾シード生成
    this._generateTileDecorations(mapDef);

    // 敵シンボル生成
    this.initEnemySymbols();

    // マップ名表示
    this.mapNameTimer = this.mapNameDuration;

    // カメラ更新
    this.updateCamera();
  }

  _generateTileDecorations(map) {
    // 各タイルにランダムな装飾データを事前生成（パフォーマンス用）
    this.tileDecorations = [];
    for (let y = 0; y < map.height; y++) {
      this.tileDecorations[y] = [];
      for (let x = 0; x < map.width; x++) {
        // 疑似乱数（座標ベース、安定した結果）
        const seed = (x * 73 + y * 137 + 31) % 256;
        this.tileDecorations[y][x] = {
          checkerOffset: (x + y) % 2,
          dotX: (seed % 20) + 6,
          dotY: ((seed * 3) % 18) + 7,
          dotSize: (seed % 3) + 1,
          hasDot: seed % 4 === 0,
          grassType: seed % 3,
          stoneVariant: seed % 5,
        };
      }
    }
  }

  // ==========================================
  // 敵シンボル初期化
  // ==========================================

  initEnemySymbols() {
    this.enemySymbols = [];
    if (!this.currentMap || !this.currentMap.encounters) return;

    for (const enc of this.currentMap.encounters) {
      // 倒して復活しないやつはスキップ
      if (this.defeatedEncounters[enc.id]) continue;
      // リスポーン待ち中もスキップ
      if (this.respawnTimers[enc.id]) continue;

      this.enemySymbols.push({
        id: enc.id,
        x: enc.x,
        y: enc.y,
        pixelX: enc.x * TILE_SIZE,
        pixelY: enc.y * TILE_SIZE,
        homeX: enc.x,
        homeY: enc.y,
        targetX: enc.x,
        targetY: enc.y,
        moving: false,
        moveTimer: 0,
        patrolTimer: Math.random() * 2, // ランダム巡回タイマー
        chasing: false,
        enemies: enc.enemies,
        isBoss: enc.isBoss || false,
        speed: this.player.speed * 0.7,
      });
    }
  }

  // ==========================================
  // 更新
  // ==========================================

  update(dt) {
    try {
      if (this.transitioning) {
        this.updateTransition(dt);
        return;
      }
      if (this.game.renderer.isFading()) return;

      this.updatePlayerMovement(dt);
      this.updateEnemySymbols(dt);
      this.updateRespawnTimers(dt);
      this.updateCamera();
      this.updateParticles(dt);
      this.updateTimers(dt);
      this.checkInteraction();
    } catch(e) {
      console.error('[Exploration] update error:', e.message, e.stack);
    }
  }

  // ==========================================
  // プレイヤー移動
  // ==========================================

  updatePlayerMovement(dt) {
    const p = this.player;

    if (p.moving) {
      // 補間移動中
      p.moveTimer += dt * p.speed;
      const t = Math.min(p.moveTimer, 1);
      const ease = t * (2 - t); // easeOut

      const startX = (p.targetX - this.getMoveDirectionX()) * TILE_SIZE;
      const startY = (p.targetY - this.getMoveDirectionY()) * TILE_SIZE;
      p.pixelX = startX + (p.targetX * TILE_SIZE - startX) * ease;
      p.pixelY = startY + (p.targetY * TILE_SIZE - startY) * ease;

      // Animation frame toggle
      p.animTimer += dt;
      if (p.animTimer > 0.15) {
        p.animFrame = (p.animFrame + 1) % 2;
        p.animTimer = 0;
      }

      if (p.moveTimer >= 1) {
        p.x = p.targetX;
        p.y = p.targetY;
        p.pixelX = p.x * TILE_SIZE;
        p.pixelY = p.y * TILE_SIZE;
        p.moving = false;
        p.moveTimer = 0;

        // 訪問済みマーク
        this.markVisited(p.x, p.y);

        // マップ遷移チェック
        this.checkMapExit();

        // セーブポイントチェック
        this.checkSavePoint();
      }
      return;
    }

    // 新しい入力を受付
    const movement = this.game.input.getMovement();
    let dx = movement.dx;
    let dy = movement.dy;

    // 斜め移動は不可（1方向のみ）
    if (dx !== 0 && dy !== 0) {
      dy = 0; // 横優先
    }

    if (dx !== 0 || dy !== 0) {
      // 方向更新
      if (dx < 0) p.direction = 'left';
      else if (dx > 0) p.direction = 'right';
      else if (dy < 0) p.direction = 'up';
      else if (dy > 0) p.direction = 'down';

      const newX = p.x + dx;
      const newY = p.y + dy;

      if (this.canMoveTo(newX, newY)) {
        p.targetX = newX;
        p.targetY = newY;
        p.moving = true;
        p.moveTimer = 0;
        this._lastMoveDir = { dx, dy };
      }
    }
  }

  getMoveDirectionX() {
    return this._lastMoveDir ? this._lastMoveDir.dx : 0;
  }

  getMoveDirectionY() {
    return this._lastMoveDir ? this._lastMoveDir.dy : 0;
  }

  canMoveTo(x, y) {
    if (!this.currentMap) return false;
    if (x < 0 || y < 0 || x >= this.currentMap.width || y >= this.currentMap.height) return false;

    const tile = this.currentMap.tiles[y][x];
    if (!isTilePassable(tile)) return false;

    // NPC衝突チェック
    for (const npc of this.currentMap.npcs) {
      if (npc.x === x && npc.y === y) return false;
    }

    return true;
  }

  // ==========================================
  // 敵シンボルAI
  // ==========================================

  updateEnemySymbols(dt) {
    for (const enemy of this.enemySymbols) {
      const distToPlayer = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);

      // 追跡判定
      if (distToPlayer <= 3) {
        enemy.chasing = true;
      } else if (distToPlayer > 5) {
        enemy.chasing = false;
      }

      if (enemy.moving) {
        // 移動中の補間
        enemy.moveTimer += dt * enemy.speed;
        const t = Math.min(enemy.moveTimer, 1);
        const ease = t * (2 - t);

        const sx = (enemy.targetX - (enemy.targetX - enemy.x)) * TILE_SIZE;
        const sy = (enemy.targetY - (enemy.targetY - enemy.y)) * TILE_SIZE;
        // x, y は前の位置を保持、targetX/Y が移動先
        const prevX = enemy._prevX !== undefined ? enemy._prevX : enemy.x;
        const prevY = enemy._prevY !== undefined ? enemy._prevY : enemy.y;
        enemy.pixelX = prevX * TILE_SIZE + (enemy.targetX * TILE_SIZE - prevX * TILE_SIZE) * ease;
        enemy.pixelY = prevY * TILE_SIZE + (enemy.targetY * TILE_SIZE - prevY * TILE_SIZE) * ease;

        if (enemy.moveTimer >= 1) {
          enemy.x = enemy.targetX;
          enemy.y = enemy.targetY;
          enemy.pixelX = enemy.x * TILE_SIZE;
          enemy.pixelY = enemy.y * TILE_SIZE;
          enemy.moving = false;
          enemy.moveTimer = 0;
          delete enemy._prevX;
          delete enemy._prevY;
        }
      } else {
        // 移動先決定
        if (enemy.chasing) {
          this.enemyChaseStep(enemy);
        } else {
          enemy.patrolTimer -= dt;
          if (enemy.patrolTimer <= 0) {
            this.enemyPatrolStep(enemy);
            enemy.patrolTimer = 1.5 + Math.random() * 2;
          }
        }
      }

      // プレイヤーとの接触チェック
      if (enemy.x === this.player.x && enemy.y === this.player.y && !this.player.moving) {
        this.startBattle(enemy);
        return;
      }
    }
  }

  enemyChaseStep(enemy) {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;

    // マンハッタン距離で追跡
    let moveX = 0, moveY = 0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      moveX = Math.sign(dx);
    } else {
      moveY = Math.sign(dy);
    }

    const newX = enemy.x + moveX;
    const newY = enemy.y + moveY;

    if (this.canEnemyMoveTo(newX, newY, enemy)) {
      enemy._prevX = enemy.x;
      enemy._prevY = enemy.y;
      enemy.targetX = newX;
      enemy.targetY = newY;
      enemy.moving = true;
      enemy.moveTimer = 0;
    }
  }

  enemyPatrolStep(enemy) {
    // ホーム位置から2タイル範囲をランダム巡回
    const offX = Math.floor(Math.random() * 5) - 2;
    const offY = Math.floor(Math.random() * 5) - 2;
    let newX = enemy.homeX + offX;
    let newY = enemy.homeY + offY;

    // 1タイルずつ近づく
    const dx = newX - enemy.x;
    const dy = newY - enemy.y;
    let moveX = 0, moveY = 0;
    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        moveX = Math.sign(dx);
      } else {
        moveY = Math.sign(dy);
      }
    }

    const finalX = enemy.x + moveX;
    const finalY = enemy.y + moveY;

    if (this.canEnemyMoveTo(finalX, finalY, enemy)) {
      enemy._prevX = enemy.x;
      enemy._prevY = enemy.y;
      enemy.targetX = finalX;
      enemy.targetY = finalY;
      enemy.moving = true;
      enemy.moveTimer = 0;
    }
  }

  canEnemyMoveTo(x, y, enemy) {
    if (!this.currentMap) return false;
    if (x < 0 || y < 0 || x >= this.currentMap.width || y >= this.currentMap.height) return false;

    const tile = this.currentMap.tiles[y][x];
    if (!isTilePassable(tile)) return false;

    // 他の敵との衝突
    for (const other of this.enemySymbols) {
      if (other === enemy) continue;
      if (other.x === x && other.y === y) return false;
    }

    // NPC衝突
    for (const npc of this.currentMap.npcs) {
      if (npc.x === x && npc.y === y) return false;
    }

    return true;
  }

  // ==========================================
  // リスポーン管理
  // ==========================================

  updateRespawnTimers(dt) {
    for (const encId in this.respawnTimers) {
      this.respawnTimers[encId] -= dt;
      if (this.respawnTimers[encId] <= 0) {
        delete this.respawnTimers[encId];
        // 該当エンカウントを復活
        const enc = this.getEncounterDef(encId);
        if (enc && !this.defeatedEncounters[encId]) {
          this.enemySymbols.push({
            id: enc.id,
            x: enc.x,
            y: enc.y,
            pixelX: enc.x * TILE_SIZE,
            pixelY: enc.y * TILE_SIZE,
            homeX: enc.x,
            homeY: enc.y,
            targetX: enc.x,
            targetY: enc.y,
            moving: false,
            moveTimer: 0,
            patrolTimer: Math.random() * 2,
            chasing: false,
            enemies: enc.enemies,
            isBoss: enc.isBoss || false,
            speed: this.player.speed * 0.7,
          });
        }
      }
    }
  }

  getEncounterDef(encId) {
    if (!this.currentMap || !this.currentMap.encounters) return null;
    return this.currentMap.encounters.find(e => e.id === encId) || null;
  }

  // ==========================================
  // バトル開始
  // ==========================================

  startBattle(enemySymbol) {
    this._lastEncounterId = enemySymbol.id;

    // ENEMIESからディープコピーして敵配列を作成
    const enemies = [];
    for (const enemyId of enemySymbol.enemies) {
      if (typeof ENEMIES !== 'undefined' && ENEMIES[enemyId]) {
        enemies.push(JSON.parse(JSON.stringify(ENEMIES[enemyId])));
      } else {
        // ENEMIESが未定義の場合のフォールバック
        enemies.push({
          id: enemyId,
          name: enemyId,
          season: this.currentMap.season,
          hp: 80, maxHp: 80,
          atk: 15, def: 10, matk: 12, mdef: 10, spd: 10,
          exp: 20, gold: 10,
          skills: [],
          spriteData: { bodyColor: '#666', headColor: '#999' },
        });
      }
    }

    // バトルシーンに遷移
    this.game.renderer.startFade(1, 0.05);
    const seasonColors = SEASON_COLORS[this.currentMap.season];
    this.game.scenes.push(SCENES.BATTLE, {
      enemies: enemies,
      background: seasonColors.bg,
      season: this.currentMap.season,
      isBoss: enemySymbol.isBoss,
    });
  }

  // ==========================================
  // インタラクション
  // ==========================================

  checkInteraction() {
    // Spaceキー or タップで調べる
    const spacePressed = this.game.input.isJustPressed(' ') || this.game.input.isJustPressed('Enter');
    const tap = this.game.input.consumeTap();

    if (!spacePressed && !tap) return;

    const p = this.player;
    // 向いている方向の座標
    let checkX = p.x, checkY = p.y;
    switch (p.direction) {
      case 'up':    checkY -= 1; break;
      case 'down':  checkY += 1; break;
      case 'left':  checkX -= 1; break;
      case 'right': checkX += 1; break;
    }

    // タップの場合はタップ位置からNPC/宝箱を検索
    if (tap && !spacePressed) {
      const tapTileX = Math.floor((tap.x + this.camera.x) / TILE_SIZE);
      const tapTileY = Math.floor((tap.y + this.camera.y) / TILE_SIZE);
      // タップ先がプレイヤーの隣接タイルか確認
      const dist = Math.abs(tapTileX - p.x) + Math.abs(tapTileY - p.y);
      if (dist === 1) {
        checkX = tapTileX;
        checkY = tapTileY;
      } else {
        return;
      }
    }

    // NPC接触
    for (const npc of this.currentMap.npcs) {
      if (npc.x === checkX && npc.y === checkY) {
        this.game.scenes.push(SCENES.DIALOGUE, {
          dialogueId: npc.dialogue,
          npcName: npc.name,
          action: npc.action || null,
        });
        return;
      }
    }

    // 宝箱
    if (this.currentMap.chests) {
      for (const chest of this.currentMap.chests) {
        if (chest.x === checkX && chest.y === checkY) {
          if (!this.openedChests[chest.id]) {
            this.openedChests[chest.id] = true;
            this.showMessage(chest.item + ' を手に入れた!');
            // TODO: アイテムをインベントリに追加
          } else {
            this.showMessage('空っぽの宝箱だ');
          }
          return;
        }
      }
    }
  }

  // ==========================================
  // マップ遷移
  // ==========================================

  checkMapExit() {
    if (!this.currentMap || !this.currentMap.exits) return;

    for (const exit of this.currentMap.exits) {
      if (this.player.x === exit.x && this.player.y === exit.y) {
        this.transitioning = true;
        this.transitionTarget = exit;
        this.game.renderer.startFade(1, 0.04);
        return;
      }
    }
  }

  updateTransition(dt) {
    if (!this.game.renderer.isFading() && this.game.renderer.fadeAlpha >= 0.99) {
      // フェードアウト完了 → マップ読み込み
      this.loadMap(
        this.transitionTarget.targetMap,
        this.transitionTarget.targetX,
        this.transitionTarget.targetY
      );
      this.transitioning = false;
      this.transitionTarget = null;
      this.game.renderer.startFade(0, 0.03);
    }
  }

  // ==========================================
  // セーブポイント
  // ==========================================

  checkSavePoint() {
    if (!this.currentMap || !this.currentMap.savePoints) return;

    for (const sp of this.currentMap.savePoints) {
      if (this.player.x === sp.x && this.player.y === sp.y) {
        this.healParty();
        this.showMessage('セーブポイント: 体力が全回復した!');
        return;
      }
    }
  }

  healParty() {
    const party = this.game.state.party;
    if (party && party.members) {
      for (const m of party.members) {
        m.hp = m.maxHp;
        m.mp = m.maxMp;
      }
    }
  }

  // ==========================================
  // カメラ
  // ==========================================

  updateCamera() {
    if (!this.currentMap) return;
    const mapPixelW = this.currentMap.width * TILE_SIZE;
    const mapPixelH = this.currentMap.height * TILE_SIZE;

    this.camera.x = Math.max(0,
      Math.min(this.player.pixelX - GAME_WIDTH / 2 + TILE_SIZE / 2,
        mapPixelW - GAME_WIDTH));
    this.camera.y = Math.max(0,
      Math.min(this.player.pixelY - GAME_HEIGHT / 2 + TILE_SIZE / 2,
        mapPixelH - GAME_HEIGHT));

    // マップがゲーム画面より小さい場合は中央寄せ
    if (mapPixelW < GAME_WIDTH) {
      this.camera.x = -(GAME_WIDTH - mapPixelW) / 2;
    }
    if (mapPixelH < GAME_HEIGHT) {
      this.camera.y = -(GAME_HEIGHT - mapPixelH) / 2;
    }
  }

  // ==========================================
  // 探索度・訪問管理
  // ==========================================

  markVisited(x, y) {
    if (!this.currentMap) return;
    const key = this.currentMap.id;
    if (!this.visitedTiles[key]) this.visitedTiles[key] = new Set();
    // 周囲1タイルも可視化
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const vx = x + dx;
        const vy = y + dy;
        if (vx >= 0 && vy >= 0 && vx < this.currentMap.width && vy < this.currentMap.height) {
          this.visitedTiles[key].add(vx + ',' + vy);
        }
      }
    }
  }

  getExplorationPercent() {
    if (!this.currentMap) return 0;
    const key = this.currentMap.id;
    const visited = this.visitedTiles[key] ? this.visitedTiles[key].size : 0;

    // 通行可能タイル数をカウント
    let passable = 0;
    for (let y = 0; y < this.currentMap.height; y++) {
      for (let x = 0; x < this.currentMap.width; x++) {
        if (isTilePassable(this.currentMap.tiles[y][x])) {
          passable++;
        }
      }
    }
    if (passable === 0) return 100;
    return Math.min(100, Math.floor((visited / passable) * 100));
  }

  // ==========================================
  // タイマー・パーティクル
  // ==========================================

  updateTimers(dt) {
    if (this.mapNameTimer > 0) this.mapNameTimer -= dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
  }

  updateParticles(dt) {
    if (!this.currentMap) return;
    this.particleTimer += dt;
    if (this.particleTimer > 0.15) {
      this.particleTimer = 0;
      const season = this.currentMap.season;
      const rx = Math.random() * GAME_WIDTH;
      let ry;
      if (season === SEASON.AUTUMN || season === SEASON.WINTER) {
        ry = -10;
      } else if (season === SEASON.SUMMER) {
        ry = GAME_HEIGHT + 10;
      } else {
        ry = Math.random() * GAME_HEIGHT * 0.3;
      }
      this.game.renderer.addParticle(season, rx, ry);
    }
  }

  showMessage(text) {
    this.messageText = text;
    this.messageTimer = this.messageDuration;
  }

  // ==========================================
  // NPC to pixel char type mapping
  // ==========================================
  _getNpcPixelType(npc) {
    if (npc.id === 'innkeeper') return 'npc_innkeeper';
    if (npc.id === 'merchant') return 'npc_green';
    return 'npc_brown';
  }

  _getEnemyPixelType(enemy) {
    if (enemy.isBoss) return 'boss_flower';
    // Map enemy IDs to pixel char types
    const firstEnemy = enemy.enemies[0] || '';
    if (firstEnemy.includes('Fairy') || firstEnemy.includes('fairy')) return 'fairy';
    if (firstEnemy.includes('Bee') || firstEnemy.includes('bee')) return 'bee';
    if (firstEnemy.includes('itsune') || firstEnemy.includes('fox')) return 'fox';
    return 'fairy'; // default
  }

  // ==========================================
  // 描画
  // ==========================================

  draw(renderer) {
    if (!this.currentMap) {
      renderer.drawText('Loading map...', GAME_WIDTH/2, GAME_HEIGHT/2, {size: 24, align: 'center', color: '#FFF'});
      return;
    }
    try {

    const map = this.currentMap;
    const colors = map.tileColors;
    const seasonColors = SEASON_COLORS[map.season] || SEASON_COLORS[SEASON.SPRING];

    // 1. 背景
    renderer.ctx.globalAlpha = 1;
    renderer.drawGradientRect(0, 0, GAME_WIDTH, GAME_HEIGHT, seasonColors.bg, seasonColors.secondary);

    // 1b. Distant seasonal silhouettes
    this._drawDistantBackground(renderer, map);

    // 2. パーティクル（背景レイヤー）
    renderer.updateParticles();
    renderer.drawParticles();

    // 3. タイルマップ描画
    this.drawTiles(renderer, map, colors);

    // 4. セーブポイント描画
    this.drawSavePoints(renderer, map);

    // 5. 宝箱描画
    this.drawChests(renderer, map);

    // 6. NPC描画
    this.drawNPCs(renderer, map);

    // 7. 敵シンボル描画
    this.drawEnemySymbols(renderer);

    // 8. プレイヤー描画
    this.drawPlayer(renderer);

    // 9. ミニマップ
    this.drawMinimap(renderer, map);

    // 10. 探索度
    const percent = this.getExplorationPercent();
    renderer.drawText('探索 ' + percent + '%', GAME_WIDTH - 95, 118,
      { size: 12, color: '#FFF', align: 'center', shadow: true });

    // 11. マップ名表示
    if (this.mapNameTimer > 0) {
      const alpha = this.mapNameTimer > 0.5 ? 1 : this.mapNameTimer / 0.5;
      renderer.drawRoundedRect(GAME_WIDTH / 2 - 130, 28, 260, 44, 8,
        `rgba(0,0,0,${0.65 * alpha})`, `rgba(255,255,255,${0.15 * alpha})`);
      renderer.drawText(map.name, GAME_WIDTH / 2, 38,
        { size: 20, color: `rgba(255,255,255,${alpha})`, align: 'center',
          outline: true, outlineColor: `rgba(0,0,0,${alpha * 0.5})`, outlineWidth: 3 });
    }

    // 12. メッセージ表示
    if (this.messageTimer > 0) {
      const alpha = this.messageTimer > 0.5 ? 1 : this.messageTimer / 0.5;
      const msgW = Math.min(400, this.messageText.length * 18 + 40);
      renderer.drawRoundedRect(
        GAME_WIDTH / 2 - msgW / 2, GAME_HEIGHT - 80,
        msgW, 36, 8,
        'rgba(0,0,0,0.75)', null
      );
      renderer.drawText(this.messageText, GAME_WIDTH / 2, GAME_HEIGHT - 72,
        { size: 14, color: '#FFF', align: 'center', shadow: true });
    }

    // 13. 操作ヒント
    renderer.drawText('WASD:移動  Space:調べる', GAME_WIDTH / 2, GAME_HEIGHT - 24,
      { size: 11, color: 'rgba(255,255,255,0.4)', align: 'center', shadow: false });
    } catch(e) {
      console.error('[Exploration] draw error:', e.message, e.stack);
      renderer.drawText('Draw Error: ' + e.message, 10, 10, {size: 14, color: '#F00'});
    }
  }

  // ==========================================
  // 個別描画メソッド
  // ==========================================

  drawTiles(renderer, map, colors) {
    const ctx = renderer.ctx;
    const startTileX = Math.max(0, Math.floor(this.camera.x / TILE_SIZE));
    const startTileY = Math.max(0, Math.floor(this.camera.y / TILE_SIZE));
    const endTileX = Math.min(map.width, Math.ceil((this.camera.x + GAME_WIDTH) / TILE_SIZE) + 1);
    const endTileY = Math.min(map.height, Math.ceil((this.camera.y + GAME_HEIGHT) / TILE_SIZE) + 1);
    const now = Date.now();

    for (let ty = startTileY; ty < endTileY; ty++) {
      for (let tx = startTileX; tx < endTileX; tx++) {
        const tile = map.tiles[ty][tx];
        const sx = Math.floor(tx * TILE_SIZE - this.camera.x);
        const sy = Math.floor(ty * TILE_SIZE - this.camera.y);
        const deco = this.tileDecorations && this.tileDecorations[ty] ? this.tileDecorations[ty][tx] : null;

        if (tile === TILE.FLOOR || tile === TILE.EMPTY || tile === TILE.ENTRANCE || tile === TILE.DOOR) {
          // --- Floor tile: 石畳テクスチャ (4x4 grid of 8x8 stones) ---
          const baseColor = colors[tile] || '#CCC';
          const bc = this._parseHex(baseColor);
          const stoneSize = 8; // 32 / 4 = 8px per stone

          for (let sty = 0; sty < 4; sty++) {
            for (let stx = 0; stx < 4; stx++) {
              const stoneX = sx + stx * stoneSize;
              const stoneY = sy + sty * stoneSize;

              // Per-stone random color variation (±5%)
              const rnd = seededRandom(tx * 4 + stx, ty * 4 + sty);
              const variation = (rnd - 0.5) * 0.1; // ±5%
              const r = Math.min(255, Math.max(0, Math.round(bc[0] * (1 + variation))));
              const g = Math.min(255, Math.max(0, Math.round(bc[1] * (1 + variation))));
              const b = Math.min(255, Math.max(0, Math.round(bc[2] * (1 + variation))));

              // Stone body
              ctx.fillStyle = `rgb(${r},${g},${b})`;
              ctx.fillRect(stoneX, stoneY, stoneSize, stoneSize);

              // Left & top highlight (light from top-left)
              ctx.fillStyle = GLOBAL_LIGHT.highlightColor;
              ctx.fillRect(stoneX, stoneY, stoneSize, 1); // top edge
              ctx.fillRect(stoneX, stoneY, 1, stoneSize); // left edge

              // Right & bottom shadow
              ctx.fillStyle = 'rgba(20,10,30,0.12)';
              ctx.fillRect(stoneX + stoneSize - 1, stoneY, 1, stoneSize); // right edge
              ctx.fillRect(stoneX, stoneY + stoneSize - 1, stoneSize, 1); // bottom edge
            }
          }

          // 目地 (mortar lines between stones)
          ctx.fillStyle = 'rgba(20,10,30,0.10)';
          for (let i = 1; i < 4; i++) {
            ctx.fillRect(sx, sy + i * stoneSize, TILE_SIZE, 1); // horizontal joints
            ctx.fillRect(sx + i * stoneSize, sy, 1, TILE_SIZE); // vertical joints
          }

          // Ambient Occlusion: 壁に隣接する床の壁側端2pxを暗く
          const aboveTile = ty > 0 ? map.tiles[ty - 1][tx] : TILE.WALL;
          const leftTile  = tx > 0 ? map.tiles[ty][tx - 1] : TILE.WALL;
          const wallAbove = aboveTile === TILE.WALL;
          const wallLeft  = leftTile === TILE.WALL;

          if (wallAbove) {
            ctx.fillStyle = 'rgba(20,10,30,0.12)';
            ctx.fillRect(sx, sy, TILE_SIZE, 2);
          }
          if (wallLeft) {
            ctx.fillStyle = 'rgba(20,10,30,0.12)';
            ctx.fillRect(sx, sy, 2, TILE_SIZE);
          }
          // Corner AO patch (both above and left are walls)
          if (wallAbove && wallLeft) {
            ctx.fillStyle = 'rgba(20,10,30,0.18)';
            ctx.fillRect(sx, sy, 4, 4);
          }

          // Entrance / exit: light pillar effect
          if (tile === TILE.ENTRANCE) {
            const shimmer = 0.1 + 0.08 * Math.sin(now / 400 + tx);
            ctx.fillStyle = `rgba(255,215,0,${shimmer})`;
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
            // Vertical light pillar
            const pillarAlpha = 0.12 + 0.08 * Math.sin(now / 500 + tx * 1.3);
            const pillarGrad = ctx.createLinearGradient(sx + TILE_SIZE / 2, sy - 40, sx + TILE_SIZE / 2, sy + TILE_SIZE);
            pillarGrad.addColorStop(0, `rgba(255,245,200,0)`);
            pillarGrad.addColorStop(0.3, `rgba(255,235,150,${pillarAlpha})`);
            pillarGrad.addColorStop(1, `rgba(255,215,0,0)`);
            ctx.fillStyle = pillarGrad;
            ctx.fillRect(sx + 4, sy - 40, TILE_SIZE - 8, TILE_SIZE + 40);
          }

          // --- 草花デコレーション（床タイルの上に20%の確率で描画） ---
          if (tile === TILE.FLOOR || tile === TILE.EMPTY) {
            const grassChance = seededRandom(tx, ty, 999);
            if (grassChance < 0.2) {
              const grassCount = 2 + Math.floor(seededRandom(tx, ty, 1001) * 2); // 2-3本
              for (let gi = 0; gi < grassCount; gi++) {
                const gBaseX = sx + 6 + seededRandom(tx, ty, 1010 + gi) * (TILE_SIZE - 12);
                const gBaseY = sy + TILE_SIZE - 2;
                const gHeight = 5 + seededRandom(tx, ty, 1020 + gi) * 5; // 5-10px
                // 風によるsin波揺れ
                const windSway = Math.sin(now * 0.002 + tx * 0.8 + gi * 1.5) * 1.5;

                ctx.strokeStyle = `rgba(80,${140 + Math.floor(seededRandom(tx, ty, 1030 + gi) * 40)},60,0.7)`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(gBaseX, gBaseY);
                ctx.quadraticCurveTo(gBaseX + windSway * 0.5, gBaseY - gHeight * 0.5, gBaseX + windSway, gBaseY - gHeight);
                ctx.stroke();

                // 先端に薄い白（光の透過表現）
                ctx.fillStyle = 'rgba(255,255,240,0.35)';
                ctx.fillRect(Math.floor(gBaseX + windSway), Math.floor(gBaseY - gHeight), 1, 2);

                // 春のエリアではピンクの花弁を混ぜる
                if (map.season === SEASON.SPRING && seededRandom(tx, ty, 1050 + gi) < 0.4) {
                  const petalX = gBaseX + windSway;
                  const petalY = gBaseY - gHeight - 1;
                  ctx.fillStyle = `rgba(255,${150 + Math.floor(seededRandom(tx, ty, 1060 + gi) * 50)},${180 + Math.floor(seededRandom(tx, ty, 1070 + gi) * 40)},0.7)`;
                  ctx.beginPath();
                  ctx.arc(petalX, petalY, 1.5, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
          }

        } else if (tile === TILE.WALL) {
          // --- Wall tile: 3D化 with unified lighting ---
          const wallBase = colors[tile] || '#888';
          const wc = this._parseHex(wallBase);

          // Wall body with gradient + seededRandom color variation
          const rndW = seededRandom(tx, ty, 42);
          const wVar = (rndW - 0.5) * 0.08; // ±4% variation
          const wr = Math.min(255, Math.max(0, Math.round(wc[0] * (1 + wVar))));
          const wg = Math.min(255, Math.max(0, Math.round(wc[1] * (1 + wVar))));
          const wb = Math.min(255, Math.max(0, Math.round(wc[2] * (1 + wVar))));

          renderer.drawGradientRect(sx, sy, TILE_SIZE, TILE_SIZE,
            `rgb(${Math.min(255, wr + 30)},${Math.min(255, wg + 30)},${Math.min(255, wb + 30)})`,
            `rgb(${Math.max(0, wr - 20)},${Math.max(0, wg - 20)},${Math.max(0, wb - 20)})`);

          // Additional seededRandom texture splotches
          const rndW2 = seededRandom(tx, ty, 77);
          if (rndW2 > 0.4) {
            ctx.fillStyle = rndW2 > 0.7 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
            const patchX = sx + Math.floor(seededRandom(tx, ty, 100) * (TILE_SIZE - 8));
            const patchY = sy + Math.floor(seededRandom(tx, ty, 200) * (TILE_SIZE - 6));
            ctx.fillRect(patchX, patchY, 6, 5);
          }

          // Mortar lines
          if (rndW > 0.3) {
            ctx.fillStyle = 'rgba(0,0,0,0.07)';
            ctx.fillRect(sx + 3, sy + TILE_SIZE / 2 - 1, TILE_SIZE - 6, 1);
          }
          if (rndW > 0.5) {
            const off = (ty % 2 === 0) ? TILE_SIZE * 0.6 : TILE_SIZE * 0.3;
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(sx + off, sy + 2, 1, TILE_SIZE / 2 - 3);
          }

          // 3D edges with adjacency check
          const wallAboveW = ty > 0 && map.tiles[ty - 1][tx] === TILE.WALL;
          const wallLeftW  = tx > 0 && map.tiles[ty][tx - 1] === TILE.WALL;

          // Top face (3px) — only if no wall above
          if (!wallAboveW) {
            const topR = Math.min(255, wr + 50);
            const topG = Math.min(255, wg + 50);
            const topB = Math.min(255, wb + 50);
            ctx.fillStyle = `rgb(${topR},${topG},${topB})`;
            ctx.fillRect(sx, sy, TILE_SIZE, 3);
            // Additional highlight overlay on top face
            ctx.fillStyle = GLOBAL_LIGHT.highlightColor;
            ctx.fillRect(sx, sy, TILE_SIZE, 3);
          }

          // Left edge highlight (2px) — only if no wall to the left
          if (!wallLeftW) {
            ctx.fillStyle = GLOBAL_LIGHT.highlightColor;
            ctx.fillRect(sx, sy, 2, TILE_SIZE);
          }

          // Right edge shadow (2px)
          ctx.fillStyle = 'rgba(20,10,30,0.15)';
          ctx.fillRect(sx + TILE_SIZE - 2, sy, 2, TILE_SIZE);

          // Bottom edge shadow (2px)
          ctx.fillStyle = 'rgba(20,10,30,0.2)';
          ctx.fillRect(sx, sy + TILE_SIZE - 2, TILE_SIZE, 2);

          // Drop shadow (offset 2px right, 2px down) — cast onto adjacent floor
          // Only draw shadow on right neighbor if it's a floor
          const rightTile = (tx + 1 < map.width) ? map.tiles[ty][tx + 1] : TILE.WALL;
          const belowTile = (ty + 1 < map.height) ? map.tiles[ty + 1][tx] : TILE.WALL;
          if (rightTile !== TILE.WALL) {
            ctx.fillStyle = GLOBAL_LIGHT.shadowColor;
            ctx.fillRect(sx + TILE_SIZE, sy + GLOBAL_LIGHT.shadowOffsetY, GLOBAL_LIGHT.shadowOffsetX, TILE_SIZE);
          }
          if (belowTile !== TILE.WALL) {
            ctx.fillStyle = GLOBAL_LIGHT.shadowColor;
            ctx.fillRect(sx + GLOBAL_LIGHT.shadowOffsetX, sy + TILE_SIZE, TILE_SIZE, GLOBAL_LIGHT.shadowOffsetY);
          }

        } else if (tile === TILE.WATER) {
          // --- Water tile: 3層構造（深度層 + 波紋層 + スペキュラ層） ---

          // 1. 深度グラデーション（上が明るい浅瀬、下が暗い深部）
          const depthGrad = ctx.createLinearGradient(sx, sy, sx, sy + TILE_SIZE);
          depthGrad.addColorStop(0, '#5B8DAF');  // 浅い水色
          depthGrad.addColorStop(1, '#3A6B8C');  // 深い水色
          ctx.fillStyle = depthGrad;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

          // 2. 波紋層（3本のsin波を重ねて水面の横方向の微細な変位を表現）
          const waveParams = [
            { speed: 0.002, amplitude: 1.5, phase: 0, yOffset: 8, alpha: 0.12 },
            { speed: 0.0015, amplitude: 1.0, phase: 2.1, yOffset: 16, alpha: 0.09 },
            { speed: 0.003, amplitude: 0.8, phase: 4.2, yOffset: 24, alpha: 0.06 },
          ];
          for (let wi = 0; wi < 3; wi++) {
            const wp = waveParams[wi];
            ctx.strokeStyle = `rgba(255,255,255,${wp.alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let px = 0; px < TILE_SIZE; px++) {
              const wy = sy + wp.yOffset + Math.sin(now * wp.speed + (sx + px) * 0.15 + wp.phase) * wp.amplitude;
              if (px === 0) ctx.moveTo(sx + px, wy);
              else ctx.lineTo(sx + px, wy);
            }
            ctx.stroke();
          }

          // 3. スペキュラ層（光源方向315°左上からの反射 — 白い楕円が時間で移動）
          const specX = sx + 8 + Math.sin(now * 0.001 + sy * 0.1) * 10;
          const specY = sy + 6 + Math.cos(now * 0.0008 + sx * 0.1) * 4;
          const specAlpha = 0.15 + Math.sin(now * 0.003 + sx) * 0.08;
          ctx.fillStyle = `rgba(255,255,255,${Math.max(0, specAlpha)})`;
          ctx.beginPath();
          ctx.ellipse(specX, specY, 3, 1.5, -0.4, 0, Math.PI * 2);
          ctx.fill();

          // 追加スペキュラ（タイル内の別の位置にもう1つ）
          const specX2 = sx + TILE_SIZE - 10 + Math.sin(now * 0.0012 + sy * 0.15 + 3) * 6;
          const specY2 = sy + TILE_SIZE - 10 + Math.cos(now * 0.0009 + sx * 0.12 + 2) * 3;
          const specAlpha2 = 0.10 + Math.sin(now * 0.002 + sx * 0.5 + 1) * 0.06;
          ctx.fillStyle = `rgba(255,255,255,${Math.max(0, specAlpha2)})`;
          ctx.beginPath();
          ctx.ellipse(specX2, specY2, 2, 1, -0.3, 0, Math.PI * 2);
          ctx.fill();

        } else {
          // Default tile
          const color = colors[tile] || '#333';
          renderer.drawRect(sx, sy, TILE_SIZE, TILE_SIZE, color);
        }

        // Subtle grid lines (stone joint feel)
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(sx, sy, TILE_SIZE, 1);
        ctx.fillRect(sx, sy, 1, TILE_SIZE);
      }
    }
  }

  // Color utility helpers
  _lightenColor(hex, amount) {
    const c = this._parseHex(hex);
    return `rgb(${Math.min(255, c[0] + amount)},${Math.min(255, c[1] + amount)},${Math.min(255, c[2] + amount)})`;
  }
  _darkenColor(hex, amount) {
    const c = this._parseHex(hex);
    return `rgb(${Math.max(0, c[0] - amount)},${Math.max(0, c[1] - amount)},${Math.max(0, c[2] - amount)})`;
  }
  _parseHex(hex) {
    if (!hex || !hex.startsWith('#')) return [128, 128, 128];
    const h = hex.slice(1);
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
  }

  _drawDistantBackground(renderer, map) {
    const ctx = renderer.ctx;
    const isDungeon = map.id && map.id.startsWith('sennen');

    if (isDungeon) {
      // Dark rocky cave atmosphere: stalactite silhouettes at top
      ctx.fillStyle = 'rgba(20,10,5,0.08)';
      // Top dark gradient overlay
      const darkGrad = ctx.createLinearGradient(0, 0, 0, 120);
      darkGrad.addColorStop(0, 'rgba(15,8,3,0.15)');
      darkGrad.addColorStop(1, 'rgba(15,8,3,0)');
      ctx.fillStyle = darkGrad;
      ctx.fillRect(0, 0, GAME_WIDTH, 120);

      // Stalactite silhouettes
      ctx.fillStyle = 'rgba(30,15,8,0.07)';
      for (let i = 0; i < 8; i++) {
        const bx = i * 130 + 20;
        const bh = 30 + (i * 37 % 40);
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx + 15, bh);
        ctx.lineTo(bx + 30, 0);
        ctx.fill();
      }

      // Bottom dark gradient
      const bottomGrad = ctx.createLinearGradient(0, GAME_HEIGHT - 80, 0, GAME_HEIGHT);
      bottomGrad.addColorStop(0, 'rgba(15,8,3,0)');
      bottomGrad.addColorStop(1, 'rgba(15,8,3,0.1)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 80);
    } else {
      // Town: cherry blossom tree silhouettes in distance
      ctx.fillStyle = 'rgba(200,100,130,0.04)';
      // Draw 3 tree silhouettes
      const trees = [
        { x: 80, trunkH: 70, canopyR: 45 },
        { x: 700, trunkH: 60, canopyR: 40 },
        { x: 880, trunkH: 55, canopyR: 35 },
      ];
      for (const t of trees) {
        const baseY = 40;
        // Trunk
        ctx.fillStyle = 'rgba(100,60,40,0.05)';
        ctx.fillRect(t.x - 3, baseY, 6, t.trunkH);
        // Canopy (soft circle)
        const canopyGrad = ctx.createRadialGradient(t.x, baseY, 0, t.x, baseY, t.canopyR);
        canopyGrad.addColorStop(0, 'rgba(255,183,197,0.06)');
        canopyGrad.addColorStop(0.7, 'rgba(255,150,180,0.03)');
        canopyGrad.addColorStop(1, 'rgba(255,150,180,0)');
        ctx.fillStyle = canopyGrad;
        ctx.beginPath();
        ctx.arc(t.x, baseY, t.canopyR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawSavePoints(renderer, map) {
    if (!map.savePoints) return;
    const ctx = renderer.ctx;
    const now = Date.now();
    for (const sp of map.savePoints) {
      const sx = sp.x * TILE_SIZE - this.camera.x;
      const sy = sp.y * TILE_SIZE - this.camera.y;
      if (sx < -TILE_SIZE * 2 || sx > GAME_WIDTH + TILE_SIZE || sy < -TILE_SIZE * 2 || sy > GAME_HEIGHT + TILE_SIZE) continue;

      const pulse = 0.4 + 0.3 * Math.sin(now / 400);
      const centerX = sx + TILE_SIZE / 2;
      const centerY = sy + TILE_SIZE / 2;

      // Light pillar (vertical glow extending upward)
      ctx.save();
      const pillarH = 80;
      const pillarGrad = ctx.createLinearGradient(centerX, centerY - pillarH, centerX, centerY + TILE_SIZE / 2);
      pillarGrad.addColorStop(0, 'rgba(127,255,212,0)');
      pillarGrad.addColorStop(0.3, `rgba(127,255,212,${0.06 + 0.04 * Math.sin(now / 600)})`);
      pillarGrad.addColorStop(0.7, `rgba(200,255,240,${0.12 + 0.06 * Math.sin(now / 500)})`);
      pillarGrad.addColorStop(1, 'rgba(127,255,212,0)');
      ctx.fillStyle = pillarGrad;
      ctx.fillRect(centerX - 10, centerY - pillarH, 20, pillarH + TILE_SIZE / 2);
      ctx.restore();

      // Pulsing outer aura
      renderer.drawGlow(centerX, centerY, TILE_SIZE * 1.0, '#7FFFD4', pulse * 0.35);
      renderer.drawGlow(centerX, centerY, TILE_SIZE * 0.6, '#AAFFEE', pulse * 0.25);

      // Inner glowing circle
      ctx.save();
      ctx.globalAlpha = pulse;
      const grad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, TILE_SIZE * 0.35);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.5, '#7FFFD4');
      grad.addColorStop(1, 'rgba(127,255,212,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, TILE_SIZE * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Rotating cross mark
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(now / 3000);
      const crossAlpha = 0.6 + 0.2 * Math.sin(now / 300);
      ctx.fillStyle = `rgba(255,255,255,${crossAlpha})`;
      ctx.fillRect(-1.5, -10, 3, 20);
      ctx.fillRect(-10, -1.5, 20, 3);
      // Diagonal cross (faint)
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `rgba(255,255,255,${crossAlpha * 0.4})`;
      ctx.fillRect(-1, -7, 2, 14);
      ctx.fillRect(-7, -1, 14, 2);
      ctx.restore();

      // Orbiting particles (using drawGlow)
      for (let i = 0; i < 4; i++) {
        const angle = now / 1500 + (i * Math.PI / 2);
        const orbitR = 14 + 3 * Math.sin(now / 800 + i);
        const px = centerX + Math.cos(angle) * orbitR;
        const py = centerY + Math.sin(angle) * orbitR * 0.6;
        const pAlpha = 0.3 + 0.2 * Math.sin(now / 400 + i * 1.5);
        renderer.drawGlow(px, py, 4, '#FFFFFF', pAlpha);
      }
    }
  }

  drawChests(renderer, map) {
    if (!map.chests) return;
    const ctx = renderer.ctx;
    const now = Date.now();
    for (const chest of map.chests) {
      const cx = chest.x * TILE_SIZE - this.camera.x;
      const cy = chest.y * TILE_SIZE - this.camera.y;
      if (cx < -TILE_SIZE || cx > GAME_WIDTH || cy < -TILE_SIZE || cy > GAME_HEIGHT) continue;

      const opened = this.openedChests[chest.id];
      // 箱体の共通寸法
      const boxL = cx + 5;
      const boxR = cx + TILE_SIZE - 5;
      const boxW = boxR - boxL;

      if (opened) {
        // ======= 開封済み宝箱：暗い色、蓋が開いた状態、グローなし =======

        // 足元の影
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx + TILE_SIZE / 2, cy + TILE_SIZE - 2, TILE_SIZE * 0.3, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 箱体（暗い茶色グラデーション）
        const bodyGradO = ctx.createLinearGradient(boxL, cy + 16, boxL, cy + TILE_SIZE - 3);
        bodyGradO.addColorStop(0, '#5A4A34');
        bodyGradO.addColorStop(1, '#3E3020');
        ctx.fillStyle = bodyGradO;
        ctx.fillRect(boxL, cy + 16, boxW, TILE_SIZE - 19);

        // 横方向の板分割線3本
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let li = 0; li < 3; li++) {
          ctx.fillRect(boxL + 1, cy + 19 + li * 3, boxW - 2, 1);
        }

        // 開いた蓋（上部に三角形で表現）
        ctx.fillStyle = '#504030';
        ctx.beginPath();
        ctx.moveTo(boxL - 1, cy + 16);
        ctx.lineTo(cx + TILE_SIZE / 2, cy + 4);
        ctx.lineTo(boxR + 1, cy + 16);
        ctx.closePath();
        ctx.fill();
        // 蓋の左端ハイライト（光源左上）
        ctx.strokeStyle = 'rgba(255,250,240,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(boxL - 1, cy + 16);
        ctx.lineTo(cx + TILE_SIZE / 2, cy + 4);
        ctx.stroke();

        // 暗い内部
        ctx.fillStyle = '#1A0A04';
        ctx.fillRect(boxL + 2, cy + 16, boxW - 4, 4);

      } else {
        // ======= 未開封宝箱：木箱 + 金属帯 + 鍵穴 + ゴールドグロー =======

        // 外側ゴールドグロー
        const glowPulse = 0.25 + 0.15 * Math.sin(now / 600);
        renderer.drawGlow(cx + TILE_SIZE / 2, cy + TILE_SIZE / 2 + 2, TILE_SIZE * 0.7, '#FFD700', glowPulse);

        // 足元の影
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(cx + TILE_SIZE / 2, cy + TILE_SIZE - 2, TILE_SIZE * 0.35, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 箱体（暗い茶色のグラデーション）
        const bodyGrad = ctx.createLinearGradient(boxL, cy + 12, boxL, cy + TILE_SIZE - 3);
        bodyGrad.addColorStop(0, '#8B6914');
        bodyGrad.addColorStop(1, '#5C4010');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(boxL, cy + 12, boxW, TILE_SIZE - 15);

        // 横方向の板分割線3本
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        for (let li = 0; li < 3; li++) {
          ctx.fillRect(boxL + 1, cy + 15 + li * 4, boxW - 2, 1);
        }

        // 左上ハイライト（GLOBAL_LIGHT方向）
        ctx.fillStyle = GLOBAL_LIGHT.highlightColor;
        ctx.fillRect(boxL, cy + 12, boxW, 1);  // top edge
        ctx.fillRect(boxL, cy + 12, 1, TILE_SIZE - 15); // left edge

        // 右・下の影
        ctx.fillStyle = 'rgba(20,10,30,0.15)';
        ctx.fillRect(boxR - 1, cy + 12, 1, TILE_SIZE - 15); // right edge
        ctx.fillRect(boxL, cy + TILE_SIZE - 4, boxW, 1);    // bottom edge

        // 金属帯（黄土色の2pxライン × 2本）
        const bandColor = '#B8960B';
        ctx.fillStyle = bandColor;
        ctx.fillRect(boxL, cy + 15, boxW, 2); // 上の帯
        ctx.fillRect(boxL, cy + 23, boxW, 2); // 下の帯
        // 帯上の鋭いスペキュラ白点
        const bandShine = 0.5 + 0.3 * Math.sin(now / 400);
        ctx.fillStyle = `rgba(255,255,255,${bandShine * 0.6})`;
        ctx.fillRect(boxL + 3, cy + 15, 2, 1);
        ctx.fillRect(boxL + 3, cy + 23, 2, 1);

        // 蓋部分（上部）
        ctx.fillStyle = '#A07818';
        ctx.fillRect(boxL - 1, cy + 7, boxW + 2, 6);
        // 蓋ハイライト
        ctx.fillStyle = 'rgba(255,250,240,0.25)';
        ctx.fillRect(boxL - 1, cy + 7, boxW + 2, 1);
        // 蓋下影
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(boxL - 1, cy + 12, boxW + 2, 1);

        // 鍵穴（中央下部）
        const khCx = cx + TILE_SIZE / 2;
        const khCy = cy + 21;
        // 金属リング
        ctx.strokeStyle = '#C8A820';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(khCx, khCy, 3, 0, Math.PI * 2);
        ctx.stroke();
        // 黒い小さな穴
        ctx.fillStyle = '#0A0604';
        ctx.beginPath();
        ctx.arc(khCx, khCy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // 鍵穴下の縦線
        ctx.fillStyle = '#0A0604';
        ctx.fillRect(khCx - 0.5, khCy + 2, 1, 3);

        // 鍵穴グロー
        const khShine = 0.4 + 0.3 * Math.sin(now / 500);
        renderer.drawGlow(khCx, khCy, 6, '#FFD700', khShine);
      }
    }
  }

  drawNPCs(renderer, map) {
    const ctx = renderer.ctx;
    for (const npc of map.npcs) {
      const nx = npc.x * TILE_SIZE - this.camera.x;
      const ny = npc.y * TILE_SIZE - this.camera.y;
      if (nx < -TILE_SIZE || nx > GAME_WIDTH || ny < -TILE_SIZE || ny > GAME_HEIGHT) continue;

      // Foot shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(nx + TILE_SIZE / 2, ny + TILE_SIZE - 1, TILE_SIZE * 0.3, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw NPC pixel character
      const pixelType = this._getNpcPixelType(npc);
      if (PIXEL_CHARS[pixelType]) {
        renderer.drawPixelChar(nx + 2, ny, 3, pixelType, { direction: 'down', frame: 0 });
      } else {
        renderer.drawSprite(nx + 4, ny + 2, TILE_SIZE - 8, TILE_SIZE - 4, npc.spriteData);
      }

      // Name display (only when player is within 3 tiles)
      const dist = Math.abs(npc.x - this.player.x) + Math.abs(npc.y - this.player.y);
      if (dist <= 3) {
        const nameAlpha = dist <= 2 ? 1 : 0.6;
        const nameW = npc.name.length * 11 + 12;
        ctx.save();
        ctx.globalAlpha = nameAlpha;
        renderer.drawRoundedRect(nx + TILE_SIZE / 2 - nameW / 2, ny - 20, nameW, 17, 4,
          'rgba(0,0,0,0.55)', null);
        renderer.drawText(npc.name, nx + TILE_SIZE / 2, ny - 18,
          { size: 10, color: '#FFE', align: 'center', shadow: true });
        ctx.restore();
      }
    }
  }

  drawEnemySymbols(renderer) {
    const ctx = renderer.ctx;
    const now = Date.now();
    for (const enemy of this.enemySymbols) {
      const ex = enemy.pixelX - this.camera.x;
      const ey = enemy.pixelY - this.camera.y;
      if (ex < -TILE_SIZE * 2 || ex > GAME_WIDTH + TILE_SIZE || ey < -TILE_SIZE * 2 || ey > GAME_HEIGHT + TILE_SIZE) continue;

      const pixelType = this._getEnemyPixelType(enemy);
      const centerX = ex + TILE_SIZE / 2;
      const centerY = ey + TILE_SIZE / 2;

      // Detection range circle (faint)
      const distToPlayer = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
      const rangeColor = distToPlayer <= 3 ? 'rgba(255,120,40,0.08)' : 'rgba(180,120,200,0.04)';
      if (distToPlayer <= 5) {
        ctx.fillStyle = rangeColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, TILE_SIZE * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (enemy.isBoss) {
        // Boss: larger display with pulsing red aura
        const aura = 0.2 + 0.15 * Math.sin(now / 300);
        renderer.drawGlow(centerX, centerY, TILE_SIZE * 1.2, '#FF2222', aura);
        renderer.drawGlow(centerX, centerY, TILE_SIZE * 0.7, '#FF6644', aura * 0.6);

        if (PIXEL_CHARS[pixelType]) {
          // Boss uses scale=4 for larger appearance
          renderer.drawPixelChar(ex - 6, ey - 8, 4, pixelType, { direction: 'down', frame: Math.floor(now / 600) % 2 });
        } else {
          // Fallback boss rendering
          ctx.fillStyle = '#8B0000';
          ctx.beginPath();
          ctx.moveTo(centerX, ey + 2);
          ctx.lineTo(ex + TILE_SIZE - 2, ey + TILE_SIZE - 2);
          ctx.lineTo(ex + 2, ey + TILE_SIZE - 2);
          ctx.closePath();
          ctx.fill();
          // Boss eye
          ctx.fillStyle = '#FF4444';
          ctx.beginPath();
          ctx.arc(centerX, ey + TILE_SIZE * 0.4, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Normal enemy with pixel char
        if (PIXEL_CHARS[pixelType]) {
          renderer.drawPixelChar(ex + 2, ey, 3, pixelType, {
            direction: 'down',
            frame: Math.floor(now / 400) % 2,
          });
        } else {
          // Fallback: triangle-shaped monster
          const bodyColor = enemy.chasing ? '#CC3333' : '#884488';
          ctx.fillStyle = bodyColor;
          ctx.beginPath();
          ctx.moveTo(centerX, ey + 4);
          ctx.lineTo(ex + TILE_SIZE - 6, ey + TILE_SIZE - 4);
          ctx.lineTo(ex + 6, ey + TILE_SIZE - 4);
          ctx.closePath();
          ctx.fill();
          // Eyes
          ctx.fillStyle = '#FFF';
          ctx.fillRect(ex + 11, ey + 14, 3, 3);
          ctx.fillRect(ex + 18, ey + 14, 3, 3);
        }

        if (enemy.chasing) {
          // Chase indicator with glow and bounce
          const bounce = Math.abs(Math.sin(now / 150)) * 4;
          renderer.drawGlow(centerX, ey - 6 - bounce, 10, '#FF4444', 0.7);
          renderer.drawText('!', centerX, ey - 16 - bounce,
            { size: 14, color: '#FF4444', align: 'center', shadow: true,
              outline: true, outlineColor: '#000', outlineWidth: 2 });
        }
      }
    }
  }

  drawPlayer(renderer) {
    const ctx = renderer.ctx;
    const px = this.player.pixelX - this.camera.x;
    const py = this.player.pixelY - this.camera.y;

    // Foot shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 1, TILE_SIZE * 0.32, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Determine season for glow
    const leader = (this.game.state.party && this.game.state.party.getLeader) ? this.game.state.party.getLeader() : null;
    const season = leader ? leader.currentSeason : null;

    // Draw player using pixel character system (scale=3)
    if (PIXEL_CHARS['hero']) {
      renderer.drawPixelChar(px + 2, py - 2, 3, 'hero', {
        direction: this.player.direction,
        frame: this.player.moving ? this.player.animFrame : 0,
        season: season,
      });
    } else {
      // Fallback: simple colored rectangle
      renderer.drawSprite(px + 4, py + 2, TILE_SIZE - 8, TILE_SIZE - 4, {
        bodyColor: '#4488CC', headColor: '#FFD699', season: season,
      });
    }
  }

  drawMinimap(renderer, map) {
    const ctx = renderer.ctx;
    const now = Date.now();
    const mmW = 160;
    const mmH = 100;
    const mmX = GAME_WIDTH - mmW - 10;
    const mmY = 10;

    // Border glow (subtle)
    renderer.drawGlow(mmX + mmW / 2, mmY + mmH / 2, mmW * 0.6, 'rgba(100,200,255,0.15)', 0.3);

    // Background with gradient
    ctx.save();
    const bgGrad = ctx.createLinearGradient(mmX, mmY, mmX, mmY + mmH);
    bgGrad.addColorStop(0, 'rgba(10,15,30,0.85)');
    bgGrad.addColorStop(1, 'rgba(20,25,50,0.8)');
    renderer.drawRoundedRect(mmX, mmY, mmW, mmH, 4, null, null);
    // Fill manually with gradient inside rounded rect
    ctx.fillStyle = bgGrad;
    ctx.fillRect(mmX + 1, mmY + 1, mmW - 2, mmH - 2);
    ctx.restore();

    // Border
    renderer.drawRoundedRect(mmX, mmY, mmW, mmH, 4, null, 'rgba(150,200,255,0.25)');

    // Tile scale calculation
    const scaleX = (mmW - 4) / map.width;
    const scaleY = (mmH - 4) / map.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = mmX + (mmW - map.width * scale) / 2;
    const offsetY = mmY + (mmH - map.height * scale) / 2;

    const visited = this.visitedTiles[map.id] || new Set();

    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const key = tx + ',' + ty;
        if (!visited.has(key)) continue;

        const tile = map.tiles[ty][tx];
        let dotColor = '#555';
        if (tile === TILE.WALL) dotColor = '#6B6B8B';
        else if (tile === TILE.FLOOR || tile === TILE.EMPTY) dotColor = '#B8B8CC';
        else if (tile === TILE.WATER) dotColor = '#4488DD';
        else if (tile === TILE.ENTRANCE) dotColor = '#FFD700';
        else if (tile === TILE.SAVE) dotColor = '#55FFDD';

        const dx = offsetX + tx * scale;
        const dy = offsetY + ty * scale;
        renderer.drawRect(dx, dy, Math.max(1, scale), Math.max(1, scale), dotColor);
      }
    }

    // Save point dots (bright cyan)
    if (map.savePoints) {
      for (const sp of map.savePoints) {
        const spx = offsetX + sp.x * scale;
        const spy = offsetY + sp.y * scale;
        const spBlink = 0.6 + 0.4 * Math.sin(now / 500);
        renderer.drawRect(spx - 0.5, spy - 0.5, Math.max(2, scale + 1), Math.max(2, scale + 1),
          `rgba(85,255,221,${spBlink})`);
      }
    }

    // Chest dots (yellow)
    if (map.chests) {
      for (const chest of map.chests) {
        if (this.openedChests[chest.id]) continue;
        const chx = offsetX + chest.x * scale;
        const chy = offsetY + chest.y * scale;
        renderer.drawRect(chx, chy, Math.max(2, scale + 1), Math.max(2, scale + 1), '#FFD700');
      }
    }

    // NPC dots (green)
    for (const npc of map.npcs) {
      const nx = offsetX + npc.x * scale;
      const ny = offsetY + npc.y * scale;
      renderer.drawRect(nx, ny, Math.max(2, scale + 1), Math.max(2, scale + 1), '#44FF66');
    }

    // Enemy symbol dots (small red)
    for (const enemy of this.enemySymbols) {
      const ex = offsetX + enemy.x * scale;
      const ey = offsetY + enemy.y * scale;
      const ec = enemy.isBoss ? '#FF3333' : '#FF5555';
      const sz = Math.max(2, scale);
      renderer.drawRect(ex, ey, sz, sz, ec);
    }

    // Player dot (pulsing bright, always visible)
    const blinkVal = 0.5 + 0.5 * Math.sin(now / 150);
    const ppx = offsetX + this.player.x * scale;
    const ppy = offsetY + this.player.y * scale;
    const dotSz = Math.max(3, scale + 2);
    // Outer glow
    renderer.drawGlow(ppx + dotSz / 2, ppy + dotSz / 2, dotSz * 2, '#FFFF44', blinkVal * 0.5);
    // Core dot
    ctx.fillStyle = `rgba(255,255,80,${0.7 + blinkVal * 0.3})`;
    ctx.fillRect(ppx - 1, ppy - 1, dotSz, dotSz);
  }
}
