const socket = io();

// ─── State ────────────────────────────────────────────────────────────────────
let currentRoom = null;
let currentPlayer = null;
let players = [];
let selectedPlayers = [];
let appliedConfig = null;

const configSettings = {
  seats: 6,
  characters: {
    'Servant': 4, 'Merlin': 0, 'Percival': 0, 'Cleric': 0,
    'Minion': 1, 'Morgana': 1, 'Assassin': 0, 'Mordred': 0, 'Oberon': 0, 'Blind Hunter': 0
  }
};

// ─── Character Definitions (for config UI) ────────────────────────────────────
const AVAILABLE_CHARACTERS = [
  { name: 'Servant',      team: 'good', desc: 'Must play Success · no special knowledge' },
  { name: 'Merlin',       team: 'good', desc: 'Sees all evil except Mordred · Assassin wins if they identify you' },
  { name: 'Percival',     team: 'good', desc: 'Sees Merlin & Morgana as a pair (can\'t tell which is which)' },
  { name: 'Cleric',       team: 'good', desc: 'Sees one random evil player · Blind Hunter must identify you' },
  { name: 'Minion',       team: 'evil', desc: 'Can play Fail · knows Morgana, Assassin, Mordred' },
  { name: 'Morgana',      team: 'evil', desc: 'Can play Fail · ignores Magic Token · appears as Merlin to Percival · knows other evil' },
  { name: 'Assassin',     team: 'evil', desc: 'Can play Fail · if Good wins 3 quests, picks who is Merlin to steal victory · knows other evil' },
  { name: 'Mordred',      team: 'evil', desc: 'Can play Fail · hidden from Merlin · knows other evil' },
  { name: 'Oberon',       team: 'evil', desc: 'Can play Fail · completely isolated — doesn\'t know evil, evil don\'t know them' },
  { name: 'Blind Hunter', team: 'evil', desc: 'Can play Fail · isolated · if Evil wins 3 quests, must identify 2 Good players by role' },
];

