// main.js — Game Entry Point
// 「四季廻りの職人」プロトタイプ

window.addEventListener('DOMContentLoaded', () => {
  try {
    const game = new Game();

    // Tsumugi data for dialogue system to add later
    window.INITIAL_CHARACTERS = {
      tsumugi: {
        id: 'tsumugi',
        name: '紬',
        level: 4,
        maxHp: 280,
        maxMp: 120,
        atk: 15,
        def: 20,
        matk: 35,
        mdef: 30,
        spd: 18,
        startingSeason: SEASON.SPRING,
        jobId: 'souShunYakushi',
        spriteData: { bodyColor: '#FFB7C5', headColor: '#FFF0F5' },
      },
    };

    // Init creates PartyManager and registers scenes
    game.init();

    // Add hero to party (after init creates PartyManager)
    const hero = new Character({
      id: 'hero',
      name: '主人公',
      level: 5,
      maxHp: 350,
      maxMp: 60,
      atk: 35,
      def: 25,
      matk: 15,
      mdef: 18,
      spd: 22,
      startingSeason: SEASON.SUMMER,
      jobId: 'rekkaNoKenshi',
      spriteData: { bodyColor: '#4169E1', headColor: '#FFD700' },
    });
    game.state.party.addMember(hero);

    // Debug access
    window.game = game;

  } catch (e) {
    // Show error on screen for debugging
    document.body.style.background = '#200';
    document.body.style.color = '#FFF';
    document.body.style.padding = '20px';
    document.body.style.fontFamily = 'monospace';
    document.body.innerHTML = '<h2>Game Error</h2><pre>' + e.message + '\n\n' + e.stack + '</pre>';
  }
});
