const socket = io();

// Game state
let currentRoom = null;
let currentPlayer = null;
let players = [];
let selectedPlayers = [];
let gameState = 'menu';

// DOM elements
const menuScreen = document.getElementById('menu-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const createForm = document.getElementById('create-form');
const joinForm = document.getElementById('join-form');

const createConfirmBtn = document.getElementById('create-confirm');
const joinConfirmBtn = document.getElementById('join-confirm');

const playerNameCreate = document.getElementById('player-name-create');
const playerNameJoin = document.getElementById('player-name-join');
const roomCodeInput = document.getElementById('room-code');

const roomCodeDisplay = document.getElementById('room-code-display');
const playersUl = document.getElementById('players-ul');
const startGameBtn = document.getElementById('start-game-btn');
const waitingMessage = document.getElementById('waiting-message');

// Game elements
const roleDisplay = document.getElementById('role-display');
const roleDescription = document.getElementById('role-description');
const questNumber = document.getElementById('quest-number');
const teamSize = document.getElementById('team-size');
const currentLeader = document.getElementById('current-leader');
const goodScore = document.getElementById('good-score');
const evilScore = document.getElementById('evil-score');

const teamSelectionPhase = document.getElementById('team-selection-phase');
const questPhase = document.getElementById('quest-phase');
const finalQuestPhase = document.getElementById('final-quest-phase');
const gameOverPhase = document.getElementById('game-over-phase');

const leaderActions = document.getElementById('leader-actions');
const waitingForLeader = document.getElementById('waiting-for-leader');
const playerSelection = document.getElementById('player-selection');
const confirmTeamBtn = document.getElementById('confirm-team');

const questActions = document.getElementById('quest-actions');
const leaderQuestActions = document.getElementById('leader-quest-actions');
const successBtn = document.getElementById('success-btn');
const failBtn = document.getElementById('fail-btn');
const cardsPlayed = document.getElementById('cards-played');
const cardsTotal = document.getElementById('cards-total');

const messagesList = document.getElementById('messages-list');

// Event listeners
createRoomBtn.addEventListener('click', () => {
    hideAllForms();
    createForm.classList.remove('hidden');
});

joinRoomBtn.addEventListener('click', () => {
    hideAllForms();
    joinForm.classList.remove('hidden');
});

createConfirmBtn.addEventListener('click', () => {
    const name = playerNameCreate.value.trim();
    if (name) {
        socket.emit('create-room', name);
        currentPlayer = name;
    }
});

joinConfirmBtn.addEventListener('click', () => {
    const name = playerNameJoin.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    if (name && code) {
        socket.emit('join-room', code, name);
        currentPlayer = name;
    }
});

startGameBtn.addEventListener('click', () => {
    socket.emit('start-game', currentRoom);
});

confirmTeamBtn.addEventListener('click', () => {
    socket.emit('select-team', currentRoom, selectedPlayers);
});

successBtn.addEventListener('click', () => {
    socket.emit('play-quest-card', currentRoom, 'success');
    hideQuestActions();
});

failBtn.addEventListener('click', () => {
    socket.emit('play-quest-card', currentRoom, 'fail');
    hideQuestActions();
});

document.getElementById('skip-magic-token').addEventListener('click', () => {
    leaderQuestActions.classList.add('hidden');
});

document.getElementById('submit-guess').addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('#final-quest-players .player-option.selected'))
        .map(el => el.dataset.playerId);
    socket.emit('final-quest-guess', currentRoom, selected);
});

document.getElementById('new-game-btn').addEventListener('click', () => {
    location.reload();
});

