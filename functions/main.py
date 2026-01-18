from firebase_functions import https_fn
from firebase_admin import initialize_app

initialize_app()

# Import tools to register Cloud Functions
from tools.communication_hub import sync_session_channel, sync_club_channel
from tools import scheduler

@https_fn.on_call()
def generate_schedule(req: https_fn.CallableRequest) -> any:
    """
    Generates a schedule for pickleball sessions.
    Input: { players: [], gamesPerPlayer: 4, mode: "STRICT_SOCIAL" }
    """
    data = req.data
    players = data.get("players", [])
    games_per_player = data.get("gamesPerPlayer", 4)
    mode = data.get("mode", "STRICT_SOCIAL")

    # Validate input
    if not players or len(players) < 4:
        return {"error": "At least 4 players are required."}

    matches = scheduler.generate_matches(players, games_per_player, mode)
    return {"matches": matches}

from tools import sessions

@https_fn.on_call()
def complete_session(req: https_fn.CallableRequest) -> any:
    """Completes a session (ratings, bets). Input: { sessionId: "..." }"""
    session_id = req.data.get("sessionId")
    if not session_id: return {"error": "Missing sessionId"}
    return sessions.complete_session(session_id)

@https_fn.on_call()
def join_session(req: https_fn.CallableRequest) -> any:
    """Joins a session. Input: { sessionId: "...", playerId: "..." }"""
    session_id = req.data.get("sessionId")
    player_id = req.data.get("playerId")
    if not session_id or not player_id: return {"error": "Missing params"}
    return sessions.join_session(session_id, player_id)

@https_fn.on_call()
def leave_session(req: https_fn.CallableRequest) -> any:
    """Leaves a session. Input: { sessionId: "...", playerId: "..." }"""
    session_id = req.data.get("sessionId")
    player_id = req.data.get("playerId")
    if not session_id or not player_id: return {"error": "Missing params"}
    return sessions.leave_session(session_id, player_id)

@https_fn.on_call()
def substitute_player(req: https_fn.CallableRequest) -> any:
    """Substitutes a player. Input: { sessionId: "...", oldPlayerId: "...", newPlayerId: "..." }"""
    session_id = req.data.get("sessionId")
    old_pid = req.data.get("oldPlayerId")
    new_pid = req.data.get("newPlayerId")
    if not all([session_id, old_pid, new_pid]): return {"error": "Missing params"}
    return sessions.substitute_player(session_id, old_pid, new_pid)

from tools import admin

@https_fn.on_call()
def reset_world(req: https_fn.CallableRequest) -> any:
    """Resets all bets and wallets. Input: {} (No params needed)"""
    # Optional: Add admin check here using req.auth.uid
    return admin.reset_bets_and_wallets()