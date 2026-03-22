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
    const mapDef = MAPS[mapId];
    if (!mapDef) {
      console.error('Map not found:', mapId);
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

    // 敵シンボル生成
    this.initEnemySymbols();

    // マップ名表示
    this.mapNameTimer = this.mapNameDuration;

    // カメラ更新
    this.updateCamera();
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
    if (this.particleTimer > 0.3) {
      this.particleTimer = 0;
      // 季節パーティクルを画面内ランダム位置に生成
      const rx = Math.random() * GAME_WIDTH;
      const ry = Math.random() * GAME_HEIGHT * 0.3;
      this.game.renderer.addParticle(this.currentMap.season, rx, ry);
    }
  }

  showMessage(text) {
    this.messageText = text;
    this.messageTimer = this.messageDuration;
  }

  // ==========================================
  // 描画
  // ==========================================

  draw(renderer) {
    if (!this.currentMap) return;

    const map = this.currentMap;
    const colors = map.tileColors;
    const seasonColors = SEASON_COLORS[map.season];

    // 1. 背景色
    renderer.clear(seasonColors.bg);

    // 2. タイルマップ描画
    this.drawTiles(renderer, map, colors);

    // 3. セーブポイント描画
    this.drawSavePoints(renderer, map);

    // 4. 宝箱描画
    this.drawChests(renderer, map);

    // 5. NPC描画
    this.drawNPCs(renderer, map);

    // 6. 敵シンボル描画
    this.drawEnemySymbols(renderer);

    // 7. プレイヤー描画
    this.drawPlayer(renderer);

    // 8. ミニマップ
    this.drawMinimap(renderer, map);

    // 9. 探索度
    const percent = this.getExplorationPercent();
    renderer.drawText('探索 ' + percent + '%', GAME_WIDTH - 95, 118,
      { size: 12, color: '#FFF', align: 'center', shadow: true });

    // 10. マップ名表示
    if (this.mapNameTimer > 0) {
      const alpha = this.mapNameTimer > 0.5 ? 1 : this.mapNameTimer / 0.5;
      renderer.drawRect(GAME_WIDTH / 2 - 120, 30, 240, 40, 'rgba(0,0,0,0.6)', alpha);
      renderer.drawText(map.name, GAME_WIDTH / 2, 38,
        { size: 20, color: '#FFF', align: 'center', shadow: true });
    }

    // 11. メッセージ表示
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

    // 12. 操作ヒント
    renderer.drawText('WASD:移動  Space:調べる', GAME_WIDTH / 2, GAME_HEIGHT - 24,
      { size: 11, color: 'rgba(255,255,255,0.4)', align: 'center', shadow: false });
  }

  // ==========================================
  // 個別描画メソッド
  // ==========================================

  drawTiles(renderer, map, colors) {
    const startTileX = Math.max(0, Math.floor(this.camera.x / TILE_SIZE));
    const startTileY = Math.max(0, Math.floor(this.camera.y / TILE_SIZE));
    const endTileX = Math.min(map.width, Math.ceil((this.camera.x + GAME_WIDTH) / TILE_SIZE) + 1);
    const endTileY = Math.min(map.height, Math.ceil((this.camera.y + GAME_HEIGHT) / TILE_SIZE) + 1);

    for (let ty = startTileY; ty < endTileY; ty++) {
      for (let tx = startTileX; tx < endTileX; tx++) {
        const tile = map.tiles[ty][tx];
        const screenX = tx * TILE_SIZE - this.camera.x;
        const screenY = ty * TILE_SIZE - this.camera.y;

        const color = colors[tile] || '#333';
        renderer.drawRect(screenX, screenY, TILE_SIZE, TILE_SIZE, color);

        // 壁にハイライト・影
        if (tile === TILE.WALL) {
          // 上端のハイライト
          renderer.drawRect(screenX, screenY, TILE_SIZE, 2, 'rgba(255,255,255,0.15)');
          // 下端の影
          renderer.drawRect(screenX, screenY + TILE_SIZE - 2, TILE_SIZE, 2, 'rgba(0,0,0,0.2)');
        }

        // 水のアニメーション
        if (tile === TILE.WATER) {
          const wave = Math.sin(Date.now() / 600 + tx * 0.5 + ty * 0.3) * 0.15;
          renderer.drawRect(screenX, screenY, TILE_SIZE, TILE_SIZE,
            'rgba(255,255,255,' + (0.1 + wave) + ')');
        }

        // グリッド線（薄く）
        renderer.drawRect(screenX, screenY, TILE_SIZE, 1, 'rgba(0,0,0,0.08)');
        renderer.drawRect(screenX, screenY, 1, TILE_SIZE, 'rgba(0,0,0,0.08)');
      }
    }
  }

  drawSavePoints(renderer, map) {
    if (!map.savePoints) return;
    for (const sp of map.savePoints) {
      const sx = sp.x * TILE_SIZE - this.camera.x;
      const sy = sp.y * TILE_SIZE - this.camera.y;
      if (sx < -TILE_SIZE || sx > GAME_WIDTH || sy < -TILE_SIZE || sy > GAME_HEIGHT) continue;

      // 発光エフェクト
      const glow = 0.5 + 0.3 * Math.sin(Date.now() / 400);
      renderer.drawRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8, '#7FFFD4', glow);
      renderer.drawRect(sx + 8, sy + 8, TILE_SIZE - 16, TILE_SIZE - 16, '#AAFFDD');
      // 十字マーク
      renderer.drawRect(sx + 14, sy + 6, 4, TILE_SIZE - 12, '#FFF', 0.7);
      renderer.drawRect(sx + 6, sy + 14, TILE_SIZE - 12, 4, '#FFF', 0.7);
    }
  }

  drawChests(renderer, map) {
    if (!map.chests) return;
    for (const chest of map.chests) {
      const cx = chest.x * TILE_SIZE - this.camera.x;
      const cy = chest.y * TILE_SIZE - this.camera.y;
      if (cx < -TILE_SIZE || cx > GAME_WIDTH || cy < -TILE_SIZE || cy > GAME_HEIGHT) continue;

      const opened = this.openedChests[chest.id];
      // 宝箱本体
      const bodyColor = opened ? '#8B7355' : '#DAA520';
      renderer.drawRect(cx + 4, cy + 10, TILE_SIZE - 8, TILE_SIZE - 14, bodyColor);
      // 蓋
      const lidColor = opened ? '#6B5335' : '#B8860B';
      renderer.drawRect(cx + 2, cy + 6, TILE_SIZE - 4, 8, lidColor);
      if (!opened) {
        // 鍵穴（光る）
        const shine = 0.6 + 0.4 * Math.sin(Date.now() / 500);
        renderer.drawRect(cx + 13, cy + 18, 6, 6, '#FFF', shine);
      }
    }
  }

  drawNPCs(renderer, map) {
    for (const npc of map.npcs) {
      const nx = npc.x * TILE_SIZE - this.camera.x;
      const ny = npc.y * TILE_SIZE - this.camera.y;
      if (nx < -TILE_SIZE || nx > GAME_WIDTH || ny < -TILE_SIZE || ny > GAME_HEIGHT) continue;

      renderer.drawSprite(nx + 4, ny + 2, TILE_SIZE - 8, TILE_SIZE - 4, npc.spriteData);

      // 名前表示（近くにいるときのみ）
      const dist = Math.abs(npc.x - this.player.x) + Math.abs(npc.y - this.player.y);
      if (dist <= 2) {
        renderer.drawText(npc.name, nx + TILE_SIZE / 2, ny - 12,
          { size: 10, color: '#FFE', align: 'center', shadow: true });
      }
    }
  }

  drawEnemySymbols(renderer) {
    for (const enemy of this.enemySymbols) {
      const ex = enemy.pixelX - this.camera.x;
      const ey = enemy.pixelY - this.camera.y;
      if (ex < -TILE_SIZE || ex > GAME_WIDTH || ey < -TILE_SIZE || ey > GAME_HEIGHT) continue;

      if (enemy.isBoss) {
        // ボスシンボル: 大きめ・赤オーラ
        renderer.drawRect(ex + 2, ey + 2, TILE_SIZE - 4, TILE_SIZE - 4, '#8B0000');
        const aura = 0.3 + 0.2 * Math.sin(Date.now() / 300);
        renderer.drawRectOutline(ex, ey, TILE_SIZE, TILE_SIZE, '#FF4444', 2);
        renderer.drawRect(ex - 2, ey - 2, TILE_SIZE + 4, TILE_SIZE + 4, 'rgba(255,0,0,' + aura + ')');
        // ドクロっぽいマーク
        renderer.drawRect(ex + 10, ey + 6, 4, 4, '#FFF');
        renderer.drawRect(ex + 18, ey + 6, 4, 4, '#FFF');
        renderer.drawRect(ex + 12, ey + 16, 8, 3, '#FFF');
      } else {
        // 通常敵シンボル
        const bodyColor = enemy.chasing ? '#CC3333' : '#884488';
        renderer.drawRect(ex + 6, ey + 4, TILE_SIZE - 12, TILE_SIZE - 8, bodyColor);
        // 目
        renderer.drawRect(ex + 10, ey + 8, 3, 3, '#FFF');
        renderer.drawRect(ex + 19, ey + 8, 3, 3, '#FFF');

        if (enemy.chasing) {
          // 追跡中 「!」マーク
          renderer.drawText('!', ex + TILE_SIZE / 2, ey - 10,
            { size: 12, color: '#FF0', align: 'center', shadow: true });
        }
      }
    }
  }

  drawPlayer(renderer) {
    const px = this.player.pixelX - this.camera.x;
    const py = this.player.pixelY - this.camera.y;

    // プレイヤー本体
    const bodyColor = '#4488CC';
    const headColor = '#FFD699';
    renderer.drawSprite(px + 4, py + 2, TILE_SIZE - 8, TILE_SIZE - 4, {
      bodyColor: bodyColor,
      headColor: headColor,
    });

    // 方向インジケーター
    let indX = px + TILE_SIZE / 2 - 2, indY = py + TILE_SIZE / 2 - 2;
    switch (this.player.direction) {
      case 'up':    indY = py; break;
      case 'down':  indY = py + TILE_SIZE - 4; break;
      case 'left':  indX = px; break;
      case 'right': indX = px + TILE_SIZE - 4; break;
    }
    renderer.drawRect(indX, indY, 4, 4, '#FFF', 0.6);
  }

  drawMinimap(renderer, map) {
    const mmW = 160;
    const mmH = 100;
    const mmX = GAME_WIDTH - mmW - 10;
    const mmY = 10;

    // 背景
    renderer.drawRect(mmX, mmY, mmW, mmH, 'rgba(0,0,0,0.7)');
    renderer.drawRectOutline(mmX, mmY, mmW, mmH, 'rgba(255,255,255,0.3)');

    // タイルサイズの計算
    const scaleX = mmW / map.width;
    const scaleY = mmH / map.height;
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
        if (tile === TILE.WALL) dotColor = '#888';
        else if (tile === TILE.FLOOR || tile === TILE.EMPTY) dotColor = '#CCC';
        else if (tile === TILE.WATER) dotColor = '#4488CC';
        else if (tile === TILE.ENTRANCE) dotColor = '#FFD700';

        const dx = offsetX + tx * scale;
        const dy = offsetY + ty * scale;
        renderer.drawRect(dx, dy, Math.max(1, scale), Math.max(1, scale), dotColor);
      }
    }

    // NPCドット
    for (const npc of map.npcs) {
      const nx = offsetX + npc.x * scale;
      const ny = offsetY + npc.y * scale;
      renderer.drawRect(nx, ny, Math.max(2, scale + 1), Math.max(2, scale + 1), '#00FF00');
    }

    // 敵シンボルドット
    for (const enemy of this.enemySymbols) {
      const ex = offsetX + enemy.x * scale;
      const ey = offsetY + enemy.y * scale;
      const ec = enemy.isBoss ? '#FF0000' : '#FF66FF';
      renderer.drawRect(ex, ey, Math.max(2, scale + 1), Math.max(2, scale + 1), ec);
    }

    // プレイヤードット（点滅）
    const blink = Math.sin(Date.now() / 200) > 0;
    if (blink) {
      const ppx = offsetX + this.player.x * scale;
      const ppy = offsetY + this.player.y * scale;
      renderer.drawRect(ppx - 1, ppy - 1, Math.max(3, scale + 2), Math.max(3, scale + 2), '#FFFF00');
    }
  }
}