const ROLE_DESCRIPTIONS = {
  'Servant':      'You serve Arthur. You must play Success cards on quests.',
  'Merlin':       'You serve Arthur. You know who is evil (except Mordred). Stay hidden — if the Assassin identifies you after Good wins, Evil wins!',
  'Percival':     'You serve Arthur. You see two players: one is Merlin, one is Morgana — but you don\'t know which is which.',
  'Cleric':       'You serve Arthur. You must play Success. You know one evil player by name.',
  'Minion':       'You serve Mordred. You can play Fail cards.',
  'Morgana':      'You serve Mordred. You can play Fail. You ignore the Magic Token. You appear as Merlin to Percival.',
  'Assassin':     'You serve Mordred. You can play Fail. If Good wins 3 quests, you get one chance to identify Merlin and steal the victory.',
  'Mordred':      'You serve Mordred. You can play Fail. You are hidden from Merlin — they cannot see you.',
  'Oberon':       'You serve Mordred. You can play Fail. You work completely alone — other evil don\'t know you, and you don\'t know them.',
  'Blind Hunter': 'You serve Mordred. You can play Fail. You work alone. If Evil wins 3 quests, you must identify two Good players by their exact role to win.',
};

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const menuScreen         = document.getElementById('menu-screen');
const lobbyScreen        = document.getElementById('lobby-screen');
const gameScreen         = document.getElementById('game-screen');
const createRoomBtn      = document.getElementById('create-room-btn');
const joinRoomBtn        = document.getElementById('join-room-btn');
const createForm         = document.getElementById('create-form');
const joinForm           = document.getElementById('join-form');
const createConfirmBtn   = document.getElementById('create-confirm');
const joinConfirmBtn     = document.getElementById('join-confirm');
const playerNameCreate   = document.getElementById('player-name-create');
const playerNameJoin     = document.getElementById('player-name-join');
const roomCodeInput      = document.getElementById('room-code');
const roomCodeDisplay    = document.getElementById('room-code-display');
const playersUl          = document.getElementById('players-ul');
const playerCountEl      = document.getElementById('player-count');
const seatsNeededEl      = document.getElementById('seats-needed');
const startGameBtn       = document.getElementById('start-game-btn');
const waitingMessage     = document.getElementById('waiting-message');
const hostConfig         = document.getElementById('host-config');
const seatsValueEl       = document.getElementById('seats-value');
const configSummaryEl    = document.getElementById('config-summary');
const applyConfigBtn     = document.getElementById('apply-config-btn');
const configInfoEl       = document.getElementById('config-info');
const roleDisplay        = document.getElementById('role-display');
const roleDescription    = document.getElementById('role-description');
const questNumber        = document.getElementById('quest-number');
const teamSize           = document.getElementById('team-size');
const currentLeader      = document.getElementById('current-leader');
const goodScore          = document.getElementById('good-score');
const evilScore          = document.getElementById('evil-score');
const teamSelectionPhase = document.getElementById('team-selection-phase');
const questPhase         = document.getElementById('quest-phase');
const assassinationPhase = document.getElementById('assassination-phase');
const blindHunterPhase   = document.getElementById('blind-hunter-phase');
const finalQuestPhase    = document.getElementById('final-quest-phase');
const gameOverPhase      = document.getElementById('game-over-phase');
const leaderActions      = document.getElementById('leader-actions');
const waitingForLeader   = document.getElementById('waiting-for-leader');
const playerSelection    = document.getElementById('player-selection');
const confirmTeamBtn     = document.getElementById('confirm-team');
const questActions       = document.getElementById('quest-actions');
const leaderQuestActions = document.getElementById('leader-quest-actions');
const successBtn         = document.getElementById('success-btn');
const failBtn            = document.getElementById('fail-btn');
const cardsPlayed        = document.getElementById('cards-played');
const cardsTotal         = document.getElementById('cards-total');
const messagesList       = document.getElementById('messages-list');

// ─── Menu ─────────────────────────────────────────────────────────────────────
createRoomBtn.addEventListener('click', () => { hideAllForms(); createForm.classList.remove('hidden'); });
joinRoomBtn.addEventListener('click',   () => { hideAllForms(); joinForm.classList.remove('hidden'); });

createConfirmBtn.addEventListener('click', () => {
  const name = playerNameCreate.value.trim();
  if (name) { socket.emit('create-room', name); currentPlayer = name; }
});

joinConfirmBtn.addEventListener('click', () => {
  const name = playerNameJoin.value.trim();
  const code = roomCodeInput.value.trim().toUpperCase();
  if (name && code) { socket.emit('join-room', code, name); currentPlayer = name; }
});

// ─── Lobby ────────────────────────────────────────────────────────────────────
startGameBtn.addEventListener('click', () => socket.emit('start-game', currentRoom));

document.getElementById('seats-minus').addEventListener('click', () => {
  if (configSettings.seats > 4) { configSettings.seats--; seatsValueEl.textContent = configSettings.seats; refreshConfigUI(); }
});
document.getElementById('seats-plus').addEventListener('click', () => {
  if (configSettings.seats < 10) { configSettings.seats++; seatsValueEl.textContent = configSettings.seats; refreshConfigUI(); }
});

applyConfigBtn.addEventListener('click', () => {
  socket.emit('configure-room', currentRoom, { seats: configSettings.seats, characters: { ...configSettings.characters } });
});

// ─── Game ─────────────────────────────────────────────────────────────────────
confirmTeamBtn.addEventListener('click', () => socket.emit('select-team', currentRoom, selectedPlayers));
successBtn.addEventListener('click', () => { socket.emit('play-quest-card', currentRoom, 'success'); hideQuestActions(); });
failBtn.addEventListener('click',    () => { socket.emit('play-quest-card', currentRoom, 'fail');    hideQuestActions(); });
document.getElementById('skip-magic-token').addEventListener('click', () => leaderQuestActions.classList.add('hidden'));

