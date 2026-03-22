// ====================================
// dialogue_scene.js — 会話シーン
// 四季廻りの職人
// 読み込み順: constants.js → scene.js → dialogue.js → dialogue_scene.js
// ====================================

class DialogueScene extends Scene {
  constructor(game) {
    super();
    this.game = game;
    this.engine = new DialogueEngine();

    // テキストウィンドウの配置
    this.windowX = 40;
    this.windowY = 380;
    this.windowW = 880;
    this.windowH = 140;
    this.windowRadius = 8;
    this.textPadding = 20;

    // 名札の配置
    this.nameBadgeH = 28;
    this.nameBadgeY = this.windowY - this.nameBadgeH - 4;

    // 次へマーク点滅
    this.blinkTimer = 0;

    // フェードイン演出
    this.enterFade = 0;

    // 背景暗転用（前シーンの残像風）
    this.bgDarkness = 0.5;
  }

  // -----------------------------------------------
  // enter: data = { dialogueId: string }
  // -----------------------------------------------
  enter(data) {
    this.blinkTimer = 0;
    this.enterFade = 0;
    this._pendingTransition = null;

    if (data && data.dialogueId) {
      this.engine.start(data.dialogueId);
    }

    // フェードインを開始（黒画面から明るくなる）
    this.game.renderer.fadeAlpha = 1;
    this.game.renderer.startFade(0, 0.03);
  }

  exit() {}
  pause() {}

  resume(data) {
    // pop で戻ってきた場合（通常は使わない）
  }

  // -----------------------------------------------
  // Update
  // -----------------------------------------------
  update(dt) {
    // フェード中は入力を受け付けない
    if (this.game.renderer.isFading()) return;

    this.blinkTimer += dt;
    this.enterFade = Math.min(1, this.enterFade + dt * 3);

    // ダイアログエンジン更新（文字送り）
    this.engine.update();

    // 入力判定
    const advancePressed =
      this.game.input.isJustPressed(' ') ||
      this.game.input.isJustPressed('Enter');
    const tap = this.game.input.consumeTap();

    if (advancePressed || tap) {
      if (this.engine.isFinished()) {
        // 会話完了 → 結果処理
        this._handleComplete();
      } else {
        this.engine.advance();
      }
    }
  }

  // -----------------------------------------------
  // 会話完了時の処理
  // -----------------------------------------------
  _handleComplete() {
    const result = this.engine.getResult();

    // addPartyMember: パーティに追加
    if (result.addPartyMember && this.game.state.party) {
      const charId = result.addPartyMember;
      if (typeof INITIAL_CHARACTERS !== 'undefined' && INITIAL_CHARACTERS[charId]) {
        const charData = INITIAL_CHARACTERS[charId];
        const newChar = new Character(charData);
        this.game.state.party.addMember(newChar);
      }
    }

    // setFlag: フラグ設定
    if (result.setFlag) {
      this.game.state.flags[result.setFlag] = true;
    }

    // action: 特殊アクション
    if (result.action === 'heal' && this.game.state.party) {
      if (typeof this.game.state.party.healAll === 'function') {
        this.game.state.party.healAll();
      } else if (Array.isArray(this.game.state.party.members)) {
        // フォールバック: 手動で全回復
        for (const m of this.game.state.party.members) {
          if (m) {
            m.hp = m.maxHp;
            m.mp = m.maxMp;
          }
        }
      }
    }

    // 遷移処理
    if (result.onComplete === 'return_to_title') {
      // タイトルに戻る
      this.game.renderer.startFade(1, 0.03);
      this._pendingTransition = () => {
        this.game.scenes.switch(SCENES.TITLE);
      };
      return;
    }

    if (result.onComplete && STORY[result.onComplete]) {
      // 次の会話を連続開始
      this.engine.start(result.onComplete);
      return;
    }

    // onComplete === null → 前のシーンに戻る or 探索シーンへ
    if (result.onComplete === null) {
      this.game.renderer.startFade(1, 0.02);
      const popData = { result: 'dialogue_end', action: result.action || null };
      this._pendingTransition = () => {
        if (this.game.scenes.sceneStack.length > 0) {
          this.game.scenes.pop(popData);
        } else {
          // スタックが空の場合（プロローグ直後など）→探索シーンへ
          this.game.scenes.switch(SCENES.EXPLORATION, { mapId: 'kasumikari' });
        }
      };
      return;
    }

    // フォールバック
    this.game.scenes.pop();
  }

