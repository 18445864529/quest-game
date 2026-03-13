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

/*
 * Character properties:
 *   team              'good' | 'evil' | 'variable' (Lancelot)
 *   category          'base' | 'optional' | 'promo'
 *   inEvilAllies      Sees/is seen by other inEvilAllies players
 *   ignoresMagicToken Immune to magic token
 *   magicTokenCard    Card forced by token ('success' default, 'fail' for Youth)
 *   knowsScion        Morgan le Fay: also sees Scion
 *   knownToMorgan     Scion: Morgan le Fay knows this player
 *   seesMorganLeFay   Arthur: knows Morgan le Fay's identity
 *   seesCleric        Percival: knows Cleric's identity
 *   seesFirstLeader   Cleric: sees first leader's loyalty
 *   isLancelot        Lancelot pair mechanics
 *   alwaysFail        Lunatic: must Fail every quest
 *   canFailMaxQuestIndex  Brute: can Fail only in quests < this index (3 = quests 1-3)
 *   isReluctantLeader Must Fail as leader in quest index 1 or 2
 *   isSaboteur        Must Fail once they have been on a previous quest (Veteran)
 *   isRevealer        Revealed as Evil after 3rd failed quest
 *   isBraggart        Revealed as Evil if leader of 5th quest
 *   isBlindHunter     Activates The Hunt when Evil wins 3 quests
 *   knownToEvil       Visible to inEvilAllies players, but does not see them
 *   seesEvil          Outsider: sees all evil players but is not seen by them
 */
const CHARACTERS = {
  // ─── Base: Good ────────────────────────────────────────────────────────────
  'Loyal Servant': { team: 'good', category: 'base' },
  'Duke':          { team: 'good', category: 'base' },
  'Archduke':      { team: 'good', category: 'base' },

  // ─── Base: Evil ────────────────────────────────────────────────────────────
  'Minion':       { team: 'evil', category: 'base', inEvilAllies: true },
  'Morgan le Fay':{ team: 'evil', category: 'base', inEvilAllies: true, ignoresMagicToken: true, knowsScion: true },
  'Scion':        { team: 'evil', category: 'base', knownToMorgan: true },   // NOT in evil allies
  'Changeling':   { team: 'evil', category: 'base' },                         // fully isolated

  // ─── Optional: Good ────────────────────────────────────────────────────────
  'Cleric':       { team: 'good', category: 'optional', seesFirstLeader: true },
  'Youth':        { team: 'good', category: 'optional', magicTokenCard: 'fail' },
  'Troublemaker': { team: 'good', category: 'optional' },
  'Apprentice':   { team: 'good', category: 'optional' },
  'Arthur':       { team: 'good', category: 'optional', seesMorganLeFay: true },

  // ─── Optional: Evil ────────────────────────────────────────────────────────
  'Blind Hunter': { team: 'evil', category: 'optional', isBlindHunter: true, knownToEvil: true },
  'Brute':        { team: 'evil', category: 'optional', inEvilAllies: true, canFailMaxQuestIndex: 3 },
  'Lunatic':      { team: 'evil', category: 'optional', inEvilAllies: true, alwaysFail: true },
  'Mutineer':     { team: 'evil', category: 'optional' },
  'Trickster':    { team: 'evil', category: 'optional', inEvilAllies: true },
  'Revealer':     { team: 'evil', category: 'optional', inEvilAllies: true, isRevealer: true },

  // ─── Promo ─────────────────────────────────────────────────────────────────
  'Braggart':          { team: 'evil', category: 'promo', inEvilAllies: true, isBraggart: true },
  'Galahad':           { team: 'good', category: 'promo' },
  'Reluctant Leader':  { team: 'good', category: 'promo', isReluctantLeader: true },
  'Saboteur':          { team: 'evil', category: 'promo', inEvilAllies: true, isSaboteur: true },
  'Outsider':          { team: 'evil', category: 'promo', seesEvil: true },
  'Percival':          { team: 'good', category: 'promo', seesCleric: true },
  'Sentinel':          { team: 'good', category: 'promo' },
  'Lancelot':          { team: 'variable', category: 'promo', isLancelot: true },
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
    veterans: new Set(),
    settings: { seats: null, characters: null }
  };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function assignRoles(playerCount) {
  const evilCount = Math.ceil(playerCount / 3);
  const roles = [];
  for (let i = 0; i < evilCount; i++) {
    roles.push({ team: 'evil', character: i === 0 ? 'Morgan le Fay' : 'Minion' });
  }
  for (let i = evilCount; i < playerCount; i++) {
    roles.push({ team: 'good', character: 'Loyal Servant' });
  }
  shuffle(roles);
  return roles;
}

