// Simplified Quest Game (Single-player demo)
// This is a demo version showing the game interface
// For full multiplayer, install dependencies and use the main server

// Game state
let players = [
    { id: 1, name: 'Alice', role: { team: 'good', character: 'Servant' } },
    { id: 2, name: 'Bob', role: { team: 'evil', character: 'Minion' } },
    { id: 3, name: 'Charlie', role: { team: 'good', character: 'Servant' } },
    { id: 4, name: 'Diana', role: { team: 'evil', character: 'Morgana' } },
    { id: 5, name: 'Eve', role: { team: 'good', character: 'Servant' } }
];

let currentPlayer = players[0]; // You are Alice
let gameState = 'menu';
let currentQuest = 0;
let currentLeader = players[0];
let selectedPlayers = [];
let goodWins = 0;
let evilWins = 0;

// Quest configuration
const QUEST_CONFIG = {
    5: [2, 3, 2, 3, 3]
};

// DOM elements
const menuScreen = document.getElementById('menu-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const createForm = document.getElementById('create-form');
const joinForm = document.getElementById('join-form');

const createConfirmBtn = document.getElementById('create-confirm');
const startGameBtn = document.getElementById('start-game-btn');

const playersUl = document.getElementById('players-ul');
const roomCodeDisplay = document.getElementById('room-code-display');

// Game elements
const roleDisplay = document.getElementById('role-display');
const roleDescription = document.getElementById('role-description');
const questNumber = document.getElementById('quest-number');
const teamSize = document.getElementById('team-size');
const currentLeaderDisplay = document.getElementById('current-leader');
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
const successBtn = document.getElementById('success-btn');
const failBtn = document.getElementById('fail-btn');

const messagesList = document.getElementById('messages-list');

// Event listeners
createRoomBtn.addEventListener('click', () => {
    hideAllForms();
    createForm.classList.remove('hidden');
    addMessage('This is a demo version. For full multiplayer, run: npm install && npm start', 'warning');
});

joinRoomBtn.addEventListener('click', () => {
    hideAllForms();
    joinForm.classList.remove('hidden');
    addMessage('This is a demo version. For full multiplayer, run: npm install && npm start', 'warning');
});

createConfirmBtn.addEventListener('click', () => {
    const name = document.getElementById('player-name-create').value.trim();
    if (name) {
        currentPlayer.name = name;
        showLobby();
        roomCodeDisplay.textContent = 'DEMO01';
        updatePlayersDisplay();
        
        // Show start game button and hide waiting message
        startGameBtn.classList.remove('hidden');
        document.getElementById('waiting-message').classList.add('hidden');
        
        addMessage('Demo room created!', 'success');
    }
});

startGameBtn.addEventListener('click', () => {
    startGame();
});

confirmTeamBtn.addEventListener('click', () => {
    if (selectedPlayers.length === QUEST_CONFIG[5][currentQuest]) {
        selectTeam();
    }
});

successBtn.addEventListener('click', () => {
    playQuestCard('success');
});

failBtn.addEventListener('click', () => {
    playQuestCard('fail');
});

// Game functions
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
    players.forEach((player, index) => {
        const li = document.createElement('li');
        li.textContent = player.name + (index === 0 ? ' (You)' : '');
        if (index === 0) li.textContent += ' (Host)';
        playersUl.appendChild(li);
    });
}

function startGame() {
    showGame();
    
    // Show your role
    roleDisplay.textContent = `${currentPlayer.role.character} (${currentPlayer.role.team})`;
    roleDisplay.className = `role-${currentPlayer.role.team}`;
    
    let description = '';
    if (currentPlayer.role.team === 'good') {
        description = 'You serve Arthur. Play Success cards on quests.';
    } else {
        description = 'You serve Mordred. You can play Success or Fail cards.';
    }
    roleDescription.textContent = description;
    
    // Start first quest
    updateQuestInfo();
    showTeamSelectionPhase();
    
    if (currentPlayer === currentLeader) {
        showLeaderActions();
    }
    
    addMessage('Demo game started! You are playing as Alice (Good)', 'success');
    addMessage('Evil players in this demo: Bob (Minion), Diana (Morgana)', 'info');
}

function updateQuestInfo() {
    questNumber.textContent = currentQuest + 1;
    teamSize.textContent = QUEST_CONFIG[5][currentQuest];
    currentLeaderDisplay.textContent = currentLeader.name;
    goodScore.textContent = goodWins;
    evilScore.textContent = evilWins;
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

function showLeaderActions() {
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
            togglePlayerSelection(option, player.id);
        });
        playerSelection.appendChild(option);
    });
    
    updateConfirmButton();
}