document.getElementById('submit-guess').addEventListener('click', () => {
  const selected = Array.from(document.querySelectorAll('#final-quest-players .player-option.selected'))
    .map(el => el.dataset.playerId);
  socket.emit('final-quest-guess', currentRoom, selected);
});

document.getElementById('new-game-btn').addEventListener('click', () => location.reload());

// ─── Socket Events ────────────────────────────────────────────────────────────
socket.on('room-created', (roomCode) => {
  currentRoom = roomCode;
  showLobby();
  roomCodeDisplay.textContent = roomCode;
  startGameBtn.classList.remove('hidden');
  waitingMessage.classList.add('hidden');
  hostConfig.classList.remove('hidden');
  buildCharacterConfig();
  addMessage(`Room ${roomCode} created!`, 'success');
});

socket.on('room-joined', (roomCode) => {
  currentRoom = roomCode;
  showLobby();
  roomCodeDisplay.textContent = roomCode;
  startGameBtn.classList.add('hidden');
  waitingMessage.classList.remove('hidden');
  addMessage(`Joined room ${roomCode}!`, 'success');
});

socket.on('players-updated', (updated) => {
  players = updated;
  updatePlayersDisplay();
  updateStartButtonState();
});

socket.on('config-updated', (config) => {
  appliedConfig = config;
  const parts = Object.entries(config.characters).filter(([, n]) => n > 0).map(([c, n]) => `${n}× ${c}`);
  configInfoEl.textContent = `${config.seats} seats · ${parts.join(', ')} · Good: ${config.goodCount} · Evil: ${config.evilCount}`;
  seatsNeededEl.textContent = ` / ${config.seats}`;
  updateStartButtonState();
  addMessage(`Game configured: ${config.seats} seats`, 'info');
});

socket.on('role-assigned', (role) => {
  showGame();
  roleDisplay.textContent = `${role.character} (${role.team})`;
  roleDisplay.className = `role-${role.team}`;

  let desc = ROLE_DESCRIPTIONS[role.character] || (role.team === 'good' ? 'Play Success cards.' : 'You serve Mordred.');

  // Merlin sees evil players
  if (role.evilPlayers && role.evilPlayers.length > 0) {
    desc += ` Evil players: ${role.evilPlayers.map(p => p.name).join(', ')}.`;
  }
  // Percival sees the Merlin/Morgana pair
  if (role.merlinPair && role.merlinPair.length > 0) {
    desc += ` One of these is Merlin: ${role.merlinPair.map(p => p.name).join(', ')}.`;
  }
  // Cleric sees one evil player
  if (role.clericReveal) {
    desc += ` One evil player is: ${role.clericReveal.name}.`;
  }
  // Evil allies
  if (role.allies && role.allies.length > 0) {
    desc += ` Your evil allies: ${role.allies.map(a => `${a.name} (${a.character})`).join(', ')}.`;
  } else if (role.team === 'evil') {
    desc += ' You have no known allies.';
  }

  roleDescription.textContent = desc;
});

socket.on('game-started', (data) => {
  questNumber.textContent = data.questNumber + 1;
  teamSize.textContent = data.teamSize;
  currentLeader.textContent = getPlayerName(data.currentLeader);
  showPhase('team-selection');
  if (socket.id === data.currentLeader) showLeaderActions(data.teamSize); else hideLeaderActions();
  addMessage('Game started!', 'success');
});

socket.on('team-selected', (data) => {
  showPhase('quest');
  document.getElementById('team-members').textContent = data.teamNames.join(', ');
  cardsTotal.textContent = data.team.length;
  cardsPlayed.textContent = '0';
  if (data.team.includes(socket.id)) showQuestActions(); else hideQuestActions();
  addMessage(`Team selected: ${data.teamNames.join(', ')}`, 'info');
});

