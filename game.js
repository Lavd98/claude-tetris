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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
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

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    hideHighscorePanels();
    overlay.classList.remove('hidden');
  }
}

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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
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
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Escribiendo en un campo de texto (nombre del récord): no mover piezas
  if (e.target instanceof HTMLInputElement) return;
  // Pantalla de inicio visible: aún no hay partida
  if (!startScreen.classList.contains('hidden')) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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
