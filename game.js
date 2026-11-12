'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#2979ff', // J - vivid blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// ---- Skins (apariencia de las piezas y del tablero) ----
// Cada skin define su paleta (índices 1–7 = I,O,T,S,Z,J,L), el color de la
// rejilla (null = usar el del tema claro/oscuro), el fondo del tablero
// (null = usar --surface del tema) y su propia función de dibujo de bloque.

// Rectángulo con esquinas redondeadas; usa ctx.roundRect si existe y si no, arcos manuales
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.arcTo(x + w, y, x + w, y + r, r);
  context.lineTo(x + w, y + h - r);
  context.arcTo(x + w, y + h, x + w - r, y + h, r);
  context.lineTo(x + r, y + h);
  context.arcTo(x, y + h, x, y + h - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    grid: null,
    boardBg: null,
    // Bloques cuadrados con color plano y un ligero brillo superior (estilo original)
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    name: 'Neon',
    colors: [null, '#00f5ff', '#fff200', '#d400ff', '#39ff14', '#ff073a', '#1f51ff', '#ff9900'],
    grid: '#0d1a2b',
    boardBg: '#000000',
    // Contorno brillante con glow (shadowBlur) del color de la pieza
    drawBlock(context, x, y, color, size, alpha) {
      const px = x * size, py = y * size;
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      context.fillStyle = color;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      // núcleo oscuro para dar efecto de tubo de neón
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(px + 6, py + 6, size - 12, size - 12);
      context.strokeStyle = 'rgba(255,255,255,0.7)';
      context.lineWidth = 1;
      context.strokeRect(px + 3.5, py + 3.5, size - 7, size - 7);
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a8e6ef', '#fdf1a8', '#d7b8f0', '#b8e8c0', '#f8b8c0', '#a8c4f8', '#fdd0a8'],
    grid: null,
    boardBg: null,
    // Bloques suaves con esquinas redondeadas y un brillo interior
    drawBlock(context, x, y, color, size, alpha) {
      const px = x * size, py = y * size;
      const r = size * 0.25;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      roundedRectPath(context, px + 2, py + 2, size - 4, size - 4, r);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.35)';
      roundedRectPath(context, px + 5, py + 4, size - 10, size * 0.3, r * 0.6);
      context.fill();
    },
  },
  pixel: {
    name: 'Pixel',
    colors: [null, '#3cbcfc', '#f8d878', '#b853f8', '#58d854', '#f83800', '#0058f8', '#fc7460'],
    grid: null,
    boardBg: null,
    // Bloque con bisel (luz arriba/izquierda, sombra abajo/derecha) y textura de píxeles en damero
    drawBlock(context, x, y, color, size, alpha) {
      const px = x * size, py = y * size;
      const p = Math.max(2, Math.floor(size / 8)); // tamaño del "píxel"
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      // bisel
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(px, py, size, p);
      context.fillRect(px, py, p, size);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(px, py + size - p, size, p);
      context.fillRect(px + size - p, py, p, size);
      // textura en damero dentro del bisel
      context.fillStyle = 'rgba(0,0,0,0.12)';
      for (let iy = py + p; iy < py + size - p; iy += p)
        for (let ix = px + p; ix < px + size - p; ix += p)
          if (((ix - px) / p + (iy - py) / p) % 2 === 0)
            context.fillRect(ix, iy, Math.min(p, px + size - p - ix), Math.min(p, py + size - p - iy));
      // brillo de un píxel en la esquina superior izquierda
      context.fillStyle = 'rgba(255,255,255,0.8)';
      context.fillRect(px + p, py + p, p, p);
    },
  },
};

let currentSkin = 'retro';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// Combo: bloqueos consecutivos que limpian al menos una línea
let combo = 0, maxCombo = 0;

// ---- Menú de pausa (estado) ----
const MAX_START_LEVEL = 10;
const pauseMenu = document.getElementById('pause-menu');
const pauseResumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControlsList = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('pause-start-level');
let startLevel = loadStartLevel(); // nivel elegido para la PRÓXIMA partida
let gameStartLevel = 1;            // nivel con el que empezó la partida actual
const pressedKeys = new Set();     // teclas actualmente pulsadas
let ignoredKeys = new Set();       // teclas pulsadas al reanudar: se ignoran hasta soltarlas

function loadStartLevel() {
  let v = 1;
  try { v = parseInt(localStorage.getItem('startLevel'), 10); } catch (e) {}
  return Number.isInteger(v) && v >= 1 && v <= MAX_START_LEVEL ? v : 1;
}

function levelInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}
// ---- Fin menú de pausa (estado) ----

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  updateCombo(cleared);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(gameStartLevel, Math.floor(lines / 10) + 1);
    dropInterval = levelInterval(level);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  // Si la siguiente pieza no cabe, se acaba el juego: no sale ninguna ficha más
  if (collide(next.shape, next.x, next.y)) {
    current = null;
    endGame();
    return;
  }
  current = next;
  next = randomPiece();
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  skin.drawBlock(context, x, y, skin.colors[colorIndex], size, alpha ?? 1);
  // restaurar el estado que las skins pueden modificar
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid || gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!current) return; // game over: solo el tablero, sin pieza activa

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverHighscores();
}

