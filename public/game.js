const socket = io();

// ─── State ────────────────────────────────────────────────────────────────────
let currentRoom = null;
let currentPlayer = null;
let currentLeaderId = null;
let players = [];
let selectedPlayers = [];
let appliedConfig = null;

// ─── Character Definitions ────────────────────────────────────────────────────
const AVAILABLE_CHARACTERS = [
  // Base Good
  { name: 'Loyal Servant', team: 'good', category: 'base',     desc: 'No special ability · must play Success' },
  { name: 'Duke',          team: 'good', category: 'base',     desc: 'During Good\'s Last Chance, may drop one hand after Evil is revealed' },
  { name: 'Archduke',      team: 'good', category: 'base',     desc: 'During Good\'s Last Chance, may switch one player\'s hand after Evil is revealed' },
  // Base Evil
  { name: 'Minion',        team: 'evil', category: 'base',     desc: 'Can Fail · knows other evil (Minion, Morgan, Brute, Lunatic, Trickster, Revealer, Braggart, Saboteur)' },
  { name: 'Morgan le Fay', team: 'evil', category: 'base',     desc: 'Not affected by Magic Token · knows other evil + knows who Scion is' },
  { name: 'Scion',         team: 'evil', category: 'base',     desc: 'Can Fail · known to Morgan le Fay only · does not know other evil' },
  { name: 'Changeling',    team: 'evil', category: 'base',     desc: 'Can Fail · unknown to all evil · does not know other evil' },
  // Optional Good
  { name: 'Cleric',        team: 'good', category: 'optional', desc: 'Secretly sees whether the first Leader is Good or Evil' },
  { name: 'Youth',         team: 'good', category: 'optional', desc: 'Magic Token reverses: forces Fail instead of Success' },
  { name: 'Troublemaker',  team: 'good', category: 'optional', desc: 'Must lie about loyalty when identity is checked' },
  { name: 'Apprentice',    team: 'good', category: 'optional', desc: 'During Good\'s Last Chance, raises one hand (and optionally a second after Evil revealed)' },
  { name: 'Arthur',        team: 'good', category: 'optional', desc: 'Knows Morgan le Fay · must remain hidden from the Blind Hunter\'s first guess' },
  // Optional Evil
  { name: 'Blind Hunter',  team: 'evil', category: 'optional', desc: 'Isolated from evil · activates The Hunt when Evil wins 3 quests: identify 2 Good roles to win' },
  { name: 'Brute',         team: 'evil', category: 'optional', desc: 'Can Fail quests 1–3 only · forced Success on quests 4–5' },
  { name: 'Lunatic',       team: 'evil', category: 'optional', desc: 'Must Fail EVERY quest — no choice' },
  { name: 'Mutineer',      team: 'evil', category: 'optional', desc: 'Isolated from evil · switches to Good if he points at two Good players during Good\'s Last Chance' },
  { name: 'Trickster',     team: 'evil', category: 'optional', desc: 'Can Fail · must lie about loyalty when identity is checked' },
  { name: 'Revealer',      team: 'evil', category: 'optional', desc: 'Can Fail · automatically revealed as Evil after 3rd failed quest' },
  // Promo
  { name: 'Braggart',         team: 'evil',     category: 'promo', desc: 'Can Fail · automatically revealed as Evil if leader of 5th quest' },
  { name: 'Galahad',          team: 'good',     category: 'promo', desc: 'May reveal self after 2nd failed quest to become next leader · only if holding no Veteran nor Amulet tokens' },
  { name: 'Reluctant Leader', team: 'good',     category: 'promo', desc: 'If leader during Quest 2 or 3 and on the team, must play Fail' },
  { name: 'Saboteur',         team: 'evil',     category: 'promo', desc: 'Can Fail · once a Veteran (been on any previous quest), must always Fail' },
  { name: 'Outsider',         team: 'evil',     category: 'promo', desc: 'Can Fail · not known by other evil · knows who the evil players are' },
  { name: 'Percival',         team: 'good',     category: 'promo', desc: 'Knows who the Cleric is' },
  { name: 'Sentinel',         team: 'good',     category: 'promo', desc: 'When the first Amulet is used, checks the exact same target person\'s loyalty' },
  { name: 'Lancelot',         team: 'variable', category: 'promo', desc: 'Add in pairs: one becomes Good, one becomes Evil · Lancelots know each other · neither knows other evil' },
];

