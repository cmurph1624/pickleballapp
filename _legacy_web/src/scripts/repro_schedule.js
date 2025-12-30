
import { generateMatches } from '../utils/matchGenerator.js';

const runRepro = (numPlayers, gamesPerPlayer, mode) => {
    console.log(`Running Repro: ${numPlayers} players, ${gamesPerPlayer} games, mode: ${mode}`);
    const players = Array.from({ length: numPlayers }, (_, i) => ({
        id: `p${i + 1}`,
        firstName: `Player`,
        lastName: `${i + 1}`,
        hiddenRanking: 1000 + (i * 10) // varying skill
    }));

    const matches = generateMatches(players, gamesPerPlayer, mode);

    const matchCount = matches.length;
    const totalSlots = numPlayers * gamesPerPlayer;
    const expectedMatches = Math.floor(totalSlots / 4);

    console.log(`Matches Generated: ${matchCount}`);
    console.log(`Expected Matches: ${expectedMatches}`);

    const playerStats = {};
    players.forEach(p => playerStats[p.id] = 0);
    matches.forEach(m => {
        [...m.team1, ...m.team2].forEach(pid => playerStats[pid]++);
    });

    let gaps = 0;
    Object.entries(playerStats).forEach(([pid, count]) => {
        if (count < gamesPerPlayer) {
            console.log(`Player ${pid} has ${count}/${gamesPerPlayer} games.`);
            gaps += (gamesPerPlayer - count);
        }
    });

    if (matchCount < expectedMatches) {
        // console.log("FAIL: Schedule has gaps.");
        return false;
    } else {
        // console.log("SUCCESS: Schedule is full.");
        return true;
    }
};

// Scenario 1: 13 Players, 4 Games (Indivisible by 4)
runRepro(13, 4, "WEIGHTED_COMPETITIVE");

// Scenario 2: 12 Players, 4 Games (Perfect)
runRepro(12, 4, "WEIGHTED_COMPETITIVE");

// Scenario 3: 13 Players, 5 Games
runRepro(13, 5, "WEIGHTED_COMPETITIVE");

// Stress Test 9 Players
let fails = 0;
for (let i = 0; i < 100; i++) {
    const success = runRepro(9, 4, "WEIGHTED_COMPETITIVE");
    if (!success) fails++;
}
console.log(`Failed ${fails}/100 times.`);
