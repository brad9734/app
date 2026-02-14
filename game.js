const BOARD_SIZE = 8;
const COLORS = ["#f43f5e", "#38bdf8", "#4ade80", "#f59e0b", "#a78bfa"];

const state = {
  energy: 0,
  gold: 0,
  baseHp: 100,
  wave: 1,
  enemies: [],
  towers: {
    arrow: 0,
    mage: 0,
  },
  autoClickLevel: 0,
  board: [],
  selectedIndex: null,
};

const ui = {
  energy: document.getElementById("energy"),
  gold: document.getElementById("gold"),
  baseHp: document.getElementById("baseHp"),
  wave: document.getElementById("wave"),
  enemyCount: document.getElementById("enemyCount"),
  arrowCount: document.getElementById("arrowCount"),
  mageCount: document.getElementById("mageCount"),
  autoClickLevel: document.getElementById("autoClickLevel"),
  arrowDps: document.getElementById("arrowDps"),
  mageDps: document.getElementById("mageDps"),
  autoEnergy: document.getElementById("autoEnergy"),
  board: document.getElementById("board"),
  log: document.getElementById("log"),
};

function addLog(message) {
  const li = document.createElement("li");
  li.textContent = message;
  ui.log.prepend(li);
  while (ui.log.children.length > 20) {
    ui.log.removeChild(ui.log.lastChild);
  }
}

function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function initBoard() {
  state.board = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => randColor());
  renderBoard();
}

function renderBoard() {
  ui.board.innerHTML = "";
  state.board.forEach((color, index) => {
    const btn = document.createElement("button");
    btn.className = "tile";
    if (index === state.selectedIndex) btn.classList.add("selected");
    btn.style.background = color;
    btn.addEventListener("click", () => onTileClick(index));
    ui.board.appendChild(btn);
  });
}

function coords(index) {
  return [Math.floor(index / BOARD_SIZE), index % BOARD_SIZE];
}

function adjacent(a, b) {
  const [ar, ac] = coords(a);
  const [br, bc] = coords(b);
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

function swap(a, b) {
  [state.board[a], state.board[b]] = [state.board[b], state.board[a]];
}

function collectMatches() {
  const matched = new Set();

  for (let r = 0; r < BOARD_SIZE; r++) {
    let streak = 1;
    for (let c = 1; c <= BOARD_SIZE; c++) {
      const i = r * BOARD_SIZE + c;
      const prev = r * BOARD_SIZE + c - 1;
      if (c < BOARD_SIZE && state.board[i] === state.board[prev]) {
        streak += 1;
      } else {
        if (streak >= 3) {
          for (let k = 0; k < streak; k++) matched.add(prev - k);
        }
        streak = 1;
      }
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let streak = 1;
    for (let r = 1; r <= BOARD_SIZE; r++) {
      const i = r * BOARD_SIZE + c;
      const prev = (r - 1) * BOARD_SIZE + c;
      if (r < BOARD_SIZE && state.board[i] === state.board[prev]) {
        streak += 1;
      } else {
        if (streak >= 3) {
          for (let k = 0; k < streak; k++) matched.add(prev - k * BOARD_SIZE);
        }
        streak = 1;
      }
    }
  }

  return [...matched];
}

function resolveBoard() {
  const matches = collectMatches();
  if (!matches.length) return false;

  state.energy += matches.length;
  state.gold += Math.floor(matches.length / 2);
  addLog(`Matched ${matches.length} crystals: +${matches.length} Energy, +${Math.floor(matches.length / 2)} Gold`);

  matches.forEach((i) => {
    state.board[i] = null;
  });

  for (let c = 0; c < BOARD_SIZE; c++) {
    const stack = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const i = r * BOARD_SIZE + c;
      if (state.board[i]) stack.push(state.board[i]);
    }
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const i = r * BOARD_SIZE + c;
      state.board[i] = stack[BOARD_SIZE - 1 - r] || randColor();
    }
  }

  return true;
}

