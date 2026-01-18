from firebase_admin import firestore
from google.cloud import firestore as google_firestore
from tools import ratings, betting
import datetime

def get_db():
    return firestore.client()

def complete_session(session_id):
    """
    Completes a session: Updates ratings, resolves bets, marks complete.
    """
    db = get_db()
    session_ref = db.collection('sessions').document(session_id)
    session_doc = session_ref.get()
    
    if not session_doc.exists:
        return {"error": "Session not found"}
    
    session = session_doc.to_dict()

    matches = session.get('matches', [])
    
    # 1. Fetch Players
    player_ids = set()
    for m in matches:
        player_ids.update(m.get('team1', []))
        player_ids.update(m.get('team2', []))
    
    if not player_ids:
        return {"message": "No players in session, marked complete."}

    # Batch get players
    # chunking if needed (omitted for brevity, usually < 30 players)
    player_refs = [db.collection('players').document(pid) for pid in player_ids]
    player_docs = db.get_all(player_refs)
    
    players_map = {d.id: {**d.to_dict(), 'id': d.id} for d in player_docs if d.exists}
    
    # 2. Process Matches (Sequential Rating Updates)
    scored_matches = [m for m in matches if m.get('team1Score') is not None and m.get('team2Score') is not None]
    unplayed_matches = [m for m in matches if m.get('team1Score') is None or m.get('team2Score') is None]

    print(f"Processing {len(scored_matches)} scored matches for ratings...")

    for match in scored_matches:
        t1_players = [players_map[pid] for pid in match.get('team1', []) if pid in players_map]
        t2_players = [players_map[pid] for pid in match.get('team2', []) if pid in players_map]
        
        updated_players = ratings.update_ratings(match, t1_players, t2_players)
        
        # Update local map
        for p in updated_players:
            players_map[p['id']] = p

    # 3. Save Ratings
    batch = db.batch()
    for pid, p_data in players_map.items():
        # Only update hiddenRating/hiddenRanking
        ref = db.collection('players').document(pid)
        batch.update(ref, {'hiddenRating': p_data.get('hiddenRating', 35.0)})

    batch.commit()
    print("Ratings saved.")

    # 4. Resolve Bets
    for match in scored_matches:
        betting.resolve_bets_for_match(db, match['id'], int(match['team1Score']), int(match['team2Score']))
    
    for match in unplayed_matches:
        betting.refund_bets_for_match(db, match['id'])

    # 5. Mark Complete
    session_ref.update({'status': 'COMPLETED'})
    
    return {"success": True, "message": "Session completed"}

def join_session(session_id, player_id):
    db = get_db()
    session_ref = db.collection('sessions').document(session_id)
    player_ref = db.collection('players').document(player_id)
    
    try:
        result = _join_transaction(db.transaction(), session_ref, player_ref, player_id)
        return {"status": result}
    except Exception as e:
        return {"error": str(e)}

@firestore.transactional
def _join_transaction(transaction, session_ref, player_ref, player_id):
    session_snap = session_ref.get(transaction=transaction)
    if not session_snap.exists: raise Exception("Session not found")
    
    player_snap = player_ref.get(transaction=transaction)
    if not player_snap.exists: raise Exception("Player not found")

    session = session_snap.to_dict()
    player = player_snap.to_dict()
    
    # Club Check
    if session.get('clubId'):
        # Fix: sessions is root, so parent.parent is None. Use client.
        # db = session_ref.client # ERROR: DocumentReference has no client attribute
        db = firestore.client()
        club_ref = db.collection('clubs').document(session['clubId'])
        
        # Re-fetch club outside transaction? Or assumes passed? 
        # Using client from ref
        club_snap = club_ref.get(transaction=transaction) # Included in transaction
        if not club_snap.exists: raise Exception("Club not found")
        
        members = club_snap.get('members') or []
        linked_uid = player.get('linkedUserId')
        
        if not linked_uid: raise Exception("Player not linked to user")
        if linked_uid not in members: raise Exception("Not a club member")

    players_list = session.get('players', [])
    waitlist = session.get('waitlist', [])
    limit = session.get('playerLimit', 0)

    if player_id in players_list: raise Exception("Already joined")
    if player_id in waitlist: raise Exception("Already on waitlist")

    status = "JOINED"
    if limit > 0 and len(players_list) >= limit:
        waitlist.append(player_id)
        transaction.update(session_ref, {'waitlist': waitlist})
        status = "WAITLISTED"
    else:
        players_list.append(player_id)
        transaction.update(session_ref, {'players': players_list})
    
    return status

def leave_session(session_id, player_id):
    db = get_db()
    session_ref = db.collection('sessions').document(session_id)
    
    try:
        _leave_transaction(db.transaction(), session_ref, player_id)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@firestore.transactional
def _leave_transaction(transaction, session_ref, player_id):
    session_snap = session_ref.get(transaction=transaction)
    if not session_snap.exists: raise Exception("Session not found")
    
    session = session_snap.to_dict()
    players = session.get('players', [])
    waitlist = session.get('waitlist', [])
    limit = session.get('playerLimit', 0)

    if player_id in players:
        players.remove(player_id)
        # Promote
        if waitlist and (limit == 0 or len(players) < limit):
            promoted = waitlist.pop(0)
            players.append(promoted)
            # Notification logic omitted for simplicity or can be added as async task
            # Ideally we trigger a notification here.
    elif player_id in waitlist:
        waitlist.remove(player_id)
    else:
        raise Exception("Not in session")

    transaction.update(session_ref, {'players': players, 'waitlist': waitlist})

def substitute_player(session_id, old_player_id, new_player_id):
    db = get_db()
    session_ref = db.collection('sessions').document(session_id)
    
    # 1. Fetch Session
    session_doc = session_ref.get()
    if not session_doc.exists: return {"error": "Session not found"}
    session = session_doc.to_dict()
    
    matches = session.get('matches', [])
    players = session.get('players', [])
    
    # 2. Find Affected Matches
    affected_matches = []
    for m in matches:
        is_unplayed = m.get('team1Score') is None and m.get('team2Score') is None
        has_player = old_player_id in m.get('team1', []) or old_player_id in m.get('team2', [])
        if is_unplayed and has_player:
            affected_matches.append(m)
            
    # 3. Settle Bets
    if affected_matches:
        betting.settle_bets_for_substitution(db, affected_matches, old_player_id)
        
    # 4. Update Matches
    updated_matches = []
    for m in matches:
        new_m = m.copy()
        if m in affected_matches:
            new_m['team1'] = [new_player_id if pid == old_player_id else pid for pid in m.get('team1', [])]
            new_m['team2'] = [new_player_id if pid == old_player_id else pid for pid in m.get('team2', [])]
        updated_matches.append(new_m)
        
    # 5. Update Players List
    new_players_list = [new_player_id if pid == old_player_id else pid for pid in players]
    
    # 6. Save
    session_ref.update({
        'matches': updated_matches,
        'players': new_players_list
    })
    
    return {"success": True}