function assignRolesFromConfig(characters) {
  const roles = [];
  for (const [character, count] of Object.entries(characters)) {
    if (count === 0) continue;
    const def = CHARACTERS[character];
    if (!def) continue;

    if (def.isLancelot) {
      // Each pair: one Good Lancelot, one Evil Lancelot (randomly which is which)
      for (let i = 0; i < Math.floor(count / 2); i++) {
        const pair = [{ team: 'good', character: 'Lancelot' }, { team: 'evil', character: 'Lancelot' }];
        if (Math.random() < 0.5) pair.reverse();
        roles.push(...pair);
      }
      if (count % 2 === 1) {
        roles.push({ team: Math.random() < 0.5 ? 'good' : 'evil', character: 'Lancelot' });
      }
    } else {
      for (let i = 0; i < count; i++) {
        roles.push({ team: def.team, character });
      }
    }
  }
  shuffle(roles);
  return roles;
}

function sendRoleInfo(room) {
  const allPlayers = Array.from(room.players.values());
  const evilAllies = allPlayers.filter(p => CHARACTERS[p.role.character]?.inEvilAllies);
  const lancelots  = allPlayers.filter(p => p.role.character === 'Lancelot');

  room.players.forEach((p, playerId) => {
    const def  = CHARACTERS[p.role.character] || {};
    const info = { ...p.role };

    // Regular evil group sees each other + any knownToEvil characters
    if (def.inEvilAllies) {
      const knownToEvil = allPlayers.filter(o => o.id !== playerId && CHARACTERS[o.role.character]?.knownToEvil);
      const visible = [...evilAllies.filter(o => o.id !== playerId), ...knownToEvil];
      info.allies = visible.map(o => ({ name: o.name, character: o.role.character }));
    } else {
      info.allies = [];
    }

    // Outsider sees all evil players (but they don't see Outsider)
    if (def.seesEvil) {
      const evilPlayers = allPlayers.filter(o => o.id !== playerId && o.role.team === 'evil');
      info.allies = evilPlayers.map(o => ({ name: o.name, character: o.role.character }));
    }

    // Morgan le Fay also sees Scion
    if (def.knowsScion) {
      const scion = allPlayers.find(o => o.role.character === 'Scion');
      if (scion) info.scionInfo = { name: scion.name };
    }

    // Arthur knows Morgan le Fay
    if (def.seesMorganLeFay) {
      const morgan = allPlayers.find(o => o.role.character === 'Morgan le Fay');
      if (morgan) info.morganInfo = { name: morgan.name };
    }

    // Percival knows the Cleric
    if (def.seesCleric) {
      const cleric = allPlayers.find(o => o.role.character === 'Cleric');
      if (cleric) info.clericInfo = { name: cleric.name };
    }

    // Cleric sees first leader's loyalty
    if (def.seesFirstLeader) {
      const leader = room.players.get(room.currentLeader);
      if (leader) info.leaderInfo = { name: leader.name, team: leader.role.team };
    }

    // Lancelots know each other
    if (def.isLancelot) {
      info.lancelotAllies = lancelots
        .filter(o => o.id !== playerId)
        .map(o => ({ name: o.name, team: o.role.team }));
    }

    io.to(playerId).emit('role-assigned', info);
  });
}

function resolveEndgame(room, roomCode) {
  const allPlayers = Array.from(room.players.values());

  if (room.goodWins === 3) {
    room.gamePhase = 'game-over';
    io.to(roomCode).emit('game-over', { winner: 'good', reason: 'Three quests succeeded!' });
  } else if (room.evilWins === 3) {
    const blindHunter = allPlayers.find(p => CHARACTERS[p.role.character]?.isBlindHunter);
    if (blindHunter) {
      room.gamePhase = 'blind-hunter';
      const goodRoles = [...new Set(allPlayers.filter(p => p.role.team === 'good').map(p => p.role.character))];
      io.to(roomCode).emit('blind-hunter-phase', { blindHunterId: blindHunter.id, goodRolesInPlay: goodRoles });
    } else {
      room.gamePhase = 'final-quest';
      io.to(roomCode).emit('final-quest-phase');
    }
  }
}