// Socket event handlers
socket.on('room-created', (roomCode) => {
    currentRoom = roomCode;
    showLobby();
    roomCodeDisplay.textContent = roomCode;
    startGameBtn.classList.remove('hidden');
    waitingMessage.classList.add('hidden');
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

socket.on('players-updated', (updatedPlayers) => {
    players = updatedPlayers;
    updatePlayersDisplay();
});

socket.on('role-assigned', (role) => {
    showGame();
    roleDisplay.textContent = `${role.character} (${role.team})`;
    roleDisplay.className = `role-${role.team}`;
    
    let description = '';
    if (role.team === 'good') {
        description = 'You serve Arthur. Play Success cards on quests.';
    } else {
        description = 'You serve Mordred. You can play Success or Fail cards.';
        if (role.character === 'Morgana') {
            description += ' You can ignore the Magic Token.';
        }
    }
    roleDescription.textContent = description;
});

socket.on('game-started', (data) => {
    questNumber.textContent = data.questNumber + 1;
    teamSize.textContent = data.teamSize;
    currentLeader.textContent = getPlayerName(data.currentLeader);
    
    showTeamSelectionPhase();
    
    if (socket.id === data.currentLeader) {
        showLeaderActions(data.teamSize);
    } else {
        hideLeaderActions();
    }
    
    addMessage('Game started!', 'success');
});

socket.on('team-selected', (data) => {
    showQuestPhase();
    document.getElementById('team-members').textContent = data.teamNames.join(', ');
    cardsTotal.textContent = data.team.length;
    cardsPlayed.textContent = '0';
    
    if (data.team.includes(socket.id)) {
        showQuestActions();
    } else {
        hideQuestActions();
    }
    
    addMessage(`Team selected: ${data.teamNames.join(', ')}`, 'info');
});

socket.on('card-played', (data) => {
    cardsPlayed.textContent = data.cardsPlayed;
    addMessage(`${data.cardsPlayed}/${data.totalNeeded} cards played`, 'info');
});

socket.on('quest-result', (data) => {
    goodScore.textContent = data.goodWins;
    evilScore.textContent = data.evilWins;
    
    const result = data.succeeded ? 'succeeded' : 'failed';
    const message = `Quest ${result}! ${data.failCount} fail card(s) played.`;
    addMessage(message, data.succeeded ? 'success' : 'error');
    
    // Setup next quest
    setTimeout(() => {
        questNumber.textContent = data.questNumber + 1;
        teamSize.textContent = data.teamSize;
        currentLeader.textContent = getPlayerName(data.nextLeader);
        
        showTeamSelectionPhase();
        
        if (socket.id === data.nextLeader) {
            showLeaderActions(data.teamSize);
        } else {
            hideLeaderActions();
        }
    }, 3000);
});

socket.on('magic-token-used', (data) => {
    addMessage(`Magic token used on ${data.target}!`, 'warning');
    cardsPlayed.textContent = data.cardsPlayed;
});

socket.on('magic-token-ignored', (playerName) => {
    addMessage(`${playerName} (Morgana) ignored the magic token!`, 'warning');
});

socket.on('final-quest-phase', () => {
    showFinalQuestPhase();
    addMessage('Final Quest! Good team must identify all evil players!', 'warning');
});

socket.on('game-over', (data) => {
    showGameOverPhase();
    document.getElementById('winner-display').innerHTML = 
        `<h3>${data.winner.toUpperCase()} WINS!</h3><p>${data.reason}</p>`;
    addMessage(`Game Over: ${data.winner} wins - ${data.reason}`, 'success');
});

socket.on('error', (message) => {
    addMessage(message, 'error');
});

// Helper functions
function hideAllForms() {
    createForm.classList.add('hidden');
    joinForm.classList.add('hidden');
}

function showLobby() {
    menuScreen.classList.remove('active');
    lobbyScreen.classList.add('active');
    gameScreen.classList.remove('active');
}

function showGame() {
    menuScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

function updatePlayersDisplay() {
    playersUl.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        if (player.isCreator) li.textContent += ' (Host)';
        playersUl.appendChild(li);
    });
}

function showTeamSelectionPhase() {
    teamSelectionPhase.classList.remove('hidden');
    questPhase.classList.add('hidden');
    finalQuestPhase.classList.add('hidden');
    gameOverPhase.classList.add('hidden');
}

function showQuestPhase() {
    teamSelectionPhase.classList.add('hidden');
    questPhase.classList.remove('hidden');
    finalQuestPhase.classList.add('hidden');
    gameOverPhase.classList.add('hidden');
}

function showFinalQuestPhase() {
    teamSelectionPhase.classList.add('hidden');
    questPhase.classList.add('hidden');
    finalQuestPhase.classList.remove('hidden');
    gameOverPhase.classList.add('hidden');
    
    // Show player selection for good players only
    const currentPlayerData = players.find(p => p.id === socket.id);
    if (currentPlayerData && currentPlayerData.role && currentPlayerData.role.team === 'good') {
        document.getElementById('evil-guess-section').classList.remove('hidden');
        document.getElementById('waiting-for-guess').classList.add('hidden');
        
        const container = document.getElementById('final-quest-players');
        container.innerHTML = '';
        players.forEach(player => {
            if (player.id !== socket.id) {
                const option = document.createElement('div');
                option.className = 'player-option';
                option.textContent = player.name;
                option.dataset.playerId = player.id;
                option.addEventListener('click', () => {
                    option.classList.toggle('selected');
                });
                container.appendChild(option);
            }
        });
    }
}

function showGameOverPhase() {
    teamSelectionPhase.classList.add('hidden');
    questPhase.classList.add('hidden');
    finalQuestPhase.classList.add('hidden');
    gameOverPhase.classList.remove('hidden');
}

function showLeaderActions(requiredTeamSize) {
    leaderActions.classList.remove('hidden');
    waitingForLeader.classList.add('hidden');
    
    playerSelection.innerHTML = '';
    selectedPlayers = [];
    
    players.forEach(player => {
        const option = document.createElement('div');
        option.className = 'player-option';
        option.textContent = player.name;
        option.dataset.playerId = player.id;
        option.addEventListener('click', () => {
            togglePlayerSelection(option, player.id, requiredTeamSize);
        });
        playerSelection.appendChild(option);
    });
    
    updateConfirmButton();
}

function hideLeaderActions() {
    leaderActions.classList.add('hidden');
    waitingForLeader.classList.remove('hidden');
}

function togglePlayerSelection(element, playerId, requiredTeamSize) {
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
        selectedPlayers = selectedPlayers.filter(id => id !== playerId);
    } else if (selectedPlayers.length < requiredTeamSize) {
        element.classList.add('selected');
        selectedPlayers.push(playerId);
    }
    updateConfirmButton();
}

function updateConfirmButton() {
    const requiredSize = parseInt(teamSize.textContent);
    if (selectedPlayers.length === requiredSize) {
        confirmTeamBtn.classList.remove('hidden');
    } else {
        confirmTeamBtn.classList.add('hidden');
    }
}

function showQuestActions() {
    questActions.classList.remove('hidden');
}

function hideQuestActions() {
    questActions.classList.add('hidden');
}

function getPlayerName(playerId) {
    const player = players.find(p => p.id === playerId);
    return player ? player.name : 'Unknown';
}

function addMessage(message, type = 'info') {
    const li = document.createElement('li');
    li.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    li.className = `message-${type}`;
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
}