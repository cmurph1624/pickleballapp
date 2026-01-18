import math

def update_ratings(match, team1_players, team2_players):
    """
    Calculates ELO rating updates for a match.
    Args:
        match: Dict containing score info (team1Score, team2Score).
        team1_players: List of player dicts for Team 1.
        team2_players: List of player dicts for Team 2.
    Returns:
        List of all updated player dicts (both teams).
    """
    # 0. Parse Scores
    try:
        t1_score = int(match.get('team1Score', 0))
        t2_score = int(match.get('team2Score', 0))
    except ValueError:
        return team1_players + team2_players  # No change if invalid scores

    # 1. Calculate Team Averages
    def get_rating(p):
        return float(p.get('hiddenRating') or p.get('hiddenRanking') or 35.0)

    t1_avg = sum(get_rating(p) for p in team1_players) / len(team1_players) if team1_players else 35.0
    t2_avg = sum(get_rating(p) for p in team2_players) / len(team2_players) if team2_players else 35.0

    # 2. ELO Parameters
    K_FACTOR = 4.0
    SCALE_FACTOR = 40.0

    # 3. Expected Score for Team 1
    # Formula: 1 / (1 + 10 ^ ((RatingB - RatingA) / Scale))
    expected_t1 = 1.0 / (1.0 + math.pow(10, (t2_avg - t1_avg) / SCALE_FACTOR))

    # 4. Actual Score (1 = Win, 0 = Loss, 0.5 = Draw)
    if t1_score > t2_score:
        actual_t1 = 1.0
    elif t1_score < t2_score:
        actual_t1 = 0.0
    else:
        actual_t1 = 0.5

    # 5. Calculate Change
    rating_change = K_FACTOR * (actual_t1 - expected_t1)
    
    print(f"DEBUG: T1 Avg: {t1_avg:.2f}, T2 Avg: {t2_avg:.2f}, Exp: {expected_t1:.2f}, Actual: {actual_t1}, Change: {rating_change:.2f}")

    # 6. Apply to Players
    updated_all = []

    # Helper to apply change
    def apply_change(players, change):
        updated_list = []
        for p in players:
            current = get_rating(p)
            new_rating = max(0.0, current + change)
            # Create a copy with updated rating
            new_p = p.copy()
            new_p['hiddenRating'] = new_rating
            # Normalize key if inconsistent
            if 'hiddenRanking' in new_p:
                new_p['hiddenRanking'] = new_rating
            updated_list.append(new_p)
        return updated_list

    updated_all.extend(apply_change(team1_players, rating_change))
    updated_all.extend(apply_change(team2_players, -rating_change))

    return updated_all