// ---- Menú de pausa ----
function showPauseMenu() {
  startLevelSelect.value = String(startLevel);
  pauseMenu.classList.remove('hidden');
  pauseResumeBtn.focus();
}

function hidePauseMenu() {
  pauseMenu.classList.add('hidden');
  pauseControlsList.hidden = true;
  pauseControlsBtn.setAttribute('aria-expanded', 'false');
  pauseControlsBtn.textContent = 'Ver controles';
  // quitar el foco: Space/Enter no deben volver a activar un botón del menú
  if (document.activeElement && pauseMenu.contains(document.activeElement))
    document.activeElement.blur();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    // las teclas que siguen pulsadas no deben mover la pieza al volver
    ignoredKeys = new Set(pressedKeys);
    // sin caída instantánea: el tiempo en pausa no cuenta
    dropAccum = 0;
    lastTime = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
  }
}

pauseResumeBtn.addEventListener('click', () => { if (paused) togglePause(); });

pauseRestartBtn.addEventListener('click', () => {
  pauseRestartBtn.blur();
  init();
});

pauseControlsBtn.addEventListener('click', () => {
  const open = pauseControlsList.hidden;
  pauseControlsList.hidden = !open;
  pauseControlsBtn.setAttribute('aria-expanded', String(open));
  pauseControlsBtn.textContent = open ? 'Ocultar controles' : 'Ver controles';
});

for (let i = 1; i <= MAX_START_LEVEL; i++) {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = String(i);
  startLevelSelect.appendChild(opt);
}
startLevelSelect.value = String(startLevel);

startLevelSelect.addEventListener('change', () => {
  const v = parseInt(startLevelSelect.value, 10);
  if (!Number.isInteger(v) || v < 1 || v > MAX_START_LEVEL) return;
  startLevel = v;
  try { localStorage.setItem('startLevel', String(v)); } catch (e) {}
});

document.addEventListener('keyup', e => {
  pressedKeys.delete(e.code);
  ignoredKeys.delete(e.code);
});

// al perder el foco de la ventana no llegan los keyup: limpiar el registro
window.addEventListener('blur', () => {
  pressedKeys.clear();
  ignoredKeys.clear();
});
// ---- Fin menú de pausa ----

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() puede haberse llamado durante lockPiece(): no reprogramar el loop
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  gameStartLevel = startLevel;
  level = gameStartLevel;
  paused = false;
  gameOver = false;
  dropInterval = levelInterval(level);
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  hideHighscorePanels();
  startScreen.classList.add('hidden');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hidePauseMenu();
  ignoredKeys = new Set(pressedKeys);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  pressedKeys.add(e.code);
  // Escribiendo en un campo de texto (nombre del récord): no mover piezas
  if (e.target instanceof HTMLInputElement) return;
  // Pantalla de inicio visible: aún no hay partida
  if (!startScreen.classList.contains('hidden')) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // ignorar auto-repeat: mantener P no debe abrir/cerrar en bucle
    if (!e.repeat) togglePause();
    return;
  }
  // menú abierto: dejar que Tab/Enter/Space/flechas actúen sobre el menú
  if (paused || gameOver) return;
  // teclas mantenidas desde antes de reanudar/reiniciar: ignorar hasta soltarlas
  if (ignoredKeys.has(e.code)) {
    if (e.code === 'Space') e.preventDefault();
    return;
  }
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  gridColor = getComputedStyle(root).getPropertyValue('--grid').trim() || '#22222e';
  if (board) draw(); // repinta también en pausa / game over
}

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', next); } catch (e) {}
  applyTheme(next);
  themeToggle.blur(); // no robar el foco: Space activaría el botón
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

// ---- Selector de skin ----
const skinSelect = document.getElementById('skin-select');

function applySkin(name) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, name)) name = 'retro';
  currentSkin = name;
  const bg = SKINS[name].boardBg;
  canvas.style.background = bg || '';
  nextCanvas.style.background = bg || '';
  skinSelect.value = name;
  // repinta sin recargar, también en pausa / game over
  if (board) draw();
  if (next) drawNext();
}

skinSelect.addEventListener('change', () => {
  try { localStorage.setItem('tetris-skin', skinSelect.value); } catch (e) {}
  applySkin(skinSelect.value);
  skinSelect.blur(); // las flechas / Space deben controlar la pieza, no el selector
});

// Si el selector conserva el foco, las teclas de juego no deben cambiar la skin
skinSelect.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyX', 'KeyP'].includes(e.code)) {
    e.preventDefault();
    skinSelect.blur();
  }
});

{
  let savedSkin = null;
  try { savedSkin = localStorage.getItem('tetris-skin'); } catch (e) {}
  applySkin(savedSkin);
}


/* ---- Tabla de records (localStorage) ---- */

const HS_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const HS_MAX = 5;

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const hsStart = document.getElementById('hs-start');
const hsGameOver = document.getElementById('hs-gameover');
const hsEntry = document.getElementById('hs-entry');
const hsName = document.getElementById('hs-name');
const hsSaveBtn = document.getElementById('hs-save-btn');

