import random
import uuid
import math
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional

# --- Configuration & Constants ---

MODES = {
    "STRICT_SOCIAL": {
        "missedOpponent": 5000,
        "missedPartner": 2000,
        "repeatPartner": 20000,
        "repeatOpponent": 4000,
        "skillVarianceType": 'linear',
        "skillVarianceWeight": 10
    },
    "WEIGHTED_COMPETITIVE": {
        "missedOpponent": 5000,
        "missedPartner": 200,
        "repeatPartner": 10000,
        "repeatOpponent": 100,
        "skillVarianceType": 'squared',
        "skillVarianceWeight": 100
    }
}

@dataclass
class Player:
    id: str
    hiddenRanking: float = 35.0 # Default rating if missing

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get('id'),
            hiddenRanking=float(data.get('hiddenRanking') or data.get('hiddenRating') or 35.0)
        )

@dataclass
class MatchConfig:
    mode: str
    games_per_player: int

class Scheduler:
    def __init__(self, players_data: List[Dict], games_per_player: int = 4, mode: str = "STRICT_SOCIAL"):
        self.players = [Player.from_dict(p) for p in players_data]
        self.games_per_player = games_per_player
        self.mode = mode if mode in MODES else "STRICT_SOCIAL"
        self.config = MODES[self.mode]
        self.ITERATIONS = 500 # Reduced from JS 2000 for Python performance initially, can tune

    def generate_matches(self) -> List[Dict]:
        if not self.players or len(self.players) < 4:
            return []

        best_matches = []
        best_score = float('inf')

        for _ in range(self.ITERATIONS):
            schedule = self._generate_single_schedule()
            score = self._evaluate_schedule(schedule)

            if score < best_score:
                best_score = score
                best_matches = schedule
        
        return best_matches

    def _get_match_skill_penalty(self, p1: Player, p2: Player, p3: Player, p4: Player) -> float:
        rankings = [p1.hiddenRanking, p2.hiddenRanking, p3.hiddenRanking, p4.hiddenRanking]
        
        if self.config['skillVarianceType'] == 'squared':
            # Sum of squared differences
            sum_sq_diff = 0
            for i in range(4):
                for j in range(i + 1, 4):
                    diff = rankings[i] - rankings[j]
                    sum_sq_diff += diff * diff
            return sum_sq_diff * self.config['skillVarianceWeight']
        else:
            # Linear variance (Social)
            sum_diff = 0
            for i in range(4):
                for j in range(i + 1, 4):
                    sum_diff += abs(rankings[i] - rankings[j])
            return sum_diff * self.config['skillVarianceWeight']

    def _evaluate_schedule(self, matches: List[Dict]) -> float:
        # Initialize stats
        stats = {p.id: {'partners': {}, 'opponents': {}, 'gamesPlayed': 0} for p in self.players}
        
        total_penalty = 0
        skill_penalty = 0

        player_map = {p.id: p for p in self.players}

        for m in matches:
            t1 = m['team1']
            t2 = m['team2']
            p1, p2 = player_map[t1[0]], player_map[t1[1]]
            p3, p4 = player_map[t2[0]], player_map[t2[1]]

            # Track Games
            for pid in [p1.id, p2.id, p3.id, p4.id]:
                stats[pid]['gamesPlayed'] += 1
            
            # Track Partners
            def add_partner(a, b):
                stats[a]['partners'][b] = stats[a]['partners'].get(b, 0) + 1
                stats[b]['partners'][a] = stats[b]['partners'].get(a, 0) + 1
                
            add_partner(p1.id, p2.id)
            add_partner(p3.id, p4.id)

            # Track Opponents
            teams = [[p1.id, p2.id], [p3.id, p4.id]]
            for t_a in teams[0]:
                for t_b in teams[1]:
                    stats[t_a]['opponents'][t_b] = stats[t_a]['opponents'].get(t_b, 0) + 1
                    stats[t_b]['opponents'][t_a] = stats[t_b]['opponents'].get(t_a, 0) + 1

            skill_penalty += self._get_match_skill_penalty(p1, p2, p3, p4)

        total_penalty += skill_penalty

        # Global Penalties
        for p in self.players:
            p_stats = stats[p.id]
            
            # Missing Games
            if p_stats['gamesPlayed'] < self.games_per_player:
                total_penalty += (self.games_per_player - p_stats['gamesPlayed']) * 50000

            # Relationships
            for other in self.players:
                if p.id == other.id:
                    continue
                
                partner_count = p_stats['partners'].get(other.id, 0)
                if partner_count == 0:
                    total_penalty += self.config['missedPartner']
                elif partner_count > 1:
                    total_penalty += (partner_count - 1) * self.config['repeatPartner']

                opponent_count = p_stats['opponents'].get(other.id, 0)
                if opponent_count == 0:
                    total_penalty += self.config['missedOpponent']
                elif opponent_count > 1 and self.config.get('repeatOpponent'):
                    total_penalty += (opponent_count - 1) * self.config['repeatOpponent']

        return total_penalty

    def _generate_single_schedule(self) -> List[Dict]:
        matches = []
        player_stats = {p.id: {'partners': {}, 'opponents': {}, 'gamesPlayed': 0} for p in self.players}
        
        total_slots = len(self.players) * self.games_per_player
        total_matches = total_slots // 4 # Integer division

        current_round_matches = 0
        current_round_players = set()
        matches_per_round = len(self.players) // 4

        # Heuristic Helper
        def get_heuristic_score(p1, p2, p3, p4):
            score = 0
            
            # Partner Repeats
            def check_partner(a, b): return player_stats[a.id]['partners'].get(b.id, 0)
            
            repeat_partner_penalty = 10000 if self.mode == "WEIGHTED_COMPETITIVE" else 20000
            score += check_partner(p1, p2) * repeat_partner_penalty
            score += check_partner(p3, p4) * repeat_partner_penalty

            # Opponent Repeats
            def check_opponent(a, b): return player_stats[a.id]['opponents'].get(b.id, 0)
            repeat_opp_penalty = self.config.get('repeatOpponent', 4000)

            score += check_opponent(p1, p3) * repeat_opp_penalty
            score += check_opponent(p1, p4) * repeat_opp_penalty
            score += check_opponent(p2, p3) * repeat_opp_penalty
            score += check_opponent(p2, p4) * repeat_opp_penalty

            # Skill
            score += self._get_match_skill_penalty(p1, p2, p3, p4)
            return score

        for _ in range(total_matches):
            if matches_per_round > 0 and current_round_matches >= matches_per_round:
                current_round_matches = 0
                current_round_players.clear()

            # Filter candidates
            candidates = [
                p for p in self.players 
                if player_stats[p.id]['gamesPlayed'] < self.games_per_player 
                and p.id not in current_round_players
            ]

            if len(candidates) < 4:
                break

            # Shuffle and Sort
            random.shuffle(candidates)
            candidates.sort(key=lambda p: player_stats[p.id]['gamesPlayed'])

            p1 = candidates[0]
            others = candidates[1:]

            if self.mode == "WEIGHTED_COMPETITIVE":
                # Sort by skill proximity to p1
                others.sort(key=lambda p: abs(p.hiddenRanking - p1.hiddenRanking))
            
            # Greedy Builder
            match_players = [p1]
            SEARCH_WINDOW = 6

            while len(match_players) < 4:
                valid_next = []
                
                # Score candidates
                candidate_scores = []
                for c in others:
                    if any(mp.id == c.id for mp in match_players):
                        continue
                        
                    score = 0
                    for existing in match_players:
                        score += player_stats[c.id]['partners'].get(existing.id, 0) * 100
                        score += player_stats[c.id]['opponents'].get(existing.id, 0)
                    candidate_scores.append({'player': c, 'score': score})
                
                candidate_scores.sort(key=lambda x: x['score'])

                for item in candidate_scores:
                    candidate = item['player']
                    if len(valid_next) >= SEARCH_WINDOW:
                        break
                    
                    if any(mp.id == candidate.id for mp in match_players):
                        continue

                    # Pruning 3rd player
                    if len(match_players) == 2:
                        pA, pB, pC = match_players[0], match_players[1], candidate
                        ab_bad = player_stats[pA.id]['partners'].get(pB.id, 0) > 0
                        ac_bad = player_stats[pA.id]['partners'].get(pC.id, 0) > 0
                        bc_bad = player_stats[pB.id]['partners'].get(pC.id, 0) > 0
                        
                        if ab_bad and ac_bad and bc_bad:
                            continue
                            
                    # Pruning 4th player (Impossible Group Check)
                    if len(match_players) == 3:
                        pA, pB, pC, pD = match_players[0], match_players[1], match_players[2], candidate
                        
                        permutations = [
                            ((pA, pB), (pC, pD)),
                            ((pA, pC), (pB, pD)),
                            ((pA, pD), (pB, pC))
                        ]
                        
                        has_valid_perm = False
                        for (t1, t2) in permutations:
                            bad1 = player_stats[t1[0].id]['partners'].get(t1[1].id, 0) > 0
                            bad2 = player_stats[t2[0].id]['partners'].get(t2[1].id, 0) > 0
                            if not bad1 and not bad2:
                                has_valid_perm = True
                                break
                        
                        if not has_valid_perm:
                            continue

                    # Relaxed Constraint check
                    collision_count = 0
                    for existing in match_players:
                        if player_stats[existing.id]['partners'].get(candidate.id, 0) > 0:
                            collision_count += 1
                            
                    if collision_count < len(match_players):
                        valid_next.append(candidate)

                if valid_next:
                    pick = random.choice(valid_next)
                    match_players.append(pick)
                else:
                    break # Dead end

            # Fallback
            if len(match_players) < 4:
                existing_ids = {p.id for p in match_players}
                for c in others:
                    if len(match_players) >= 4: break
                    if c.id not in existing_ids:
                        match_players.append(c)
                        existing_ids.add(c.id)

            # Find Best Permutation
            permutations = [
                ((match_players[0], match_players[1]), (match_players[2], match_players[3])),
                ((match_players[0], match_players[2]), (match_players[1], match_players[3])),
                ((match_players[0], match_players[3]), (match_players[1], match_players[2]))
            ]

            best_match = None
            min_score = float('inf')

            for p in permutations:
                t1, t2 = p
                score = get_heuristic_score(t1[0], t1[1], t2[0], t2[1])
                if score < min_score:
                    min_score = score
                    best_match = {'team1': t1, 'team2': t2}

            if best_match:
                t1 = best_match['team1']
                t2 = best_match['team2']
                
                matches.append({
                    'id': str(uuid.uuid4()),
                    'team1': [t1[0].id, t1[1].id],
                    'team2': [t2[0].id, t2[1].id]
                })

                # Update Stats
                def update_stats(p, partner, opp1, opp2):
                    player_stats[p.id]['gamesPlayed'] += 1
                    player_stats[p.id]['partners'][partner.id] = player_stats[p.id]['partners'].get(partner.id, 0) + 1
                    player_stats[p.id]['opponents'][opp1.id] = player_stats[p.id]['opponents'].get(opp1.id, 0) + 1
                    player_stats[p.id]['opponents'][opp2.id] = player_stats[p.id]['opponents'].get(opp2.id, 0) + 1

                update_stats(t1[0], t1[1], t2[0], t2[1])
                update_stats(t1[1], t1[0], t2[0], t2[1])
                update_stats(t2[0], t2[1], t1[0], t1[1])
                update_stats(t2[1], t2[0], t1[0], t1[1])

                current_round_players.update([p.id for p in t1 + t2])
                current_round_matches += 1

        return matches

def generate_matches(players: List[Dict], games_per_player: int = 4, mode: str = "STRICT_SOCIAL") -> List[Dict]:
    scheduler = Scheduler(players, games_per_player, mode)
    return scheduler.generate_matches()
