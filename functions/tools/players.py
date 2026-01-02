from firebase_admin import firestore

def lookup_player(name: str):
    """Searches for a player by name in Firestore."""
    db = firestore.client()
    # Note: Firestore queries are exact match/case-sensitive by default.
    # In a real app, ensure you store lowercase names or use a dedicated search service.
    query = db.collection("players").where("firstName", "==", name).limit(1)
    results = query.stream()
    
    player_data = None
    for doc in results:
        player_data = doc.to_dict()
        player_data['id'] = doc.id
        break
        
    if player_data:
        return f"Found player: {player_data}"
    else:
        return f"Player '{name}' not found."

def add_player(first_name: str, last_name: str, rating: float, gender: str, result_user_id: str = None):
    """
    Adds a new player to Firestore.
    
    Args:
        first_name: First name of the player.
        last_name: Last name of the player.
        rating: DUPR doubles rating.
        gender: 'Male' or 'Female'. If not known, ask the user.
        result_user_id: (Hidden) The ID of the user creating the player. Do not ask the user for this.
    """
    db = firestore.client()
    hidden_rating = rating * 20
    
    new_player_ref = db.collection("players").document()
    new_player_ref.set({
        "firstName": first_name,
        "lastName": last_name,
        "duprDoubles": rating,
        "duprSingles": None,
        "gender": gender,
        "hiddenRating": hidden_rating,
        "linkedUserEmail": None,
        "createdBy": result_user_id,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP
    })
    
    return f"Successfully added player '{first_name} {last_name}' (Gender: {gender}) with rating {rating}. ID: {new_player_ref.id}"
