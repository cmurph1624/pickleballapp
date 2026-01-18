from tools.sessions import join_session, leave_session
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize (Simulate what Cloud Functions env does automatically)
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': 'pickleball-268d5',
    })

def verify():
    print("Verifying Session Logic...")
    db = firestore.client()
    
    # 1. Create Dummy Session & Player
    player_ref = db.collection('players').document()
    player_id = player_ref.id
    player_ref.set({'name': 'Test Player', 'linkedUserId': 'test_user_123'})
    
    session_ref = db.collection('sessions').document()
    session_id = session_ref.id
    session_ref.set({
        'name': 'Test Session',
        'players': [],
        'waitlist': [],
        'playerLimit': 2
    })
    
    print(f"Created Session {session_id} and Player {player_id}")

    # 2. Test Join
    print("\n--- Testing JOIN ---")
    res = join_session(session_id, player_id)
    print(f"Join Result: {res}")
    
    snap = session_ref.get()
    if player_id in snap.get('players'):
        print("✅ Player successfully added to players list.")
    else:
        print("❌ Player NOT found in players list.")

    # 3. Test Double Join (Should Fail)
    print("\n--- Testing DOUBLE JOIN ---")
    try:
        res = join_session(session_id, player_id)
        if "error" in res:
             print(f"✅ Correctly rejected double join: {res['error']}")
        else:
             print(f"❌ Should have failed but returned: {res}")
    except Exception as e:
        print(f"✅ Correctly caught exception: {e}")

    # 4. Test Leave
    print("\n--- Testing LEAVE ---")
    res = leave_session(session_id, player_id)
    print(f"Leave Result: {res}")
    
    snap = session_ref.get()
    if player_id not in snap.get('players'):
        print("✅ Player successfully removed.")
    else:
        print("❌ Player still in list.")
        
    # Cleanup
    print("\nCleaning up...")
    player_ref.delete()
    session_ref.delete()

if __name__ == "__main__":
    verify()
