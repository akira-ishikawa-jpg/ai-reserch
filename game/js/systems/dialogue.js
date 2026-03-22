// ====================================
// dialogue.js — ダイアログエンジン
// 四季廻りの職人
// 読み込み順: constants.js → story.js → dialogue.js
// ====================================

class DialogueEngine {
  constructor() {
    this.currentDialogue = null;   // 現在の会話ブロック (STORY のエントリ)
    this.lineIndex = 0;            // 現在の行インデックス
    this.charIndex = 0;            // 文字送りアニメーション用インデックス
    this.isTyping = false;         // 文字送り中か
    this.typeSpeed = 2;            // 1フレームあたりの表示文字数
    this.displayedText = '';       // 画面に表示中のテキスト
    this.isComplete = false;       // 全行表示完了フラグ
    this.frameCount = 0;           // フレームカウンタ（点滅用）
  }

  /**
   * 会話を開始する
   * @param {string} dialogueId - STORY内のキー
   */
  start(dialogueId) {
    if (!STORY[dialogueId]) {
      console.warn(`DialogueEngine: unknown dialogue id "${dialogueId}"`);
      this.isComplete = true;
      return;
    }
    this.currentDialogue = STORY[dialogueId];
    this.lineIndex = 0;
    this.charIndex = 0;
    this.isTyping = true;
    this.displayedText = '';
    this.isComplete = false;
    this.frameCount = 0;
  }

  /**
   * 毎フレーム呼ぶ — 文字送りアニメーション更新
   */
  update() {
    if (!this.currentDialogue || this.isComplete) return;

    this.frameCount++;

    if (this.isTyping) {
      const line = this.currentDialogue.lines[this.lineIndex];
      if (!line) {
        this.isComplete = true;
        return;
      }
      const fullText = line.text;
      // typeSpeed 文字ずつ追加
      this.charIndex += this.typeSpeed;
      if (this.charIndex >= fullText.length) {
        this.charIndex = fullText.length;
        this.displayedText = fullText;
        this.isTyping = false;
      } else {
        this.displayedText = fullText.substring(0, this.charIndex);
      }
    }
  }

  /**
   * 次の行へ進む（タップ / スペース / Enter）
   * @returns {boolean} まだ会話が続くなら true
   */
  advance() {
    if (!this.currentDialogue || this.isComplete) return false;

    // 文字送り中なら全文即表示
    if (this.isTyping) {
      const line = this.currentDialogue.lines[this.lineIndex];
      if (line) {
        this.displayedText = line.text;
        this.charIndex = line.text.length;
      }
      this.isTyping = false;
      return true;
    }

    // 全文表示済み → 次の行へ
    this.lineIndex++;
    if (this.lineIndex >= this.currentDialogue.lines.length) {
      // 最後の行だった → 完了
      this.isTyping = false;
      this.isComplete = true;
      return false;
    }

    // 新しい行の表示開始
    this.charIndex = 0;
    this.displayedText = '';
    this.isTyping = true;
    this.frameCount = 0;
    return true;
  }

  /**
   * 現在の行データを返す
   * @returns {{ speaker: string|null, text: string, emotion?: string } | null}
   */
  getCurrentLine() {
    if (!this.currentDialogue) return null;
    if (this.lineIndex >= this.currentDialogue.lines.length) return null;
    return this.currentDialogue.lines[this.lineIndex];
  }

  /**
   * 全行表示完了か
   */
  isFinished() {
    return this.isComplete;
  }

  /**
   * ▼マークの点滅用 — 全文表示済みかつ文字送り停止中
   */
  isWaitingForInput() {
    return !this.isTyping && !this.isComplete && this.currentDialogue !== null;
  }

  /**
   * 完了時の結果を返す
   * @returns {{ onComplete: string|null, addPartyMember?: string, setFlag?: string, action?: string }}
   */
  getResult() {
    if (!this.currentDialogue) return { onComplete: null };
    return {
      onComplete: this.currentDialogue.onComplete || null,
      addPartyMember: this.currentDialogue.addPartyMember || null,
      setFlag: this.currentDialogue.setFlag || null,
      action: this.currentDialogue.action || null,
    };
  }
}