socket.on('card-played', (data) => {
  cardsPlayed.textContent = data.cardsPlayed;
  addMessage(`${data.cardsPlayed}/${data.totalNeeded} cards played`, 'info');
});

// Final quest-result (not the last one)
socket.on('quest-result', (data) => {
  goodScore.textContent = data.goodWins;
  evilScore.textContent = data.evilWins;
  addMessage(`Quest ${data.succeeded ? 'succeeded' : 'failed'}! ${data.failCount} fail card(s).`, data.succeeded ? 'success' : 'error');
  setTimeout(() => {
    questNumber.textContent = data.questNumber + 1;
    teamSize.textContent = data.teamSize;
    currentLeader.textContent = getPlayerName(data.nextLeader);
    showPhase('team-selection');
    if (socket.id === data.nextLeader) showLeaderActions(data.teamSize); else hideLeaderActions();
  }, 3000);
});

// Last quest result (leads into endgame phase)
socket.on('quest-result-final', (data) => {
  goodScore.textContent = data.goodWins;
  evilScore.textContent = data.evilWins;
  addMessage(`Quest ${data.succeeded ? 'succeeded' : 'failed'}! ${data.failCount} fail card(s).`, data.succeeded ? 'success' : 'error');
});

socket.on('magic-token-used', (data) => {
  addMessage(`Magic token used on ${data.target}!`, 'warning');
  cardsPlayed.textContent = data.cardsPlayed;
});

socket.on('magic-token-ignored', (name) => addMessage(`${name} (Morgana) ignored the magic token!`, 'warning'));

// ─── Assassination Phase ───────────────────────────────────────────────────────
socket.on('assassination-phase', (data) => {
  showPhase('assassination');
  addMessage('Assassination phase! The Assassin seeks Merlin...', 'warning');

  if (socket.id === data.assassinId) {
    document.getElementById('assassin-actions').classList.remove('hidden');
    document.getElementById('waiting-for-assassin').classList.add('hidden');

    const container = document.getElementById('assassination-targets');
    container.innerHTML = '';
    players.forEach(p => {
      if (p.id === socket.id) return;
      const opt = document.createElement('div');
      opt.className = 'player-option';
      opt.textContent = p.name;
      opt.addEventListener('click', () => {
        if (confirm(`Are you sure ${p.name} is Merlin?`)) {
          socket.emit('assassinate', currentRoom, p.id);
        }
      });
      container.appendChild(opt);
    });
  }
});

// ─── Blind Hunter Phase ───────────────────────────────────────────────────────
socket.on('blind-hunter-phase', (data) => {
  showPhase('blind-hunter');
  addMessage('The Hunt! The Blind Hunter must identify two Good roles...', 'warning');

  if (socket.id === data.blindHunterId) {
    document.getElementById('blind-hunter-actions').classList.remove('hidden');
    document.getElementById('waiting-for-hunter').classList.add('hidden');
    buildHuntSlots(data.goodRolesInPlay);
  }
});

function buildHuntSlots(goodRoles) {
  const container = document.getElementById('hunt-slots');
  container.innerHTML = '';
  const guesses = [{ playerId: null, roleName: null }, { playerId: null, roleName: null }];

  for (let i = 0; i < 2; i++) {
    const slot = document.createElement('div');
    slot.className = 'hunt-slot';

    const playerSel = document.createElement('select');
    playerSel.className = 'hunt-select';
    playerSel.innerHTML = '<option value="">— player —</option>';
    players.forEach(p => {
      if (p.id === socket.id) return;
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      playerSel.appendChild(opt);
    });

    const roleSel = document.createElement('select');
    roleSel.className = 'hunt-select';
    roleSel.innerHTML = '<option value="">— role —</option>';
    goodRoles.forEach(role => {
      const opt = document.createElement('option');
      opt.value = role; opt.textContent = role;
      roleSel.appendChild(opt);
    });

    playerSel.addEventListener('change', () => { guesses[i].playerId = playerSel.value || null; });
    roleSel.addEventListener('change',   () => { guesses[i].roleName = roleSel.value || null; });

    const label = document.createElement('span');
    label.className = 'hunt-label';
    label.textContent = `Guess ${i + 1}: `;

    slot.appendChild(label);
    slot.appendChild(playerSel);
    const is = document.createElement('span');
    is.textContent = ' is '; is.className = 'hunt-is';
    slot.appendChild(is);
    slot.appendChild(roleSel);
    container.appendChild(slot);
  }

  document.getElementById('submit-hunt').onclick = () => {
    if (guesses.every(g => g.playerId && g.roleName)) {
      socket.emit('blind-hunter-guess', currentRoom, guesses);
    } else {
      addMessage('Select a player and role for both guesses.', 'error');
    }
  };
}

