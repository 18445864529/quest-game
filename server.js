const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));

// Game state
const rooms = new Map();

// Quest configuration based on player count
const QUEST_CONFIG = {
  4: [2, 2, 2, 3, 3],
  5: [2, 3, 2, 3, 3], 
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5]
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
    gamePhase: 'waiting', // waiting, team-selection, quest-phase, game-over
    selectedTeam: [],
    questCards: [],
    magicTokenUsed: false,
    leaderHistory: []
  };
}

function assignRoles(playerCount) {
  const evilCount = Math.ceil(playerCount / 3);
  const roles = [];
  
  // Add evil players (including Morgana if 5+ players)
  for (let i = 0; i < evilCount; i++) {
    if (i === 0 && playerCount >= 5) {
      roles.push({ team: 'evil', character: 'Morgana' });
    } else {
      roles.push({ team: 'evil', character: 'Minion' });
    }
  }
  
  // Add good players
  for (let i = evilCount; i < playerCount; i++) {
    roles.push({ team: 'good', character: 'Servant' });
  }
  
  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  
  return roles;
}

function getQuestTeamSize(playerCount, questNumber) {
  return QUEST_CONFIG[playerCount][questNumber];
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('create-room', (playerName) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = createRoom(roomCode);
    rooms.set(roomCode, room);
    
    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      role: null,
      isCreator: true
    });
    
    socket.join(roomCode);
    socket.emit('room-created', roomCode);
    socket.emit('players-updated', Array.from(room.players.values()));
  });

  socket.on('join-room', (roomCode, playerName) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    if (room.gameStarted) {
      socket.emit('error', 'Game already started');
      return;
    }
    
    if (room.players.size >= 10) {
      socket.emit('error', 'Room is full');
      return;
    }
    
    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      role: null,
      isCreator: false
    });
    
    socket.join(roomCode);
    socket.emit('room-joined', roomCode);
    io.to(roomCode).emit('players-updated', Array.from(room.players.values()));
  });

  socket.on('start-game', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player || !player.isCreator) return;
    
    if (room.players.size < 4) {
      socket.emit('error', 'Need at least 4 players');
      return;
    }
    
    // Assign roles
    const roles = assignRoles(room.players.size);
    let roleIndex = 0;
    
    room.players.forEach((player) => {
      player.role = roles[roleIndex++];
    });
    
    // Set first leader randomly
    const playerIds = Array.from(room.players.keys());
    room.currentLeader = playerIds[Math.floor(Math.random() * playerIds.length)];
    room.leaderHistory.push(room.currentLeader);
    
    room.gameStarted = true;
    room.gamePhase = 'team-selection';
    
    // Send role info to each player
    room.players.forEach((player, playerId) => {
      io.to(playerId).emit('role-assigned', player.role);
    });
    
    io.to(roomCode).emit('game-started', {
      currentLeader: room.currentLeader,
      questNumber: room.currentQuest,
      teamSize: getQuestTeamSize(room.players.size, room.currentQuest)
    });
  });

  socket.on('select-team', (roomCode, selectedPlayerIds) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'team-selection') return;
    
    if (socket.id !== room.currentLeader) return;
    
    const requiredSize = getQuestTeamSize(room.players.size, room.currentQuest);
    if (selectedPlayerIds.length !== requiredSize) {
      socket.emit('error', `Team must have exactly ${requiredSize} players`);
      return;
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
    
    // Check if player already played a card
    if (room.questCards.some(card => card.playerId === socket.id)) return;
    
    const player = room.players.get(socket.id);
    let actualCard = cardType;
    
    // Good players can only play success
    if (player.role.team === 'good') {
      actualCard = 'success';
    }
    
    room.questCards.push({
      playerId: socket.id,
      card: actualCard
    });
    
    // Check if all team members have played
    if (room.questCards.length === room.selectedTeam.length) {
      const failCount = room.questCards.filter(card => card.card === 'fail').length;
      const questSucceeded = failCount === 0;
      
      room.questResults.push({
        questNumber: room.currentQuest,
        succeeded: questSucceeded,
        failCount: failCount
      });
      
      if (questSucceeded) {
        room.goodWins++;
      } else {
        room.evilWins++;
      }
      
      // Check win conditions
      if (room.goodWins === 3) {
        room.gamePhase = 'final-quest';
        io.to(roomCode).emit('final-quest-phase');
      } else if (room.evilWins === 3) {
        room.gamePhase = 'game-over';
        io.to(roomCode).emit('game-over', { winner: 'good', reason: 'Three quests succeeded' });
      } else {
        // Next quest
        room.currentQuest++;
        
        // Select next leader (not from history)
        const availableLeaders = Array.from(room.players.keys())
          .filter(id => !room.leaderHistory.includes(id));
        
        if (availableLeaders.length > 0) {
          room.currentLeader = availableLeaders[Math.floor(Math.random() * availableLeaders.length)];
          room.leaderHistory.push(room.currentLeader);
        } else {
          // Reset leader history if everyone has been leader
          room.leaderHistory = [room.currentLeader];
        }
        
        room.gamePhase = 'team-selection';
        
        io.to(roomCode).emit('quest-result', {
          succeeded: questSucceeded,
          failCount: failCount,
          goodWins: room.goodWins,
          evilWins: room.evilWins,
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
    
    const targetPlayer = room.players.get(targetPlayerId);
    if (!targetPlayer || !room.selectedTeam.includes(targetPlayerId)) return;
    
    // Morgana can ignore the token
    if (targetPlayer.role.character === 'Morgana') {
      io.to(roomCode).emit('magic-token-ignored', targetPlayer.name);
      return;
    }
    
    room.magicTokenUsed = true;
    
    // Force success card for target player
    room.questCards = room.questCards.filter(card => card.playerId !== targetPlayerId);
    room.questCards.push({
      playerId: targetPlayerId,
      card: 'success'
    });
    
    io.to(roomCode).emit('magic-token-used', {
      target: targetPlayer.name,
      cardsPlayed: room.questCards.length,
      totalNeeded: room.selectedTeam.length
    });
  });

  socket.on('final-quest-guess', (roomCode, evilPlayerIds) => {
    const room = rooms.get(roomCode);
    if (!room || room.gamePhase !== 'final-quest') return;
    
    const player = room.players.get(socket.id);
    if (!player || player.role.team !== 'good') return;
    
    const actualEvilPlayers = Array.from(room.players.values())
      .filter(p => p.role.team === 'evil')
      .map(p => p.id);
    
    const correctGuess = evilPlayerIds.length === actualEvilPlayers.length &&
      evilPlayerIds.every(id => actualEvilPlayers.includes(id));
    
    room.gamePhase = 'game-over';
    
    if (correctGuess) {
      io.to(roomCode).emit('game-over', { 
        winner: 'good', 
        reason: 'Correctly identified all evil players' 
      });
    } else {
      io.to(roomCode).emit('game-over', { 
        winner: 'evil', 
        reason: 'Good team failed to identify all evil players' 
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Remove player from all rooms
    rooms.forEach((room, roomCode) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        
        // If room is empty, delete it
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