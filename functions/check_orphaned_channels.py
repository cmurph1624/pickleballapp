import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': 'pickleball-268d5',
    })

db = firestore.client()

def check_orphans():
    print("Checking for orphaned session channels...")
    
    # Get all channels that look like session channels
    channels = db.collection('channels').where('type', '==', 'huddle').stream()
    
    orphans = 0
    total = 0
    
    for channel in channels:
        c_data = channel.to_dict()
        c_id = channel.id
        
        # We expect session channels to have ID "session_{sessionId}"
        if not c_id.startswith("session_"):
            print(f"Skipping non-standard huddle ID: {c_id}")
            continue
            
        total += 1
        session_id = c_id.replace("session_", "")
        
        # Check if session exists
        session_doc = db.collection('sessions').document(session_id).get()
        
        if not session_doc.exists:
            print(f"Found ORPHAN: Channel {c_id} exists, but Session {session_id} does not.")
            orphans += 1
        else:
            # print(f"Verified: Channel {c_id} matches Session {session_id}")
            pass
            
    print(f"\nScan complete. Found {orphans} orphaned channels out of {total} checked.")

if __name__ == "__main__":
    check_orphans()