function getQuestTeamSize(playerCount, questNumber) {
  return QUEST_CONFIG[playerCount][questNumber];
}

function checkQuestComplete(room, roomCode) {
  if (room.questCards.length < room.selectedTeam.length) {
    io.to(roomCode).emit('card-played', { cardsPlayed: room.questCards.length, totalNeeded: room.selectedTeam.length });
    return;
  }

  // Add all team members to veterans
  room.selectedTeam.forEach(id => room.veterans.add(id));

  const failCount = room.questCards.filter(c => c.card === 'fail').length;
  const succeeded = failCount === 0;
  room.questResults.push({ questNumber: room.currentQuest, succeeded, failCount });
  if (succeeded) room.goodWins++; else room.evilWins++;

  if (room.goodWins === 3 || room.evilWins === 3) {
    // Check for Revealer reveal (after 3rd failed quest)
    const revealed = [];
    if (room.evilWins === 3) {
      Array.from(room.players.values())
        .filter(p => CHARACTERS[p.role.character]?.isRevealer)
        .forEach(p => revealed.push({ name: p.name, character: p.role.character, team: 'evil' }));
    }
    if (revealed.length) io.to(roomCode).emit('players-revealed', revealed);

    io.to(roomCode).emit('quest-result-final', { succeeded, failCount, goodWins: room.goodWins, evilWins: room.evilWins });
    resolveEndgame(room, roomCode);
  } else {
    room.currentQuest++;

    // Pick next leader
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

    // Braggart must reveal if leader of 5th quest (index 4)
    const newLeader = room.players.get(room.currentLeader);
    if (room.currentQuest === 4 && newLeader && CHARACTERS[newLeader.role.character]?.isBraggart) {
      io.to(roomCode).emit('players-revealed', [{ name: newLeader.name, character: 'Braggart', team: 'evil' }]);
    }

    io.to(roomCode).emit('quest-result', {
      succeeded, failCount,
      goodWins: room.goodWins, evilWins: room.evilWins,
      nextLeader: room.currentLeader,
      questNumber: room.currentQuest,
      teamSize: getQuestTeamSize(room.players.size, room.currentQuest)
    });
  }
}

