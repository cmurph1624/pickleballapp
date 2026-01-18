from firebase_admin import firestore
from google.cloud import firestore as google_firestore

def get_db():
    return firestore.client()

def reset_bets_and_wallets(target_balance=500.0):
    """
    NUCLEAR OPTION: Deletes ALL bets and resets ALL users to target_balance.
    """
    db = get_db()
    
    print("WARNING: INITIATING GLOBAL BETTING RESET")
    
    # 1. Delete ALL Bets
    bets_ref = db.collection('bets')
    # Use recursive delete helper if available, or batched delete
    # recursive_delete(bets_ref) is safer but requires more setup or cloud tool.
    # For now, batch delete in chunks.
    
    deleted_count = 0
    while True:
        # Get a batch of documents
        docs = list(bets_ref.limit(500).stream())
        if not docs:
            break
            
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()
        deleted_count += len(docs)
        print(f"Deleted {len(docs)} bets...")
        
    print(f"Total deleted bets: {deleted_count}")
    
    # 2. Reset ALL Wallets
    users_ref = db.collection('users')
    updated_count = 0
    
    # Process in batches
    docs = list(users_ref.stream()) # Fetch all users (assuming < 10k for now)
    
    # Create batches of 500
    batch_size = 500
    for i in range(0, len(docs), batch_size):
        batch = db.batch()
        chunk = docs[i:i + batch_size]
        for doc in chunk:
            batch.update(doc.reference, {'walletBalance': target_balance})
        batch.commit()
        updated_count += len(chunk)
        print(f"Reset {len(chunk)} wallets...")

    print(f"Total users reset: {updated_count}")
    
    return {
        "success": True, 
        "deletedBets": deleted_count, 
        "resetUsers": updated_count
    }
