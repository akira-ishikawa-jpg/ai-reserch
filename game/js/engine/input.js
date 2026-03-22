// Input Manager - handles keyboard and touch
class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this.touches = [];
    this.tapPosition = null;
    this.virtualStick = { active: false, dx: 0, dy: 0 };

    window.addEventListener('keydown', e => {
      if (!this.keys[e.key]) this.justPressed[e.key] = true;
      this.keys[e.key] = true;
      e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key] = false;
      e.preventDefault();
    });

    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('touchstart', e => this._handleTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', e => this._handleTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', e => this._handleTouchEnd(e), { passive: false });
    canvas.addEventListener('click', e => this._handleClick(e));
  }

  _getCanvasPos(clientX, clientY) {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width * GAME_WIDTH,
      y: (clientY - rect.top) / rect.height * GAME_HEIGHT,
    };
  }

  _handleClick(e) {
    this.tapPosition = this._getCanvasPos(e.clientX, e.clientY);
  }

  _handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = this._getCanvasPos(touch.clientX, touch.clientY);
    this.tapPosition = pos;

    // Virtual stick if touch is in the left third
    if (pos.x < GAME_WIDTH / 3 && pos.y > GAME_HEIGHT * 0.5) {
      this.virtualStick.active = true;
      this.virtualStick.originX = pos.x;
      this.virtualStick.originY = pos.y;
      this.virtualStick.dx = 0;
      this.virtualStick.dy = 0;
    }
  }

  _handleTouchMove(e) {
    e.preventDefault();
    if (!this.virtualStick.active) return;
    const touch = e.touches[0];
    const pos = this._getCanvasPos(touch.clientX, touch.clientY);
    const dx = pos.x - this.virtualStick.originX;
    const dy = pos.y - this.virtualStick.originY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 40;
    if (len > 0) {
      const clamp = Math.min(len, maxDist);
      this.virtualStick.dx = (dx / len) * clamp / maxDist;
      this.virtualStick.dy = (dy / len) * clamp / maxDist;
    }
  }

  _handleTouchEnd(e) {
    e.preventDefault();
    this.virtualStick.active = false;
    this.virtualStick.dx = 0;
    this.virtualStick.dy = 0;
  }

  isDown(key) {
    return !!this.keys[key];
  }

  isJustPressed(key) {
    return !!this.justPressed[key];
  }

  consumeTap() {
    const pos = this.tapPosition;
    this.tapPosition = null;
    return pos;
  }

  getMovement() {
    let dx = 0, dy = 0;
    if (this.keys['ArrowLeft'] || this.keys['a']) dx -= 1;
    if (this.keys['ArrowRight'] || this.keys['d']) dx += 1;
    if (this.keys['ArrowUp'] || this.keys['w']) dy -= 1;
    if (this.keys['ArrowDown'] || this.keys['s']) dy += 1;

    if (this.virtualStick.active) {
      if (Math.abs(this.virtualStick.dx) > 0.3) dx = Math.sign(this.virtualStick.dx);
      if (Math.abs(this.virtualStick.dy) > 0.3) dy = Math.sign(this.virtualStick.dy);
    }
    return { dx, dy };
  }

  endFrame() {
    this.justPressed = {};
  }
}