// ─── Socket Handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('create-room', (playerName, requestedCode) => {
    const roomCode = String(requestedCode || '111').substring(0, 3);
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
    if (!seats || seats < 4 || seats > 10) { socket.emit('error', 'Seats must be 4–10'); return; }

    for (const char of Object.keys(characters)) {
      if (!CHARACTERS[char]) { socket.emit('error', `Unknown character: ${char}`); return; }
    }

    const total = Object.values(characters).reduce((a, b) => a + b, 0);
    if (total !== seats) { socket.emit('error', `Total (${total}) must equal seats (${seats})`); return; }

    let goodCount = 0, evilCount = 0;
    for (const [c, n] of Object.entries(characters)) {
      if (n === 0) continue;
      const def = CHARACTERS[c];
      if (def.isLancelot) { goodCount += Math.floor(n / 2); evilCount += Math.ceil(n / 2); }
      else if (def.team === 'good') goodCount += n;
      else if (def.team === 'evil') evilCount += n;
    }

    if (goodCount < 1 || evilCount < 1) { socket.emit('error', 'Need at least 1 good and 1 evil'); return; }

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
        socket.emit('error', `Need exactly ${room.settings.seats} players (have ${playerCount})`); return;
      }
    } else if (playerCount < 4) {
      socket.emit('error', 'Need at least 4 players'); return;
    }

    const roles = room.settings.characters
      ? assignRolesFromConfig(room.settings.characters)
      : assignRoles(playerCount);

    let i = 0;
    room.players.forEach(p => { p.role = roles[i++]; });

    const ids = Array.from(room.players.keys());
    room.currentLeader = ids[Math.floor(Math.random() * ids.length)];
    room.leaderHistory.push(room.currentLeader);
    room.gameStarted = true;
    room.gamePhase = 'team-selection';

    sendRoleInfo(room);

    io.to(roomCode).emit('game-started', {
      currentLeader: room.currentLeader,
      questNumber: room.currentQuest,
      teamSize: getQuestTeamSize(playerCount, room.currentQuest),
      questSizes: QUEST_CONFIG[playerCount]
    });
  });

  socket.on('select-team', (roomCode, selectedPlayerIds) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'team-selection') return;
    if (socket.id !== room.currentLeader) return;

    const required = getQuestTeamSize(room.players.size, room.currentQuest);
    if (selectedPlayerIds.length !== required) {
      socket.emit('error', `Team must have exactly ${required} players`); return;
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
    if (!room.magicTokenUsed) return; // leader must assign token first
    if (!room.selectedTeam.includes(socket.id)) return;
    if (room.questCards.some(c => c.playerId === socket.id)) return;

    const player = room.players.get(socket.id);
    const def = CHARACTERS[player.role.character] || {};
    let actualCard;

    if (def.alwaysFail) {
      actualCard = 'fail';
    } else if (def.isReluctantLeader && socket.id === room.currentLeader &&
               (room.currentQuest === 1 || room.currentQuest === 2)) {
      actualCard = 'fail';
    } else if (player.role.team === 'good') {
      actualCard = 'success';
    } else if (def.canFailMaxQuestIndex !== undefined && room.currentQuest >= def.canFailMaxQuestIndex) {
      actualCard = 'success';
    } else if (def.isSaboteur && room.veterans.has(socket.id)) {
      actualCard = 'fail';
    } else {
      actualCard = cardType;
    }

    room.questCards.push({ playerId: socket.id, card: actualCard });
    checkQuestComplete(room, roomCode);
  });

  socket.on('use-magic-token', (roomCode, targetPlayerId) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'quest-phase') return;
    if (socket.id !== room.currentLeader || room.magicTokenUsed) return;

    const target = room.players.get(targetPlayerId);
    if (!target || !room.selectedTeam.includes(targetPlayerId)) return;

    const targetDef = CHARACTERS[target.role.character] || {};
    room.magicTokenUsed = true;

    // Morgan le Fay: token is consumed but she can still choose her card
    if (targetDef.ignoresMagicToken) {
      io.to(roomCode).emit('magic-token-on-morgan', {
        target: target.name,
        targetId: targetPlayerId
      });
      return;
    }

    // Determine forced card based on character abilities
    let tokenCard;
    if (targetDef.alwaysFail) {
      tokenCard = 'fail';
    } else if (targetDef.isReluctantLeader && targetPlayerId === room.currentLeader &&
               (room.currentQuest === 1 || room.currentQuest === 2)) {
      tokenCard = 'fail';
    } else if (targetDef.magicTokenCard) {
      tokenCard = targetDef.magicTokenCard;
    } else if (targetDef.isSaboteur && room.veterans.has(targetPlayerId)) {
      tokenCard = 'fail';
    } else {
      tokenCard = 'success';
    }

    room.questCards = room.questCards.filter(c => c.playerId !== targetPlayerId);
    room.questCards.push({ playerId: targetPlayerId, card: tokenCard });

    io.to(roomCode).emit('magic-token-used', {
      target: target.name,
      targetId: targetPlayerId,
      tokenCard,
      cardsPlayed: room.questCards.length,
      totalNeeded: room.selectedTeam.length
    });

    // Check if all cards are now in (token may have completed the quest)
    checkQuestComplete(room, roomCode);
  });

  socket.on('blind-hunter-guess', (roomCode, guesses) => {
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
        ? 'The Blind Hunter\'s Hunt succeeded! Evil wins!'
        : 'The Blind Hunter guessed wrong. Good wins!'
    });
  });

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
      reason: correct ? 'Good correctly identified all Evil players!' : 'Good failed to identify all Evil players — Evil wins!'
    });
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomCode) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        if (room.players.size === 0) rooms.delete(roomCode);
        else io.to(roomCode).emit('players-updated', Array.from(room.players.values()));
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