const ROLE_DESCRIPTIONS = {
  'Loyal Servant':  'You serve Arthur. You must play Success cards on all quests.',
  'Duke':           'You serve Arthur. You must play Success. During Good\'s Last Chance, you may drop one hand after Evil is revealed.',
  'Archduke':       'You serve Arthur. You must play Success. During Good\'s Last Chance, you may switch one player\'s hand after Evil is revealed.',
  'Minion':         'You serve Mordred. You can play Fail cards.',
  'Morgan le Fay':  'You serve Mordred. You can play Fail. You are NOT affected by the Magic Token.',
  'Scion':          'You serve Mordred. You can play Fail. You do not know other evil players — but Morgan le Fay knows who you are.',
  'Changeling':     'You serve Mordred. You can play Fail. Neither you nor other evil players know each other.',
  'Cleric':         'You serve Arthur. You must play Success. At game start you secretly learn whether the first Leader is Good or Evil.',
  'Youth':          'You serve Arthur. You must play Success — UNLESS the Magic Token is used on you, in which case you are forced to play Fail!',
  'Troublemaker':   'You serve Arthur. You must play Success. You MUST lie about your loyalty when your identity is checked.',
  'Apprentice':     'You serve Arthur. You must play Success. During Good\'s Last Chance, you may raise one hand, and a second after Evil is revealed.',
  'Arthur':         'You serve Arthur. You must play Success. You know who Morgan le Fay is — but you must remain hidden from the Blind Hunter\'s first guess.',
  'Blind Hunter':   'You serve Mordred. You can play Fail. You do not know other evil. When Evil wins 3 quests, you activate The Hunt: identify two Good players by role to win.',
  'Brute':          'You serve Mordred. You can play Fail, but ONLY on the first three quests. On quests 4 and 5, you must play Success.',
  'Lunatic':        'You serve Mordred. You MUST play Fail on EVERY quest — you have no choice.',
  'Mutineer':       'You serve Mordred (for now). You do not know other evil. During Good\'s Last Chance, if you point at two Good players, you switch to the Good team.',
  'Trickster':      'You serve Mordred. You can play Fail. You MUST lie about your loyalty when your identity is checked.',
  'Revealer':       'You serve Mordred. You can play Fail. After the third quest fails, your loyalty is automatically revealed to all players.',
  'Braggart':       'You serve Mordred. You can play Fail. If you become Leader of the fifth quest, your loyalty is automatically revealed to all players.',
  'Galahad':        'You serve Arthur. You must play Success. After the second failed quest, you may reveal yourself to become the next Leader — but only if you hold no Veteran nor Amulet tokens.',
  'Reluctant Leader':'You serve Arthur — reluctantly. If you are the Leader during Quest 2 or 3 AND you are on the quest team, you MUST play Fail.',
  'Saboteur':       'You serve Mordred. You can play Fail. Once you have been on any previous quest (Veteran), you MUST Fail on all future quests.',
  'Outsider':       'You serve Mordred. You can play Fail. Other evil players do NOT know you — but you know who all the evil players are.',
  'Percival':       'You serve Arthur. You must play Success. You know who the Cleric is.',
  'Sentinel':       'You serve Arthur. You must play Success. When the first Amulet is used, you learn the loyalty of the exact same target person.',
  'Lancelot':       'You are Lancelot. You know the other Lancelot. Neither of you knows who else is Evil.',
};

// ─── Config State ─────────────────────────────────────────────────────────────
const configSettings = { seats: 6, characters: {} };
AVAILABLE_CHARACTERS.forEach(c => { configSettings.characters[c.name] = 0; });
configSettings.characters['Loyal Servant'] = 4;
configSettings.characters['Minion'] = 1;
configSettings.characters['Morgan le Fay'] = 1;

// ─── DOM ──────────────────────────────────────────────────────────────────────
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
const questTracker       = document.getElementById('quest-tracker');
const currentLeader      = document.getElementById('current-leader');

