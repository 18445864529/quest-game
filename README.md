# Quest Online

A web-based implementation of the **Quest** board game by Indie Boards & Cards - the spiritual successor to The Resistance: Avalon.

## Game Overview

Quest is a social deduction game for 4-10 players where Good (Servants of Arthur) battle Evil (Minions of Mordred). The key difference from Avalon is **no voting** - leaders directly select teams for quests.

### Key Features
- **No Voting System**: Leaders directly choose quest teams
- **Leader Rotation**: Each player can only be leader once
- **Magic Token**: Leaders can force Success cards (except vs Morgana)
- **Final Quest Rule**: If Evil wins 3 quests, Good gets one chance to identify all Evil players

## How to Play

### Setup
1. 4-10 players join a room
2. Players are secretly assigned Good or Evil roles
3. Evil players include Morgana (5+ players) who can ignore Magic Token

### Gameplay
1. **Team Selection**: Leader selects required number of players for quest (no voting!)
2. **Quest Phase**: Selected players play Success/Fail cards
3. **Quest Resolution**: Quest succeeds only if ALL cards are Success
4. **Win Conditions**: 
   - Good wins by completing 3 quests
   - Evil wins by failing 3 quests
   - If Evil wins 3, Good gets Final Quest to identify all Evil players

## Installation & Running

### Prerequisites
- Node.js 14+ installed

### Setup
```bash
cd quest-game
npm install
npm start
```

The server will start on `http://localhost:3000`

### Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

## Deployment

This app can be deployed to any platform supporting Node.js:

### Free Options
- **Heroku**: `git push heroku main`
- **Railway**: Connect GitHub repo
- **Render**: Connect GitHub repo
- **Replit**: Import from GitHub

### Environment
- No environment variables needed
- Uses in-memory storage (rooms reset on restart)

## Game Rules

### Team Sizes by Player Count
| Players | Quest 1 | Quest 2 | Quest 3 | Quest 4 | Quest 5 |
|---------|---------|---------|---------|---------|---------|
| 4       | 2       | 2       | 2       | 3       | 3       |
| 5       | 2       | 3       | 2       | 3       | 3       |
| 6       | 2       | 3       | 4       | 3       | 4       |
| 7       | 2       | 3       | 3       | 4       | 4       |
| 8-10    | 3       | 4       | 4       | 5       | 5       |

### Special Characters
- **Morgana (Evil)**: Can ignore Magic Token
- **Servants (Good)**: Must always play Success
- **Minions (Evil)**: Can play Success or Fail

## Technical Stack

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Real-time**: WebSocket communication
- **Storage**: In-memory (no database required)

## File Structure
```
quest-game/
├── server.js          # Main server file
├── package.json       # Dependencies
├── README.md          # This file
└── public/
    ├── index.html     # Main HTML
    ├── style.css      # Styling
    └── game.js        # Client-side logic
```

## Contributing

This is a minimal implementation. Potential improvements:
- Add more character types
- Persistent game storage
- Spectator mode
- Game replay system
- Mobile-optimized UI

## License

MIT License - Feel free to modify and distribute!