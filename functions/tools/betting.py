from firebase_admin import firestore

def get_my_active_bets(result_user_id: str):
    """
    Retrieves a list of the user's active (OPEN) bets.
    
    Args:
        result_user_id: (Hidden) The ID of the authenticated user.
    """
    db = firestore.client()
    
    if not result_user_id:
        return "Error: Could not identify user."

    query = db.collection("bets")\
        .where("userId", "==", result_user_id)\
        .where("status", "==", "OPEN")
        
    results = query.stream()
    
    bets = []
    for doc in results:
        data = doc.to_dict()
        amount = data.get("amount", 0)
        team_picked = data.get("teamPicked", "Unknown")
        match_id = data.get("matchId", "Unknown")
        # In a real app, we might want to fetch match details here to give context (e.g. "Bet on Team 1 vs Team 2")
        # For now, we return the raw info.
        bets.append(f"- ${amount:.2f} on Team {team_picked} (Match ID ending in ...{match_id[-4:]})")
        
    if not bets:
        return "You have no active bets."
        
    return "Your Active Bets:\n" + "\n".join(bets)
