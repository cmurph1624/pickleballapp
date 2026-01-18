from tools.scheduler import generate_matches
import random
import time

def verify():
    # 1. Setup Mock Players
    players = []
    for i in range(12):
        players.append({
            "id": f"player_{i}",
            "hiddenRating": 35.0 + random.uniform(-5, 5), # Random skill
            "name": f"Player {i}"
        })

    print(f"Running Scheduler for {len(players)} players...")
    start_time = time.time()
    
    # 2. Run Algorithm
    matches = generate_matches(players, games_per_player=4, mode="STRICT_SOCIAL")
    
    end_time = time.time()
    print(f"Generated {len(matches)} matches in {end_time - start_time:.4f} seconds.")

    # 3. Analyze Results
    stats = {p['id']: {'partners': {}, 'games': 0} for p in players}
    
    for m in matches:
        t1 = m['team1']
        t2 = m['team2']
        
        # Team 1
        stats[t1[0]]['partners'][t1[1]] = stats[t1[0]]['partners'].get(t1[1], 0) + 1
        stats[t1[1]]['partners'][t1[0]] = stats[t1[1]]['partners'].get(t1[0], 0) + 1
        stats[t1[0]]['games'] += 1
        stats[t1[1]]['games'] += 1

        # Team 2
        stats[t2[0]]['partners'][t2[1]] = stats[t2[0]]['partners'].get(t2[1], 0) + 1
        stats[t2[1]]['partners'][t2[0]] = stats[t2[1]]['partners'].get(t2[0], 0) + 1
        stats[t2[0]]['games'] += 1
        stats[t2[1]]['games'] += 1

    # 4. Assertions
    failures = []
    for pid, data in stats.items():
        if data['games'] != 4:
            failures.append(f"Player {pid} played {data['games']} games (expected 4)")
        
        for partner, count in data['partners'].items():
            if count > 1:
                failures.append(f"Player {pid} had duplicate partner {partner} ({count} times)")

    if failures:
        print("\n❌ VERIFICATION FAILED:")
        for f in failures:
            print(f"  - {f}")
    else:
        print("\n✅ VERIFICATION PASSED: No duplicate partners, all players played 4 games.")
        print("Sample Matches:")
        for i, m in enumerate(matches[:4]):
            print(f"  Match {i+1}: {m['team1']} vs {m['team2']}")

if __name__ == "__main__":
    verify()
