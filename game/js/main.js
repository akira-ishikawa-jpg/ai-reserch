// main.js — Game Entry Point
// 「四季廻りの職人」プロトタイプ

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();

  // Initialize party with hero
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

  // Tsumugi is added via story event (tsumugi_meeting dialogue)
  // Her data is defined here for the dialogue system to use
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

  // Start the game
  game.init();

  // Make game globally accessible for debugging
  window.game = game;
});
