import firebase_admin
from firebase_admin import credentials, firestore
import datetime

# Initialize with default credentials (assumes local environment has access via gcloud auth or similar)
# Since we are running in the user's environment where they deploy functions, they should have credentials.
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app()

db = firestore.client()

def backfill():
    print("Starting backfill to trigger Channel creation...")
    
    # 1. Touch Clubs
    clubs_ref = db.collection('clubs')
    clubs = clubs_ref.stream()
    count_clubs = 0
    for club in clubs:
        print(f"Touching Club: {club.id}")
        # Update a dummy field or existing timestamp to trigger the function
        club.reference.update({
            'lastBackfillTrigger': firestore.SERVER_TIMESTAMP
        })
        count_clubs += 1
    
    print(f"Touched {count_clubs} clubs.")

    # 2. Touch Sessions
    sessions_ref = db.collection('sessions')
    sessions = sessions_ref.stream()
    count_sessions = 0
    for session in sessions:
        print(f"Touching Session: {session.id}")
        session.reference.update({
            'lastBackfillTrigger': firestore.SERVER_TIMESTAMP
        })
        count_sessions += 1
    
    print(f"Touched {count_sessions} sessions.")
    print("Backfill complete. Cloud Functions should now be processing channels.")

if __name__ == "__main__":
    backfill()
