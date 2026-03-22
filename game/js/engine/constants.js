// Game Constants
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const TILE_SIZE = 32;
const FPS = 60;

// Seasons
const SEASON = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
};

const SEASON_ORDER = [SEASON.SPRING, SEASON.SUMMER, SEASON.AUTUMN, SEASON.WINTER];

const SEASON_NAMES = {
  [SEASON.SPRING]: '春',
  [SEASON.SUMMER]: '夏',
  [SEASON.AUTUMN]: '秋',
  [SEASON.WINTER]: '冬',
};

const SEASON_COLORS = {
  [SEASON.SPRING]: { primary: '#FFB7C5', secondary: '#E8F5E9', accent: '#FF69B4', bg: '#FFF0F5' },
  [SEASON.SUMMER]: { primary: '#FF8C00', secondary: '#228B22', accent: '#FFD700', bg: '#FFFDE7' },
  [SEASON.AUTUMN]: { primary: '#DC143C', secondary: '#DAA520', accent: '#8B4513', bg: '#FFF3E0' },
  [SEASON.WINTER]: { primary: '#4169E1', secondary: '#B0C4DE', accent: '#E0E0E0', bg: '#E8EAF6' },
};

// Get opposite season
function getOppositeSeason(season) {
  const idx = SEASON_ORDER.indexOf(season);
  return SEASON_ORDER[(idx + 2) % 4];
}

// Get next season
function getNextSeason(season) {
  const idx = SEASON_ORDER.indexOf(season);
  return SEASON_ORDER[(idx + 1) % 4];
}

// Get season distance (0=same, 1=adjacent, 2=opposite)
function getSeasonDistance(a, b) {
  const idxA = SEASON_ORDER.indexOf(a);
  const idxB = SEASON_ORDER.indexOf(b);
  const diff = Math.abs(idxA - idxB);
  return Math.min(diff, 4 - diff);
}

// Damage multiplier based on season matchup
function getSeasonMultiplier(attackSeason, targetSeason) {
  const dist = getSeasonDistance(attackSeason, targetSeason);
  if (dist === 0) return 0.1;  // Same: almost nullified
  if (dist === 1) return 1.0;  // Adjacent: normal
  return 1.8;                  // Opposite: big damage
}

// Scene names
const SCENES = {
  TITLE: 'title',
  EXPLORATION: 'exploration',
  BATTLE: 'battle',
  DIALOGUE: 'dialogue',
};
