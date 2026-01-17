from firebase_functions import firestore_fn, options
from firebase_admin import firestore
import logging

# Initialize Firestore Client Lazily
_db = None

def get_db():
    global _db
    if _db is None:
        _db = firestore.client()
    return _db

@firestore_fn.on_document_written(document="sessions/{sessionId}")
def sync_session_channel(event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]) -> None:
    """
    Triggers when a session is created/updated/deleted.
    Syncs the corresponding 'Huddle' channel allowedUserIds.
    """
    print(f"DEBUG: sync_session_channel triggered for {event.params['sessionId']}")
    db = get_db()
    session_id = event.params["sessionId"]
    new_snapshot = event.data.after
    
    # If session is deleted, delete the channel
    if not new_snapshot.exists:
        print(f"Session {session_id} deleted. Deleting channel.")
        db.collection("channels").document(f"session_{session_id}").delete()
        return

    session_data = new_snapshot.to_dict()
    print(f"DEBUG: Session Data: {session_data}")
    
    # Extract lists of Player Profile IDs
    player_ids = session_data.get("players", [])
    waitlist_ids = session_data.get("waitlist", [])
    club_id = session_data.get("clubId")
    
    all_involved_player_ids = list(set(player_ids + waitlist_ids))
    allowed_user_ids = set()

    # 1. Add Players and Waitlist
    if all_involved_player_ids:
        player_refs = [db.collection("players").document(pid) for pid in all_involved_player_ids]
        player_docs = db.get_all(player_refs)
        
        for pd in player_docs:
            if pd.exists:
                p_data = pd.to_dict()
                uid = p_data.get("linkedUserId")
                if uid:
                    allowed_user_ids.add(uid)
                    
    # 2. Add Club Admins (So they can see the session chat even if not playing)
    if club_id:
        print(f"DEBUG: Fetching admins for club {club_id}")
        club_doc = db.collection("clubs").document(club_id).get()
        if club_doc.exists:
            club_data = club_doc.to_dict()
            # Club Admins are stored as UIDs
            admins = club_data.get("admins", [])
            # Also include the creator of the club just in case? Usually covered by admins.
            # And maybe the session creator?
            
            for admin_uid in admins:
                allowed_user_ids.add(admin_uid)
                
            print(f"DEBUG: Added {len(admins)} admins.")

    if not allowed_user_ids:
        print("DEBUG: No allowed users found. Updating with empty list.")

    # Perform Channel Update
    update_channel(f"session_{session_id}", "huddle", session_id, list(allowed_user_ids), session_data)


@firestore_fn.on_document_written(document="clubs/{clubId}")
def sync_club_channel(event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]) -> None:
    """
    Triggers when a club is created/updated/deleted.
    Syncs the corresponding 'Lobby' channel allowedUserIds.
    """
    db = get_db()
    club_id = event.params["clubId"]
    new_snapshot = event.data.after

    if not new_snapshot.exists:
        print(f"Club {club_id} deleted. Deleting channel.")
        db.collection("channels").document(f"club_{club_id}").delete()
        return

    club_data = new_snapshot.to_dict()
    
    # Members and Admins are stored as Auth UIDs directly per earlier verify.
    members = club_data.get("members", [])
    admins = club_data.get("admins", [])
    
    allowed_user_ids = list(set(members + admins))
    
    update_channel(f"club_{club_id}", "lobby", club_id, allowed_user_ids, club_data)


def update_channel(channel_doc_id, type_str, context_id, allowed_uids, metadata_source):
    """
    Helper to update the channel document idempotently.
    """
    db = get_db()
    channel_ref = db.collection("channels").document(channel_doc_id)
    
    # Construct metadata
    metadata = {}
    if type_str == "huddle":
        # Prefer explicit session name
        session_name = metadata_source.get('name')
        if not session_name:
             # Fallback to date/time if no name
             # scheduledDate is likely an ISO string "YYYY-MM-DDTHH:MM"
             date_val = metadata_source.get('scheduledDate')
             if date_val:
                 # Check if it's a string or timestamp
                 date_str = str(date_val)
                 session_name = f"Session: {date_str}"
             else:
                 # Try legacy fields or unknown
                 session_name = f"Session: {metadata_source.get('date', 'Unknown')}"

        # Location might not exist in session doc, default to 'Club Courts' if generic
        loc = metadata_source.get('location')
        if not loc:
             # Try courts array
             courts = metadata_source.get('courts', [])
             if courts:
                 loc = f"{len(courts)} Courts"
             else:
                 loc = "Club Courts"

        metadata = {
            "name": session_name,
            "location": loc,
            "contextId": context_id
        }
    elif type_str == "lobby":
        metadata = {
            "name": f"{metadata_source.get('name', 'Club')} Lobby",
            "contextId": context_id
        }

    channel_data = {
        "type": type_str,
        "contextId": context_id,
        "allowedUserIds": allowed_uids,
        "metadata": metadata,
        "updatedAt": firestore.SERVER_TIMESTAMP
    }

    # Set with merge to preserve createdAt or other fields if we add them, 
    # but strictly overwrite allowedUserIds
    channel_ref.set(channel_data, merge=True)
    print(f"Updated channel {channel_doc_id} with {len(allowed_uids)} users.")