// ─── Final Quest Phase ────────────────────────────────────────────────────────
socket.on('final-quest-phase', () => {
  showPhase('final-quest');
  addMessage('Final Quest! Good must identify all evil players!', 'warning');

  const me = players.find(p => p.id === socket.id);
  if (me && me.role && me.role.team === 'good') {
    document.getElementById('evil-guess-section').classList.remove('hidden');
    document.getElementById('waiting-for-guess').classList.add('hidden');

    const container = document.getElementById('final-quest-players');
    container.innerHTML = '';
    players.forEach(p => {
      if (p.id === socket.id) return;
      const opt = document.createElement('div');
      opt.className = 'player-option';
      opt.textContent = p.name;
      opt.dataset.playerId = p.id;
      opt.addEventListener('click', () => opt.classList.toggle('selected'));
      container.appendChild(opt);
    });
  }
});

socket.on('game-over', (data) => {
  showPhase('game-over');
  document.getElementById('winner-display').innerHTML =
    `<h3>${data.winner.toUpperCase()} WINS!</h3><p>${data.reason}</p>`;
  addMessage(`Game Over: ${data.winner} wins — ${data.reason}`, 'success');
});

socket.on('error', (msg) => addMessage(msg, 'error'));

// ─── Config UI ────────────────────────────────────────────────────────────────
function buildCharacterConfig() {
  const container = document.getElementById('character-rows');
  container.innerHTML = '';

  // Group header
  ['good', 'evil'].forEach(team => {
    const header = document.createElement('div');
    header.className = `char-team-header char-team-${team}`;
    header.textContent = team === 'good' ? '⚔ Good' : '💀 Evil';
    container.appendChild(header);

    AVAILABLE_CHARACTERS.filter(c => c.team === team).forEach(char => {
      const idSafe = char.name.replace(/\s+/g, '-');
      const row = document.createElement('div');
      row.className = 'character-row';
      row.innerHTML = `
        <div class="char-info">
          <span class="char-name char-${char.team}">${char.name}</span>
          <span class="char-desc">${char.desc}</span>
        </div>
        <div class="counter-control">
          <button class="counter-btn" data-char="${char.name}" data-action="minus">−</button>
          <span id="count-${idSafe}" class="char-count">${configSettings.characters[char.name] || 0}</span>
          <button class="counter-btn" data-char="${char.name}" data-action="plus">+</button>
        </div>`;
      container.appendChild(row);
    });
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.counter-btn');
    if (!btn) return;
    const { char, action } = btn.dataset;
    if (action === 'plus') {
      configSettings.characters[char] = (configSettings.characters[char] || 0) + 1;
    } else {
      configSettings.characters[char] = Math.max(0, (configSettings.characters[char] || 0) - 1);
    }
    refreshConfigUI();
  });

  refreshConfigUI();
}

