// Main Game class
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager();
    this.scenes = new SceneManager();
    this.audio = typeof AudioManager !== 'undefined' ? new AudioManager() : null;
    this.lastTime = 0;
    this.running = false;

    // Game state
    this.state = {
      party: null,       // PartyManager
      chapter: 1,
      flags: {},         // Story flags
      currentMap: null,
      gold: 100,
    };
  }

  init() {
    // Initialize party
    this.state.party = new PartyManager();

    // Register scenes
    this.scenes.register(SCENES.TITLE, new TitleScene(this));
    this.scenes.register(SCENES.EXPLORATION, new ExplorationScene(this));
    this.scenes.register(SCENES.BATTLE, new BattleScene(this));
    this.scenes.register(SCENES.DIALOGUE, new DialogueScene(this));

    // Start at title
    this.scenes.switch(SCENES.TITLE);
    this.running = true;
    this.lastTime = performance.now();
    this._loop();
  }

  _loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // cap at 50ms
    this.lastTime = now;

    this.update(dt);
    this.draw();
    this.input.endFrame();

    requestAnimationFrame(() => this._loop());
  }

  update(dt) {
    this.scenes.update(dt);
    this.renderer.updateParticles();
  }

  draw() {
    this.renderer.ctx.globalAlpha = 1;
    this.renderer.clear('#1a1a2e');
    this.renderer.applyShake();
    this.scenes.draw(this.renderer);
    this.renderer.drawParticles();
    this.renderer.updateFade();
    this.renderer.resetTransform();
  }
}