  // -----------------------------------------------
  // Draw
  // -----------------------------------------------
  draw(renderer) {
    // === 背景: 暗い背景 ===
    renderer.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT, '#0a0a15', 1);
    // 季節カラーのわずかなアクセント（上部にグラデーション風）
    const currentSeason = (this.game.state.party && this.game.state.party.getLeader()) ? this.game.state.party.getLeader().currentSeason : SEASON.SPRING;
    const seasonColor = SEASON_COLORS[currentSeason].primary;
    renderer.drawRect(0, 0, GAME_WIDTH, 200, seasonColor, 0.08);

    // フェード中の遷移チェック
    if (this._pendingTransition && !renderer.isFading()) {
      const fn = this._pendingTransition;
      this._pendingTransition = null;
      fn();
      return;
    }

    const line = this.engine.getCurrentLine();
    if (!line && !this.engine.isFinished()) return;

    const alpha = this.enterFade;

    // === テキストウィンドウ背景 ===
    renderer.drawRoundedRect(
      this.windowX, this.windowY,
      this.windowW, this.windowH,
      this.windowRadius,
      `rgba(0, 0, 0, ${0.8 * alpha})`,
      `rgba(255, 255, 255, ${0.4 * alpha})`
    );

    if (!line) return;

    // === 話者名札 ===
    if (line.speaker) {
      const nameText = line.speaker;
      const ctx = renderer.ctx;
      ctx.font = "16px 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif";
      const nameWidth = ctx.measureText(nameText).width + 24;

      renderer.drawRoundedRect(
        this.windowX + 16, this.nameBadgeY,
        nameWidth, this.nameBadgeH,
        5,
        `rgba(60, 40, 100, ${0.9 * alpha})`,
        `rgba(200, 180, 255, ${0.5 * alpha})`
      );

      renderer.drawText(nameText, this.windowX + 28, this.nameBadgeY + 6, {
        size: 15,
        color: `rgba(255, 255, 255, ${alpha})`,
        align: 'left',
        shadow: false,
      });
    }

    // === テキスト表示（改行対応） ===
    const textX = this.windowX + this.textPadding;
    const textY = this.windowY + this.textPadding + 2;
    const lineHeight = 26;
    const displayText = this.engine.displayedText;
    const textLines = displayText.split('\n');

    // ナレーション（speaker=null）の場合は中央寄せ＆少し暗い色
    const isNarration = !line.speaker;

    for (let i = 0; i < textLines.length; i++) {
      if (isNarration) {
        renderer.drawText(textLines[i], GAME_WIDTH / 2, textY + i * lineHeight, {
          size: 17,
          color: `rgba(200, 200, 220, ${alpha})`,
          align: 'center',
          shadow: true,
          shadowColor: `rgba(0, 0, 0, ${alpha * 0.5})`,
        });
      } else {
        renderer.drawText(textLines[i], textX, textY + i * lineHeight, {
          size: 18,
          color: `rgba(255, 255, 255, ${alpha})`,
          align: 'left',
          shadow: true,
          shadowColor: `rgba(0, 0, 0, ${alpha * 0.8})`,
        });
      }
    }

    // === 次へマーク ▼ （点滅）===
    if (this.engine.isWaitingForInput()) {
      const blink = Math.sin(this.blinkTimer * 4) > 0;
      if (blink) {
        renderer.drawText('▼', this.windowX + this.windowW - 40, this.windowY + this.windowH - 28, {
          size: 16,
          color: `rgba(255, 255, 255, ${alpha * 0.8})`,
          align: 'center',
          shadow: false,
        });
      }
    }

    // === 操作ガイド（下端）===
    renderer.drawText('SPACE / TAP : 次へ', GAME_WIDTH / 2, GAME_HEIGHT - 20, {
      size: 12,
      color: `rgba(255, 255, 255, ${alpha * 0.3})`,
      align: 'center',
      shadow: false,
    });
  }
}