function refreshConfigUI() {
  AVAILABLE_CHARACTERS.forEach(c => {
    const idSafe = c.name.replace(/\s+/g, '-');
    const el = document.getElementById(`count-${idSafe}`);
    if (el) el.textContent = configSettings.characters[c.name] || 0;
  });

  const total = Object.values(configSettings.characters).reduce((a, b) => a + b, 0);
  const goodCount = AVAILABLE_CHARACTERS.filter(c => c.team === 'good')
    .reduce((s, c) => s + (configSettings.characters[c.name] || 0), 0);
  const evilCount = total - goodCount;
  const valid = total === configSettings.seats && goodCount >= 1 && evilCount >= 1;

  configSummaryEl.textContent = `Total: ${total}/${configSettings.seats} · Good: ${goodCount} · Evil: ${evilCount}`;
  configSummaryEl.className = `config-summary ${valid ? 'valid' : 'invalid'}`;
  applyConfigBtn.disabled = !valid;
}

function updateStartButtonState() {
  if (startGameBtn.classList.contains('hidden')) return;
  if (appliedConfig) {
    const have = players.length, need = appliedConfig.seats;
    startGameBtn.disabled = have !== need;
    startGameBtn.textContent = have !== need ? `Start Game (${have}/${need} players)` : 'Start Game';
  } else {
    startGameBtn.disabled = players.length < 4;
    startGameBtn.textContent = players.length < 4 ? `Start Game (need ${4 - players.length} more)` : 'Start Game';
  }
}

// ─── Phase / Screen Helpers ───────────────────────────────────────────────────
const PHASES = {
  'team-selection': teamSelectionPhase,
  'quest':          questPhase,
  'assassination':  assassinationPhase,
  'blind-hunter':   blindHunterPhase,
  'final-quest':    finalQuestPhase,
  'game-over':      gameOverPhase,
};

function showPhase(name) {
  Object.values(PHASES).forEach(el => el.classList.add('hidden'));
  if (PHASES[name]) PHASES[name].classList.remove('hidden');
}

function hideAllForms() { createForm.classList.add('hidden'); joinForm.classList.add('hidden'); }
function showLobby() { menuScreen.classList.remove('active'); lobbyScreen.classList.add('active'); gameScreen.classList.remove('active'); }
function showGame()  { menuScreen.classList.remove('active'); lobbyScreen.classList.remove('active'); gameScreen.classList.add('active'); }

function updatePlayersDisplay() {
  playersUl.innerHTML = '';
  playerCountEl.textContent = players.length;
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name + (p.isCreator ? ' (Host)' : '');
    playersUl.appendChild(li);
  });
}

function showLeaderActions(required) {
  leaderActions.classList.remove('hidden');
  waitingForLeader.classList.add('hidden');
  playerSelection.innerHTML = '';
  selectedPlayers = [];
  players.forEach(p => {
    const opt = document.createElement('div');
    opt.className = 'player-option';
    opt.textContent = p.name;
    opt.dataset.playerId = p.id;
    opt.addEventListener('click', () => togglePlayerSelection(opt, p.id, required));
    playerSelection.appendChild(opt);
  });
  updateConfirmButton();
}

function hideLeaderActions() { leaderActions.classList.add('hidden'); waitingForLeader.classList.remove('hidden'); }

function togglePlayerSelection(el, id, required) {
  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
    selectedPlayers = selectedPlayers.filter(x => x !== id);
  } else if (selectedPlayers.length < required) {
    el.classList.add('selected');
    selectedPlayers.push(id);
  }
  updateConfirmButton();
}

function updateConfirmButton() {
  confirmTeamBtn.classList.toggle('hidden', selectedPlayers.length !== parseInt(teamSize.textContent));
}

function showQuestActions() { questActions.classList.remove('hidden'); }
function hideQuestActions() { questActions.classList.add('hidden'); }

function getPlayerName(id) {
  const p = players.find(x => x.id === id);
  return p ? p.name : 'Unknown';
}

function addMessage(msg, type = 'info') {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()}: ${msg}`;
  li.className = `message-${type}`;
  messagesList.appendChild(li);
  messagesList.scrollTop = messagesList.scrollHeight;
}