// Quest tracker state
let questSizes = [];
let questResults = [];       // {succeeded, failCount} per completed quest
let currentQuestIndex = 0;
let currentTeamSize = 0;
const teamSelectionPhase = document.getElementById('team-selection-phase');
const questPhase         = document.getElementById('quest-phase');
const blindHunterPhase   = document.getElementById('blind-hunter-phase');
const finalQuestPhase    = document.getElementById('final-quest-phase');
const gameOverPhase      = document.getElementById('game-over-phase');
const leaderActions      = document.getElementById('leader-actions');
const waitingForLeader   = document.getElementById('waiting-for-leader');
const playerSelection    = document.getElementById('player-selection');
const confirmTeamBtn     = document.getElementById('confirm-team');
const questActions       = document.getElementById('quest-actions');
const leaderQuestActions = document.getElementById('leader-quest-actions');
const cardsPlayed        = document.getElementById('cards-played');
const cardsTotal         = document.getElementById('cards-total');
const messagesList       = document.getElementById('messages-list');

// ─── Menu Events ──────────────────────────────────────────────────────────────
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

// ─── Lobby Events ─────────────────────────────────────────────────────────────
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

// ─── Game Events ──────────────────────────────────────────────────────────────
confirmTeamBtn.addEventListener('click', () => socket.emit('select-team', currentRoom, selectedPlayers));
document.getElementById('success-btn').addEventListener('click', () => { socket.emit('play-quest-card', currentRoom, 'success'); hideQuestActions(); });
document.getElementById('fail-btn').addEventListener('click',    () => { socket.emit('play-quest-card', currentRoom, 'fail');    hideQuestActions(); });
document.getElementById('skip-magic-token').addEventListener('click', () => leaderQuestActions.classList.add('hidden'));
document.getElementById('submit-guess').addEventListener('click', () => {
  const selected = Array.from(document.querySelectorAll('#final-quest-players .player-option.selected')).map(el => el.dataset.playerId);
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

  const desc = ROLE_DESCRIPTIONS[role.character] || (role.team === 'good' ? 'Play Success.' : 'You serve Mordred.');

  const visionLines = [];
  if (role.allies && role.allies.length > 0) {
    visionLines.push(`🔴 Evil allies: ${role.allies.map(a => `<strong>${a.name}</strong> (${a.character})`).join(', ')}`);
  } else if (role.team === 'evil') {
    visionLines.push('🔴 You have no known allies.');
  }
  if (role.scionInfo)    visionLines.push(`🔍 The Scion is: <strong>${role.scionInfo.name}</strong>`);
  if (role.morganInfo)   visionLines.push(`🔍 Morgan le Fay is: <strong>${role.morganInfo.name}</strong>`);
  if (role.clericInfo)   visionLines.push(`🔍 The Cleric is: <strong>${role.clericInfo.name}</strong>`);
  if (role.leaderInfo)   visionLines.push(`🔍 First Leader: <strong>${role.leaderInfo.name}</strong> is <strong>${role.leaderInfo.team.toUpperCase()}</strong>`);
  if (role.lancelotAllies && role.lancelotAllies.length > 0) {
    visionLines.push(`🔍 The other Lancelot: ${role.lancelotAllies.map(a => `<strong>${a.name}</strong> (${a.team})`).join(', ')}`);
  }

  const visionHtml = visionLines.length > 0
    ? `<div class="role-vision"><div class="role-vision-title">What you know:</div>${visionLines.map(l => `<div class="role-vision-line">${l}</div>`).join('')}</div>`
    : '';

  document.getElementById('role-description').innerHTML = `<span class="role-desc-text">${desc}</span>${visionHtml}`;
});

socket.on('game-started', (data) => {
  currentLeaderId = data.currentLeader;
  currentQuestIndex = data.questNumber;
  currentTeamSize = data.teamSize;
  questSizes = data.questSizes;
  questResults = [];
  buildQuestTracker();
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

  // Show magic token UI for the leader
  if (socket.id === currentLeaderId) {
    showMagicTokenTargets(data.team, data.teamNames);
  } else {
    leaderQuestActions.classList.add('hidden');
  }

  addMessage(`Team selected: ${data.teamNames.join(', ')}`, 'info');
});

socket.on('card-played', (data) => {
  cardsPlayed.textContent = data.cardsPlayed;
  addMessage(`${data.cardsPlayed}/${data.totalNeeded} cards played`, 'info');
});