function onTileClick(index) {
  if (state.selectedIndex === null) {
    state.selectedIndex = index;
    renderBoard();
    return;
  }

  if (state.selectedIndex === index) {
    state.selectedIndex = null;
    renderBoard();
    return;
  }

  if (!adjacent(state.selectedIndex, index)) {
    state.selectedIndex = index;
    renderBoard();
    return;
  }

  swap(state.selectedIndex, index);
  const valid = resolveBoard();
  if (!valid) {
    swap(state.selectedIndex, index);
  } else {
    while (resolveBoard()) {
      // chain cascades
    }
  }

  state.selectedIndex = null;
  renderBoard();
  renderStats();
}

function spawnEnemy() {
  const hp = 20 + state.wave * 5;
  const damage = 4 + state.wave;
  state.enemies.push({ hp, damage, progress: 0 });
}

function runCombatTick() {
  const arrowDamage = state.towers.arrow * 2;
  const mageDamage = state.towers.mage * 4;
  let dpsPool = arrowDamage + mageDamage;

  state.enemies.forEach((enemy) => {
    if (dpsPool <= 0) return;
    const dealt = Math.min(enemy.hp, dpsPool);
    enemy.hp -= dealt;
    dpsPool -= dealt;
  });

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.hp <= 0) {
      state.gold += 5;
      return false;
    }
    return true;
  });

  state.enemies.forEach((enemy) => {
    enemy.progress += 0.3;
    if (enemy.progress >= 10) {
      state.baseHp -= enemy.damage;
      enemy.progress = 0;
      addLog(`Base hit for ${enemy.damage}!`);
    }
  });

  if (state.baseHp <= 0) {
    addLog("Base destroyed. Resetting run.");
    Object.assign(state, {
      energy: 0,
      gold: 0,
      baseHp: 100,
      wave: 1,
      enemies: [],
      towers: { arrow: 0, mage: 0 },
      autoClickLevel: 0,
    });
  }

  renderStats();
}

function runEconomyTick() {
  state.energy += state.autoClickLevel;

  if (state.energy >= 15) {
    const spawned = Math.floor(state.energy / 15);
    state.energy -= spawned * 15;
    for (let i = 0; i < spawned; i++) spawnEnemy();
    if (spawned > 0) addLog(`Energy overflow drew ${spawned} enemies.`);
  }

  if (state.enemies.length > state.wave * 3) {
    state.wave += 1;
    addLog(`Wave ${state.wave} reached.`);
  }

  renderStats();
}

function spendGold(cost) {
  if (state.gold < cost) return false;
  state.gold -= cost;
  return true;
}

function renderStats() {
  ui.energy.textContent = state.energy;
  ui.gold.textContent = state.gold;
  ui.baseHp.textContent = state.baseHp;
  ui.wave.textContent = state.wave;
  ui.enemyCount.textContent = state.enemies.length;
  ui.arrowCount.textContent = state.towers.arrow;
  ui.mageCount.textContent = state.towers.mage;
  ui.autoClickLevel.textContent = state.autoClickLevel;
  ui.arrowDps.textContent = state.towers.arrow * 2;
  ui.mageDps.textContent = state.towers.mage * 4;
  ui.autoEnergy.textContent = state.autoClickLevel;
}

function wireButtons() {
  document.getElementById("clickBtn").addEventListener("click", () => {
    state.energy += 1;
    renderStats();
  });

  document.getElementById("buyArrow").addEventListener("click", () => {
    if (!spendGold(25)) return;
    state.towers.arrow += 1;
    addLog("Built Arrow Tower (+2 DPS)");
    renderStats();
  });

  document.getElementById("buyMage").addEventListener("click", () => {
    if (!spendGold(60)) return;
    state.towers.mage += 1;
    addLog("Built Mage Tower (+4 DPS)");
    renderStats();
  });

  document.getElementById("buyAutoClick").addEventListener("click", () => {
    if (!spendGold(40)) return;
    state.autoClickLevel += 1;
    addLog("Upgraded Auto-Click (+1 Energy/s)");
    renderStats();
  });
}

function start() {
  initBoard();
  wireButtons();
  renderStats();
  addLog("Game started. Match crystals to power your defenses.");
  setInterval(runEconomyTick, 1000);
  setInterval(runCombatTick, 1000);
}

start();
