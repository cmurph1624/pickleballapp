import firebase_admin
from firebase_admin import firestore

try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app()

db = firestore.client()

def check_latest_session_channel():
    # Get latest session
    sessions = db.collection('sessions').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(1).stream()
    
    latest_session = None
    for s in sessions:
        latest_session = s
        break
    
    if not latest_session:
        print("No sessions found.")
        return

    print(f"Latest Session ID: {latest_session.id}")
    print(f"Session Data: {latest_session.to_dict()}")
    
    # Check for channel
    channel_id = f"session_{latest_session.id}"
    channel_doc = db.collection('channels').document(channel_id).get()
    
    if channel_doc.exists:
        print(f"Channel Found! ID: {channel_id}")
        print(f"Channel Data: {channel_doc.to_dict()}")
    else:
        print(f"Channel MISSING for ID: {channel_id}")

if __name__ == "__main__":
    check_latest_session_channel()