socket.on('quest-result', (data) => {
  questResults.push({ succeeded: data.succeeded, failCount: data.failCount });
  updateQuestTracker(currentQuestIndex, data.succeeded, data.failCount);
  addMessage(`Quest ${data.succeeded ? 'succeeded' : 'failed'}! ${data.failCount} fail card(s).`, data.succeeded ? 'success' : 'error');
  setTimeout(() => {
    currentLeaderId = data.nextLeader;
    currentQuestIndex = data.questNumber;
    currentTeamSize = data.teamSize;
    highlightCurrentQuest();
    currentLeader.textContent = getPlayerName(data.nextLeader);
    showPhase('team-selection');
    if (socket.id === data.nextLeader) showLeaderActions(data.teamSize); else hideLeaderActions();
  }, 3000);
});

socket.on('quest-result-final', (data) => {
  questResults.push({ succeeded: data.succeeded, failCount: data.failCount });
  updateQuestTracker(currentQuestIndex, data.succeeded, data.failCount);
  addMessage(`Quest ${data.succeeded ? 'succeeded' : 'failed'}! ${data.failCount} fail card(s).`, data.succeeded ? 'success' : 'error');
});

socket.on('players-revealed', (revealed) => {
  revealed.forEach(r => {
    addMessage(`⚠️ ${r.name} (${r.character}) has been revealed as ${r.team.toUpperCase()}!`, 'warning');
  });
});

socket.on('magic-token-used', (data) => {
  if (data.tokenCard === 'fail') {
    addMessage(`Magic Token used on ${data.target} — REVERSED! They must play Fail! (Youth)`, 'warning');
  } else {
    addMessage(`Magic Token used on ${data.target}! They must play Success.`, 'warning');
  }
  cardsPlayed.textContent = data.cardsPlayed;
  // Hide magic token UI (token is consumed)
  leaderQuestActions.classList.add('hidden');
  // Hide quest buttons for the target (their card is forced)
  if (data.targetId === socket.id) hideQuestActions();
});

socket.on('magic-token-ignored', (name) => addMessage(`${name} (Morgan le Fay) ignored the Magic Token!`, 'warning'));

socket.on('blind-hunter-phase', (data) => {
  showPhase('blind-hunter');
  addMessage('The Hunt! The Blind Hunter must identify two Good players by role...', 'warning');
  if (socket.id === data.blindHunterId) {
    document.getElementById('blind-hunter-actions').classList.remove('hidden');
    document.getElementById('waiting-for-hunter').classList.add('hidden');
    buildHuntSlots(data.goodRolesInPlay);
  }
});

socket.on('final-quest-phase', () => {
  showPhase('final-quest');
  addMessage("Good's Last Chance! Identify all Evil players!", 'warning');
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
  document.getElementById('winner-display').innerHTML = `<h3>${data.winner.toUpperCase()} WINS!</h3><p>${data.reason}</p>`;
  addMessage(`Game Over: ${data.winner} wins — ${data.reason}`, 'success');
});

socket.on('error', (msg) => addMessage(msg, 'error'));

// ─── Blind Hunter Hunt UI ─────────────────────────────────────────────────────
function buildHuntSlots(goodRoles) {
  const container = document.getElementById('hunt-slots');
  container.innerHTML = '';
  const guesses = [{ playerId: null, roleName: null }, { playerId: null, roleName: null }];

  for (let i = 0; i < 2; i++) {
    const slot = document.createElement('div');
    slot.className = 'hunt-slot';

    const pSel = document.createElement('select');
    pSel.className = 'hunt-select';
    pSel.innerHTML = '<option value="">— player —</option>';
    players.filter(p => p.id !== socket.id).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      pSel.appendChild(opt);
    });

    const rSel = document.createElement('select');
    rSel.className = 'hunt-select';
    rSel.innerHTML = '<option value="">— role —</option>';
    goodRoles.forEach(role => {
      const opt = document.createElement('option');
      opt.value = role; opt.textContent = role;
      rSel.appendChild(opt);
    });

    pSel.addEventListener('change', () => { guesses[i].playerId = pSel.value || null; });
    rSel.addEventListener('change', () => { guesses[i].roleName = rSel.value || null; });

    const label = document.createElement('span');
    label.className = 'hunt-label';
    label.textContent = `Guess ${i + 1}: `;
    const isSpan = document.createElement('span');
    isSpan.className = 'hunt-is';
    isSpan.textContent = ' is ';

    slot.appendChild(label); slot.appendChild(pSel); slot.appendChild(isSpan); slot.appendChild(rSel);
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