function updateCombo(cleared) {
  combo = cleared ? combo + 1 : 0;
  if (combo > maxCombo) maxCombo = combo;
}

function loadHighscores() {
  try {
    const data = JSON.parse(localStorage.getItem(HS_KEY));
    if (!Array.isArray(data)) return [];
    return data
      .filter(e => e && typeof e.score === 'number')
      .sort((a, b) => b.score - a.score)
      .slice(0, HS_MAX);
  } catch (e) {
    return [];
  }
}

function saveHighscores(list) {
  try { localStorage.setItem(HS_KEY, JSON.stringify(list)); } catch (e) {}
}

// Mejor combo y máximo de líneas de cualquier partida (aunque no entre en el top)
function loadStats() {
  try {
    const data = JSON.parse(localStorage.getItem(STATS_KEY));
    if (data && typeof data === 'object') {
      return { bestCombo: Number(data.bestCombo) || 0, maxLines: Number(data.maxLines) || 0 };
    }
  } catch (e) {}
  return { bestCombo: 0, maxLines: 0 };
}

function recordStats() {
  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
  stats.maxLines = Math.max(stats.maxLines, lines);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
}

function qualifies(value) {
  if (value <= 0) return false;
  const list = loadHighscores();
  return list.length < HS_MAX || value > list[list.length - 1].score;
}

function formatDate(ts) {
  const d = new Date(ts);
  return isNaN(d) ? '' : d.toLocaleDateString();
}

// Construye la tabla en `container`. highlight: entrada recién guardada (o null)
function renderHighscores(container, highlight) {
  const list = loadHighscores();
  const stats = loadStats();
  container.replaceChildren();

  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'hs-empty';
    empty.textContent = 'Aún no hay records';
    container.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'hs-table';
    const head = table.createTHead().insertRow();
    for (const h of ['#', 'Nombre', 'Puntos', 'Líneas', 'Combo', 'Fecha']) {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    }
    const body = table.createTBody();
    list.forEach((e, i) => {
      const row = body.insertRow();
      const isNew = highlight && e.date === highlight.date && e.score === highlight.score && e.name === highlight.name;
      if (isNew) row.className = 'hs-new';
      const cells = [i + 1, e.name || '???', e.score.toLocaleString(), e.lines ?? 0, e.maxCombo ?? 0, formatDate(e.date)];
      for (const v of cells) row.insertCell().textContent = String(v); // textContent: nombres escapados
    });
    container.appendChild(table);
  }

  // Los máximos globales también consideran las entradas del top
  for (const e of list) {
    stats.bestCombo = Math.max(stats.bestCombo, Number(e.maxCombo) || 0);
    stats.maxLines = Math.max(stats.maxLines, Number(e.lines) || 0);
  }

  const summary = document.createElement('p');
  summary.className = 'hs-stats';
  summary.textContent = `Mejor combo: ${stats.bestCombo} · Líneas máx.: ${stats.maxLines}`;
  container.appendChild(summary);

  if (list.length || stats.bestCombo || stats.maxLines) {
    const reset = document.createElement('button');
    reset.className = 'hs-btn hs-reset';
    reset.textContent = 'Borrar records';
    reset.addEventListener('click', () => {
      reset.blur();
      if (!confirm('¿Borrar todos los records?')) return;
      try {
        localStorage.removeItem(HS_KEY);
        localStorage.removeItem(STATS_KEY);
      } catch (e) {}
      renderHighscores(hsStart, null);
      if (!hsGameOver.classList.contains('hidden')) renderHighscores(hsGameOver, null);
    });
    container.appendChild(reset);
  }
}

function hideHighscorePanels() {
  hsEntry.classList.add('hidden');
  hsGameOver.classList.add('hidden');
}

function showGameOverHighscores() {
  recordStats();
  if (qualifies(score)) {
    overlayTitle.textContent = '¡NUEVO RÉCORD!';
    hsEntry.classList.remove('hidden');
    hsName.value = '';
    hsName.focus();
  }
  renderHighscores(hsGameOver, null);
  hsGameOver.classList.remove('hidden');
}

function saveCurrentScore() {
  if (!gameOver || hsEntry.classList.contains('hidden')) return;
  const entry = {
    name: hsName.value.trim().slice(0, 12) || 'Anónimo',
    score,
    lines,
    maxCombo,
    date: Date.now(),
  };
  const list = loadHighscores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score); // sort estable: empates detrás de los existentes
  saveHighscores(list.slice(0, HS_MAX));
  hsEntry.classList.add('hidden');
  hsName.blur();
  renderHighscores(hsGameOver, entry);
  renderHighscores(hsStart, null);
}

hsSaveBtn.addEventListener('click', () => {
  saveCurrentScore();
  hsSaveBtn.blur();
});

hsName.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveCurrentScore();
});

playBtn.addEventListener('click', () => {
  playBtn.blur();
  init();
});

function showStartScreen() {
  board = createBoard(); // tablero vacío de fondo
  draw();
  renderHighscores(hsStart, null);
  startScreen.classList.remove('hidden');
}

showStartScreen();
