const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = new Map();

const QUEST_CONFIG = {
  4:  [2, 2, 2, 3, 3],
  5:  [2, 3, 2, 3, 3],
  6:  [2, 3, 4, 3, 4],
  7:  [2, 3, 3, 4, 4],
  8:  [3, 4, 4, 5, 5],
  9:  [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5]
};

// ─── Character Definitions ────────────────────────────────────────────────────
// knowsAllies:       sees other evil players who also have knowsAllies (Minion/Morgana/Assassin/Mordred)
// ignoresMagicToken: immune to leader's magic token
// seesEvil:          sees all evil players at game start (except hiddenFromMerlin ones)
// seesMerlinPair:    sees Merlin + Morgana as a shuffled pair (Percival ability)
// seesOneEvil:       sees one random evil player's name (Cleric ability)
// isAssassinTarget:  Assassin tries to identify this character to steal victory
// isAssassin:        triggers assassination phase when Good wins 3 quests
// isBlindHunter:     triggers blind-hunter phase when Evil wins 3 quests
// hiddenFromMerlin:  Merlin cannot see this evil player (Mordred)
// appearAsMerlin:    appears to Percival as Merlin (Morgana)
const CHARACTERS = {
  'Servant': {
    team: 'good', knowsAllies: false, ignoresMagicToken: false,
    seesEvil: false, seesMerlinPair: false, seesOneEvil: false,
    isAssassinTarget: false, isAssassin: false, isBlindHunter: false,
    hiddenFromMerlin: false, appearAsMerlin: false,
  },
  'Merlin': {
    team: 'good', knowsAllies: false, ignoresMagicToken: false,
    seesEvil: true, seesMerlinPair: false, seesOneEvil: false,
    isAssassinTarget: true, isAssassin: false, isBlindHunter: false,
    hiddenFromMerlin: false, appearAsMerlin: false,
  },
  'Percival': {
    team: 'good', knowsAllies: false, ignoresMagicToken: false,
    seesEvil: false, seesMerlinPair: true, seesOneEvil: false,
    isAssassinTarget: false, isAssassin: false, isBlindHunter: false,
    hiddenFromMerlin: false, appearAsMerlin: false,
  },
  'Cleric': {
    team: 'good', knowsAllies: false, ignoresMagicToken: false,
    seesEvil: false, seesMerlinPair: false, seesOneEvil: true,
    isAssassinTarget: false, isAssassin: false, isBlindHunter: false,
    hiddenFromMerlin: false, appearAsMerlin: false,
  },
  'Minion': {
    team: 'evil', knowsAllies: true, ignoresMagicToken: false,
    seesEvil: false, seesMerlinPair: false, seesOneEvil: false,
    isAssassinTarget: false, isAssassin: false, isBlindHunter: false,
    hiddenFromMerlin: false, appearAsMerlin: false,
  },
  'Morgana': {
    team: 'evil', knowsAllies: true, ignoresMagicToken: true,
    seesEvil: false, seesMerlinPair: false, seesOneEvil: false,
    isAssassinTarget: false, isAssassin: false, isBlindHunter: false,
    hiddenFromMerlin: false, appearAsMerlin: true,
  },
  'Assassin': {
    team: 'evil', knowsAllies: true, ignoresMagicToken: false,
    seesEvil: false, seesMerlinPair: false, seesOneEvil: false,
    isAssassinTarget: false, isAssassin: true, isBlindHunter: false,
    hiddenFromMerlin: false, appearAsMerlin: false,
  },
  'Mordred': {
    team: 'evil', knowsAllies: true, ignoresMagicToken: false,
    seesEvil: false, seesMerlinPair: false, seesOneEvil: false,
    isAssassinTarget: false, isAssassin: false, isBlindHunter: false,
    hiddenFromMerlin: true, appearAsMerlin: false,
  },
  'Oberon': {
    team: 'evil', knowsAllies: false, ignoresMagicToken: false,
    seesEvil: false, seesMerlinPair: false, seesOneEvil: false,
    isAssassinTarget: false, isAssassin: false, isBlindHunter: false,
    hiddenFromMerlin: false, appearAsMerlin: false,
  },
  'Blind Hunter': {
    team: 'evil', knowsAllies: false, ignoresMagicToken: false,
    seesEvil: false, seesMerlinPair: false, seesOneEvil: false,
    isAssassinTarget: false, isAssassin: false, isBlindHunter: true,
    hiddenFromMerlin: false, appearAsMerlin: false,
  },
};

