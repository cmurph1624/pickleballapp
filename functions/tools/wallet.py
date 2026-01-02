from firebase_admin import firestore

def get_wallet_balance(result_user_id: str):
    """
    Retrieves the current wallet balance of the user.
    
    Args:
        result_user_id: (Hidden) The ID of the authenticated user.
    """
    db = firestore.client()
    
    if not result_user_id:
        return "Error: Could not identify user."

    user_doc = db.collection("users").document(result_user_id).get()
    
    if not user_doc.exists:
        return "User profile not found."
    
    data = user_doc.to_dict()
    balance = data.get("walletBalance", 0.0)
    
    return f"Your current wallet balance is ${balance:.2f}"