// ─── Config UI ────────────────────────────────────────────────────────────────
function buildCharacterConfig() {
  const container = document.getElementById('character-rows');
  container.innerHTML = '';

  const categories = [
    { key: 'base',     label: 'Base Characters' },
    { key: 'optional', label: 'Optional Characters' },
    { key: 'promo',    label: 'Promo Characters' },
  ];

  categories.forEach(cat => {
    const goodChars = AVAILABLE_CHARACTERS.filter(c => c.category === cat.key && c.team === 'good');
    const evilChars = AVAILABLE_CHARACTERS.filter(c => c.category === cat.key && (c.team === 'evil' || c.team === 'variable'));

    const catHeader = document.createElement('div');
    catHeader.className = 'char-category-header';
    catHeader.textContent = cat.label;
    container.appendChild(catHeader);

    [['good', goodChars], ['evil', evilChars]].forEach(([team, chars]) => {
      if (!chars.length) return;
      const teamHeader = document.createElement('div');
      teamHeader.className = `char-team-header char-team-${team}`;
      teamHeader.textContent = team === 'good' ? '⚔ Good' : '💀 Evil / Special';
      container.appendChild(teamHeader);

      chars.forEach(char => {
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
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.counter-btn');
    if (!btn) return;
    const { char, action } = btn.dataset;
    configSettings.characters[char] = Math.max(0, (configSettings.characters[char] || 0) + (action === 'plus' ? 1 : -1));
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

  let goodCount = 0, evilCount = 0;
  AVAILABLE_CHARACTERS.forEach(c => {
    const n = configSettings.characters[c.name] || 0;
    if (c.team === 'good') goodCount += n;
    else if (c.team === 'evil') evilCount += n;
    else if (c.team === 'variable') { goodCount += Math.floor(n / 2); evilCount += Math.ceil(n / 2); }
  });

  const total = goodCount + evilCount;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PHASES = {
  'team-selection': teamSelectionPhase,
  'quest':          questPhase,
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
  confirmTeamBtn.classList.toggle('hidden', selectedPlayers.length !== currentTeamSize);
}

// ─── Quest Tracker ───────────────────────────────────────────────────────────
function buildQuestTracker() {
  questTracker.innerHTML = '';
  questSizes.forEach((size, i) => {
    const slot = document.createElement('div');
    slot.className = 'quest-slot' + (i === currentQuestIndex ? ' current' : '');
    slot.id = `quest-slot-${i}`;
    slot.innerHTML = `
      <div class="quest-label">Quest ${i + 1}</div>
      <div class="quest-circle"></div>
      <div class="quest-size">${size} players</div>`;
    questTracker.appendChild(slot);
  });
}

function updateQuestTracker(questIndex, succeeded, failCount) {
  const slot = document.getElementById(`quest-slot-${questIndex}`);
  if (!slot) return;
  const circle = slot.querySelector('.quest-circle');
  circle.classList.add(succeeded ? 'success' : 'fail');
  circle.textContent = succeeded ? '\u2713' : failCount;
  slot.classList.remove('current');
}

function highlightCurrentQuest() {
  document.querySelectorAll('.quest-slot').forEach(s => s.classList.remove('current'));
  const slot = document.getElementById(`quest-slot-${currentQuestIndex}`);
  if (slot) slot.classList.add('current');
}

function showMagicTokenTargets(teamIds, teamNames) {
  const container = document.getElementById('magic-token-targets');
  container.innerHTML = '';
  teamIds.forEach((id, i) => {
    const btn = document.createElement('button');
    btn.className = 'magic-token-btn';
    btn.textContent = teamNames[i];
    btn.addEventListener('click', () => socket.emit('use-magic-token', currentRoom, id));
    container.appendChild(btn);
  });
  leaderQuestActions.classList.remove('hidden');
}

function showQuestActions() { document.getElementById('quest-actions').classList.remove('hidden'); }
function hideQuestActions() { document.getElementById('quest-actions').classList.add('hidden'); }

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