function createRoom(roomCode) {
  return {
    id: roomCode,
    players: new Map(),
    gameStarted: false,
    currentQuest: 0,
    currentLeader: null,
    questResults: [],
    goodWins: 0,
    evilWins: 0,
    gamePhase: 'waiting',
    selectedTeam: [],
    questCards: [],
    magicTokenUsed: false,
    leaderHistory: [],
    settings: { seats: null, characters: null }
  };
}

function assignRoles(playerCount) {
  const evilCount = Math.ceil(playerCount / 3);
  const roles = [];
  for (let i = 0; i < evilCount; i++) {
    roles.push({ team: 'evil', character: i === 0 && playerCount >= 5 ? 'Morgana' : 'Minion' });
  }
  for (let i = evilCount; i < playerCount; i++) {
    roles.push({ team: 'good', character: 'Servant' });
  }
  shuffle(roles);
  return roles;
}

function assignRolesFromConfig(characters) {
  const roles = [];
  for (const [character, count] of Object.entries(characters)) {
    const charDef = CHARACTERS[character];
    if (!charDef) continue;
    for (let i = 0; i < count; i++) {
      roles.push({ team: charDef.team, character });
    }
  }
  shuffle(roles);
  return roles;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getQuestTeamSize(playerCount, questNumber) {
  return QUEST_CONFIG[playerCount][questNumber];
}

function sendRoleInfo(room) {
  const allPlayers = Array.from(room.players.values());

  room.players.forEach((p, playerId) => {
    const charDef = CHARACTERS[p.role.character] || {};
    const info = { ...p.role };

    // Evil allies: Minion/Morgana/Assassin/Mordred see each other
    info.allies = charDef.knowsAllies
      ? allPlayers
          .filter(o => o.id !== playerId && o.role.team === 'evil' && CHARACTERS[o.role.character]?.knowsAllies)
          .map(o => ({ name: o.name, character: o.role.character }))
      : [];

    // Merlin sees all evil except Mordred
    if (charDef.seesEvil) {
      info.evilPlayers = allPlayers
        .filter(o => o.role.team === 'evil' && !CHARACTERS[o.role.character]?.hiddenFromMerlin)
        .map(o => ({ name: o.name }));
    }

    // Percival sees Merlin + Morgana as a shuffled pair (can't tell which is which)
    if (charDef.seesMerlinPair) {
      const pair = allPlayers
        .filter(o => o.role.character === 'Merlin' || CHARACTERS[o.role.character]?.appearAsMerlin)
        .map(o => ({ name: o.name }));
      shuffle(pair);
      info.merlinPair = pair;
    }

    // Cleric sees one random evil player's name
    if (charDef.seesOneEvil) {
      const evilList = allPlayers.filter(o => o.role.team === 'evil');
      if (evilList.length > 0) {
        const pick = evilList[Math.floor(Math.random() * evilList.length)];
        info.clericReveal = { name: pick.name };
      }
    }

    io.to(playerId).emit('role-assigned', info);
  });
}

function resolveEndgame(room, roomCode) {
  const allPlayers = Array.from(room.players.values());

  if (room.goodWins === 3) {
    // Check for assassination (needs both Merlin and Assassin)
    const assassin = allPlayers.find(p => CHARACTERS[p.role.character]?.isAssassin);
    const merlin = allPlayers.find(p => p.role.character === 'Merlin');

    if (assassin && merlin) {
      room.gamePhase = 'assassination';
      io.to(roomCode).emit('assassination-phase', { assassinId: assassin.id });
    } else {
      room.gamePhase = 'game-over';
      io.to(roomCode).emit('game-over', { winner: 'good', reason: 'Three quests succeeded!' });
    }

  } else if (room.evilWins === 3) {
    // Check for blind hunter
    const blindHunter = allPlayers.find(p => CHARACTERS[p.role.character]?.isBlindHunter);

    if (blindHunter) {
      room.gamePhase = 'blind-hunter';
      const goodRolesInPlay = [...new Set(allPlayers.filter(p => p.role.team === 'good').map(p => p.role.character))];
      io.to(roomCode).emit('blind-hunter-phase', {
        blindHunterId: blindHunter.id,
        goodRolesInPlay
      });
    } else {
      room.gamePhase = 'final-quest';
      io.to(roomCode).emit('final-quest-phase');
    }
  }
}

// ─── Socket Handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('create-room', (playerName) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = createRoom(roomCode);
    rooms.set(roomCode, room);
    room.players.set(socket.id, { id: socket.id, name: playerName, role: null, isCreator: true });
    socket.join(roomCode);
    socket.emit('room-created', roomCode);
    socket.emit('players-updated', Array.from(room.players.values()));
  });

  socket.on('join-room', (roomCode, playerName) => {
    const room = rooms.get(roomCode);
    if (!room) { socket.emit('error', 'Room not found'); return; }
    if (room.gameStarted) { socket.emit('error', 'Game already started'); return; }

    const maxPlayers = room.settings.seats || 10;
    if (room.players.size >= maxPlayers) { socket.emit('error', 'Room is full'); return; }

    room.players.set(socket.id, { id: socket.id, name: playerName, role: null, isCreator: false });
    socket.join(roomCode);
    socket.emit('room-joined', roomCode);
    io.to(roomCode).emit('players-updated', Array.from(room.players.values()));
  });

  socket.on('configure-room', (roomCode, settings) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameStarted) return;
    const player = room.players.get(socket.id);
    if (!player || !player.isCreator) return;

    const { seats, characters } = settings;

    if (!seats || seats < 4 || seats > 10) {
      socket.emit('error', 'Seats must be between 4 and 10'); return;
    }
    for (const char of Object.keys(characters)) {
      if (!CHARACTERS[char]) { socket.emit('error', `Unknown character: ${char}`); return; }
    }

    const total = Object.values(characters).reduce((a, b) => a + b, 0);
    if (total !== seats) {
      socket.emit('error', `Total characters (${total}) must equal seats (${seats})`); return;
    }

    const goodCount = Object.entries(characters)
      .filter(([c]) => CHARACTERS[c].team === 'good')
      .reduce((sum, [, n]) => sum + n, 0);
    const evilCount = total - goodCount;

    if (goodCount < 1 || evilCount < 1) {
      socket.emit('error', 'Must have at least 1 good and 1 evil player'); return;
    }

    room.settings = { seats, characters };
    io.to(roomCode).emit('config-updated', { seats, characters, goodCount, evilCount });
  });

  socket.on('start-game', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player || !player.isCreator) return;

    const playerCount = room.players.size;
    if (room.settings.seats) {
      if (playerCount !== room.settings.seats) {
        socket.emit('error', `Need exactly ${room.settings.seats} players (currently ${playerCount})`); return;
      }
    } else if (playerCount < 4) {
      socket.emit('error', 'Need at least 4 players'); return;
    }

    const roles = room.settings.characters
      ? assignRolesFromConfig(room.settings.characters)
      : assignRoles(playerCount);

    let i = 0;
    room.players.forEach((p) => { p.role = roles[i++]; });

    const playerIds = Array.from(room.players.keys());
    room.currentLeader = playerIds[Math.floor(Math.random() * playerIds.length)];
    room.leaderHistory.push(room.currentLeader);
    room.gameStarted = true;
    room.gamePhase = 'team-selection';

    sendRoleInfo(room);

    io.to(roomCode).emit('game-started', {
      currentLeader: room.currentLeader,
      questNumber: room.currentQuest,
      teamSize: getQuestTeamSize(playerCount, room.currentQuest)
    });
  });

  socket.on('select-team', (roomCode, selectedPlayerIds) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'team-selection') return;
    if (socket.id !== room.currentLeader) return;

    const requiredSize = getQuestTeamSize(room.players.size, room.currentQuest);
    if (selectedPlayerIds.length !== requiredSize) {
      socket.emit('error', `Team must have exactly ${requiredSize} players`); return;
    }

    room.selectedTeam = selectedPlayerIds;
    room.gamePhase = 'quest-phase';
    room.questCards = [];
    room.magicTokenUsed = false;

    io.to(roomCode).emit('team-selected', {
      team: selectedPlayerIds,
      teamNames: selectedPlayerIds.map(id => room.players.get(id).name)
    });
  });

  socket.on('play-quest-card', (roomCode, cardType) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'quest-phase') return;
    if (!room.selectedTeam.includes(socket.id)) return;
    if (room.questCards.some(c => c.playerId === socket.id)) return;

    const player = room.players.get(socket.id);
    const actualCard = player.role.team === 'good' ? 'success' : cardType;
    room.questCards.push({ playerId: socket.id, card: actualCard });

    if (room.questCards.length === room.selectedTeam.length) {
      const failCount = room.questCards.filter(c => c.card === 'fail').length;
      const questSucceeded = failCount === 0;

      room.questResults.push({ questNumber: room.currentQuest, succeeded: questSucceeded, failCount });
      if (questSucceeded) room.goodWins++; else room.evilWins++;

      if (room.goodWins === 3 || room.evilWins === 3) {
        // Emit quest result first, then trigger endgame
        io.to(roomCode).emit('quest-result-final', {
          succeeded: questSucceeded, failCount,
          goodWins: room.goodWins, evilWins: room.evilWins
        });
        resolveEndgame(room, roomCode);
      } else {
        room.currentQuest++;
        const available = Array.from(room.players.keys()).filter(id => !room.leaderHistory.includes(id));
        if (available.length > 0) {
          room.currentLeader = available[Math.floor(Math.random() * available.length)];
        } else {
          room.leaderHistory = [];
          const others = Array.from(room.players.keys()).filter(id => id !== room.currentLeader);
          room.currentLeader = others[Math.floor(Math.random() * others.length)] || Array.from(room.players.keys())[0];
        }
        room.leaderHistory.push(room.currentLeader);
        room.gamePhase = 'team-selection';

        io.to(roomCode).emit('quest-result', {
          succeeded: questSucceeded, failCount,
          goodWins: room.goodWins, evilWins: room.evilWins,
          nextLeader: room.currentLeader,
          questNumber: room.currentQuest,
          teamSize: getQuestTeamSize(room.players.size, room.currentQuest)
        });
      }
    } else {
      io.to(roomCode).emit('card-played', {
        cardsPlayed: room.questCards.length,
        totalNeeded: room.selectedTeam.length
      });
    }
  });

  socket.on('use-magic-token', (roomCode, targetPlayerId) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'quest-phase') return;
    if (socket.id !== room.currentLeader || room.magicTokenUsed) return;

    const target = room.players.get(targetPlayerId);
    if (!target || !room.selectedTeam.includes(targetPlayerId)) return;

    if (CHARACTERS[target.role.character]?.ignoresMagicToken) {
      io.to(roomCode).emit('magic-token-ignored', target.name);
      return;
    }

    room.magicTokenUsed = true;
    room.questCards = room.questCards.filter(c => c.playerId !== targetPlayerId);
    room.questCards.push({ playerId: targetPlayerId, card: 'success' });

    io.to(roomCode).emit('magic-token-used', {
      target: target.name,
      cardsPlayed: room.questCards.length,
      totalNeeded: room.selectedTeam.length
    });
  });

  // Assassin picks who they think is Merlin (after Good wins 3)
  socket.on('assassinate', (roomCode, targetPlayerId) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'assassination') return;

    const player = room.players.get(socket.id);
    if (!player || !CHARACTERS[player.role.character]?.isAssassin) return;

    const target = room.players.get(targetPlayerId);
    if (!target) return;

    room.gamePhase = 'game-over';
    const correct = target.role.character === 'Merlin';
    io.to(roomCode).emit('game-over', {
      winner: correct ? 'evil' : 'good',
      reason: correct
        ? `Assassin identified Merlin (${target.name})! Evil wins despite 3 quests!`
        : `Assassin guessed wrong (picked ${target.name}). Good wins!`
    });
  });

  // Blind Hunter picks 2 players and names their Good roles (after Evil wins 3)
  socket.on('blind-hunter-guess', (roomCode, guesses) => {
    // guesses = [{ playerId, roleName }, { playerId, roleName }]
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'blind-hunter') return;

    const player = room.players.get(socket.id);
    if (!player || !CHARACTERS[player.role.character]?.isBlindHunter) return;
    if (!Array.isArray(guesses) || guesses.length !== 2) return;

    const allCorrect = guesses.every(g => {
      const target = room.players.get(g.playerId);
      return target && target.role.character === g.roleName;
    });

    room.gamePhase = 'game-over';
    io.to(roomCode).emit('game-over', {
      winner: allCorrect ? 'evil' : 'good',
      reason: allCorrect
        ? 'Blind Hunter correctly identified the Good players! Evil wins!'
        : 'Blind Hunter guessed wrong. Good wins!'
    });
  });

  // Final Quest: Good team identifies all evil players (when no Blind Hunter)
  socket.on('final-quest-guess', (roomCode, evilPlayerIds) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'final-quest') return;
    const player = room.players.get(socket.id);
    if (!player || player.role.team !== 'good') return;

    const actualEvilIds = Array.from(room.players.values())
      .filter(p => p.role.team === 'evil').map(p => p.id);

    const correct = evilPlayerIds.length === actualEvilIds.length &&
      evilPlayerIds.every(id => actualEvilIds.includes(id));

    room.gamePhase = 'game-over';
    io.to(roomCode).emit('game-over', {
      winner: correct ? 'good' : 'evil',
      reason: correct
        ? 'Good correctly identified all evil players!'
        : 'Good failed to identify all evil players — Evil wins!'
    });
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    rooms.forEach((room, roomCode) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        if (room.players.size === 0) {
          rooms.delete(roomCode);
        } else {
          io.to(roomCode).emit('players-updated', Array.from(room.players.values()));
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
