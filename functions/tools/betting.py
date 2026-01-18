from datetime import datetime
from firebase_admin import firestore
from google.cloud import firestore as google_firestore

def calculate_bet_outcome(bet, team1_score, team2_score):
    """
    Pure logic to determine if a bet WON, LOST, or PUSH.
    """
    outcome = 'LOST'
    spread = float(bet.get('spreadAtTimeOfBet', 0))
    favorite = int(bet.get('favoriteTeamAtTimeOfBet', 0))
    team_picked = int(bet.get('teamPicked', 0))

    score_diff = 0
    if favorite == 1:
        score_diff = team1_score - team2_score
    elif favorite == 2:
        score_diff = team2_score - team1_score
    else:
        # Pick 'em
        if team_picked == 1:
            score_diff = team1_score - team2_score
        else:
            score_diff = team2_score - team1_score
    
    if spread == 0:
        if score_diff > 0: outcome = 'WON'
        elif score_diff < 0: outcome = 'LOST'
        else: outcome = 'PUSH'
    else:
        user_picked_favorite = (team_picked == favorite)
        if user_picked_favorite:
            if score_diff > spread: outcome = 'WON'
            elif score_diff == spread: outcome = 'PUSH'
            else: outcome = 'LOST'
        else:
            # Picked Underdog
            if score_diff < spread: outcome = 'WON' # Lost by less than spread, or won outright
            elif score_diff == spread: outcome = 'PUSH'
            else: outcome = 'LOST' # Fav covered
            
    return outcome

def resolve_bets_for_match(db, match_id, team1_score, team2_score):
    """
    Finds and resolves all OPEN bets for a match.
    Uses a transaction per bet to ensure wallet integrity.
    """
    print(f"Resolving bets for match {match_id}")
    
    # 1. Query Bets
    bets_ref = db.collection('bets')
    query = bets_ref.where(filter=firestore.FieldFilter('matchId', '==', match_id)).where(filter=firestore.FieldFilter('status', '==', 'OPEN'))
    bets = list(query.stream())
    
    if not bets:
        print(f"Match {match_id}: No OPEN bets found.")
        return

    print(f"Match {match_id}: Found {len(bets)} OPEN bets.")

    # 2. Transactional Update per Bet
    for bet_doc in bets:
        try:
            transaction = db.transaction()
            _resolve_single_bet(transaction, bet_doc.reference, team1_score, team2_score)
        except Exception as e:
            print(f"Error resolving bet {bet_doc.id}: {e}")

@firestore.transactional
def _resolve_single_bet(transaction, bet_ref, t1_score, t2_score):
    bet_snapshot = bet_ref.get(transaction=transaction)
    if not bet_snapshot.exists: return

    bet = bet_snapshot.to_dict()
    if bet.get('status') != 'OPEN': return

    outcome = calculate_bet_outcome(bet, t1_score, t2_score)
    
    outcome = calculate_bet_outcome(bet, t1_score, t2_score)
    
    db = firestore.client()
    user_ref = db.collection('users').document(bet['userId'])

    user_snapshot = user_ref.get(transaction=transaction)
    if not user_snapshot.exists:
        # Proceed resolving bet even if user missing? Probably log error, but let's mark bet error.
        # Just return for now.
        return

    user_data = user_snapshot.to_dict()
    current_balance = user_data.get('walletBalance', 0)
    
    payout = 0
    new_balance = current_balance
    amount = float(bet.get('amount', 0))

    if outcome == 'WON':
        payout = amount * 2
        new_balance += payout
    elif outcome == 'PUSH':
        payout = amount
        new_balance += payout
    
    # Update User
    if outcome != 'LOST':
        transaction.update(user_ref, {'walletBalance': new_balance})

    # Update Bet
    transaction.update(bet_ref, {
        'status': outcome,
        'resolvedAt': firestore.SERVER_TIMESTAMP,
        'payout': payout,
        'finalScore': f"{t1_score}-{t2_score}"
    })


def refund_bets_for_match(db, match_id):
    """
    Refunds all OPEN bets for a match (e.g. unplayed).
    """
    print(f"Refunding bets for match {match_id}")
    bets_ref = db.collection('bets')
    query = bets_ref.where(filter=firestore.FieldFilter('matchId', '==', match_id)).where(filter=firestore.FieldFilter('status', '==', 'OPEN'))
    bets = list(query.stream())

    for bet_doc in bets:
        try:
            transaction = db.transaction()
            _refund_single_bet(transaction, bet_doc.reference)
        except Exception as e:
            print(f"Error refunding bet {bet_doc.id}: {e}")

@firestore.transactional
def _refund_single_bet(transaction, bet_ref):
    bet_snapshot = bet_ref.get(transaction=transaction)
    if not bet_snapshot.exists: return
    bet = bet_snapshot.to_dict()
    if bet.get('status') != 'OPEN': return

    # db = bet_ref.client # ERROR
    db = firestore.client()
    user_ref = db.collection('users').document(bet['userId'])
    
    user_snapshot = user_ref.get(transaction=transaction)
    if user_snapshot.exists:
        amount = float(bet.get('amount', 0))
        current = user_snapshot.to_dict().get('walletBalance', 0)
        transaction.update(user_ref, {'walletBalance': current + amount})

    transaction.update(bet_ref, {
        'status': 'REFUNDED',
        'resolvedAt': firestore.SERVER_TIMESTAMP,
        'payout': float(bet.get('amount', 0)),
        'note': 'Match unplayed'
    })

def settle_bets_for_substitution(db, matches, old_player_id):
    """
    Settles bets for matches where a player was substituted.
    """
    print(f"Settling bets for substitution of {old_player_id}")
    
    for match in matches:
        match_id = match['id']
        bets_ref = db.collection('bets')
        query = bets_ref.where(filter=firestore.FieldFilter('matchId', '==', match_id)).where(filter=firestore.FieldFilter('status', '==', 'OPEN'))
        bets = list(query.stream())

        is_team_1 = old_player_id in match.get('team1', [])
        old_player_team = 1 if is_team_1 else 2

        for bet_doc in bets:
            # We pass the logic params to the transaction
            transaction = db.transaction()
            _settle_sub_bet(transaction, bet_doc.reference, old_player_team)

@firestore.transactional
def _settle_sub_bet(transaction, bet_ref, old_player_team):
    bet_snapshot = bet_ref.get(transaction=transaction)
    if not bet_snapshot.exists: return
    bet = bet_snapshot.to_dict()
    
    team_picked = int(bet.get('teamPicked', 0))
    amount = float(bet.get('amount', 0))

    status = ''
    payout = 0
    note = ''
    
    # db = bet_ref.client # ERROR
    db = firestore.client()
    user_ref = db.collection('users').document(bet['userId'])

    if team_picked == old_player_team:
        # Loss (Forfeit)
        status = 'LOST'
        payout = 0
        note = 'Player substitution (Forfeit)'
    else:
        # Refund
        status = 'REFUNDED'
        payout = amount
        note = 'Opposing player substituted'
        
        user_snapshot = user_ref.get(transaction=transaction)
        if user_snapshot.exists:
            current = user_snapshot.get('walletBalance') or 0
            transaction.update(user_ref, {'walletBalance': current + payout})

    transaction.update(bet_ref, {
        'status': status,
        'resolvedAt': firestore.SERVER_TIMESTAMP,
        'payout': payout,
        'note': note
    })
