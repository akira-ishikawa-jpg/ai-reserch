// Scene Manager
class SceneManager {
  constructor() {
    this.scenes = {};
    this.currentScene = null;
    this.sceneStack = [];
    this.transitionData = null;
  }

  register(name, scene) {
    this.scenes[name] = scene;
  }

  switch(name, data = {}) {
    if (this.currentScene && this.scenes[this.currentScene]) {
      this.scenes[this.currentScene].exit();
    }
    this.currentScene = name;
    this.transitionData = data;
    if (this.scenes[name]) {
      this.scenes[name].enter(data);
    }
  }

  // Push scene onto stack (for overlays like battle)
  push(name, data = {}) {
    if (this.currentScene) {
      this.sceneStack.push(this.currentScene);
      if (this.scenes[this.currentScene]) {
        this.scenes[this.currentScene].pause();
      }
    }
    this.currentScene = name;
    this.transitionData = data;
    if (this.scenes[name]) {
      this.scenes[name].enter(data);
    }
  }

  // Pop back to previous scene
  pop(data = {}) {
    if (this.currentScene && this.scenes[this.currentScene]) {
      this.scenes[this.currentScene].exit();
    }
    if (this.sceneStack.length > 0) {
      this.currentScene = this.sceneStack.pop();
      if (this.scenes[this.currentScene]) {
        this.scenes[this.currentScene].resume(data);
      }
    }
  }

  update(dt) {
    if (this.currentScene && this.scenes[this.currentScene]) {
      this.scenes[this.currentScene].update(dt);
    }
  }

  draw(renderer) {
    if (this.currentScene && this.scenes[this.currentScene]) {
      this.scenes[this.currentScene].draw(renderer);
    }
  }
}

// Base Scene class
class Scene {
  enter(data) {}
  exit() {}
  pause() {}
  resume(data) {}
  update(dt) {}
  draw(renderer) {}
}