function togglePlayerSelection(element, playerId) {
    const requiredSize = QUEST_CONFIG[5][currentQuest];
    
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
        selectedPlayers = selectedPlayers.filter(id => id !== playerId);
    } else if (selectedPlayers.length < requiredSize) {
        element.classList.add('selected');
        selectedPlayers.push(playerId);
    }
    updateConfirmButton();
}

function updateConfirmButton() {
    const requiredSize = QUEST_CONFIG[5][currentQuest];
    if (selectedPlayers.length === requiredSize) {
        confirmTeamBtn.classList.remove('hidden');
    } else {
        confirmTeamBtn.classList.add('hidden');
    }
}

function selectTeam() {
    const selectedPlayerNames = selectedPlayers.map(id => 
        players.find(p => p.id === id).name
    );
    
    showQuestPhase();
    document.getElementById('team-members').textContent = selectedPlayerNames.join(', ');
    document.getElementById('cards-total').textContent = selectedPlayers.length;
    document.getElementById('cards-played').textContent = '0';
    
    if (selectedPlayers.includes(currentPlayer.id)) {
        questActions.classList.remove('hidden');
        
        // Hide fail button for good players
        if (currentPlayer.role.team === 'good') {
            failBtn.style.display = 'none';
        }
    }
    
    addMessage(`Team selected: ${selectedPlayerNames.join(', ')}`, 'info');
    
    // Simulate other players' actions after a delay
    setTimeout(() => {
        simulateOtherPlayers();
    }, 2000);
}

function playQuestCard(cardType) {
    questActions.classList.add('hidden');
    addMessage(`You played a ${cardType} card`, 'info');
    
    // This would be handled by the server in the full version
    document.getElementById('cards-played').textContent = selectedPlayers.length;
    
    // Simulate quest resolution
    setTimeout(() => {
        resolveQuest();
    }, 1000);
}

function simulateOtherPlayers() {
    if (selectedPlayers.includes(currentPlayer.id)) {
        return; // Wait for player action
    }
    
    // Auto-resolve if player not on team
    document.getElementById('cards-played').textContent = selectedPlayers.length;
    setTimeout(() => {
        resolveQuest();
    }, 1000);
}

function resolveQuest() {
    // Simulate quest outcome (random for demo)
    const questSucceeded = Math.random() > 0.4;
    
    if (questSucceeded) {
        goodWins++;
        addMessage('Quest succeeded!', 'success');
    } else {
        evilWins++;
        addMessage('Quest failed!', 'error');
    }
    
    // Check win conditions
    if (goodWins === 3) {
        showGameOverPhase();
        document.getElementById('winner-display').innerHTML = 
            '<h3>GOOD WINS!</h3><p>Three quests succeeded!</p>';
        addMessage('Good team wins!', 'success');
        return;
    } else if (evilWins === 3) {
        showGameOverPhase();
        document.getElementById('winner-display').innerHTML = 
            '<h3>EVIL WINS!</h3><p>Three quests failed!</p>';
        addMessage('Evil team wins!', 'error');
        return;
    }
    
    // Next quest
    currentQuest++;
    
    // Rotate leader (simplified)
    const currentLeaderIndex = players.indexOf(currentLeader);
    currentLeader = players[(currentLeaderIndex + 1) % players.length];
    
    updateQuestInfo();
    showTeamSelectionPhase();
    
    if (currentPlayer === currentLeader) {
        showLeaderActions();
    } else {
        leaderActions.classList.add('hidden');
        waitingForLeader.classList.remove('hidden');
        
        // Auto-select team for demo (when you're not leader)
        setTimeout(() => {
            autoSelectTeam();
        }, 3000);
    }
}

function autoSelectTeam() {
    // Randomly select team for demo
    const requiredSize = QUEST_CONFIG[5][currentQuest];
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    selectedPlayers = shuffled.slice(0, requiredSize).map(p => p.id);
    
    selectTeam();
}

function showGameOverPhase() {
    teamSelectionPhase.classList.add('hidden');
    questPhase.classList.add('hidden');
    finalQuestPhase.classList.add('hidden');
    gameOverPhase.classList.remove('hidden');
}

function addMessage(message, type = 'info') {
    const li = document.createElement('li');
    li.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    li.className = `message-${type}`;
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
}

document.getElementById('new-game-btn').addEventListener('click', () => {
    location.reload();
});

// Add initial demo message
setTimeout(() => {
    addMessage('Welcome to Quest Online Demo!', 'info');
    addMessage('This is a simplified single-player demonstration', 'warning');
    addMessage('For full multiplayer experience, run: npm install && npm start', 'info');
}, 500);