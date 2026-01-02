from firebase_admin import firestore
from datetime import datetime

def create_session(date_time_iso: str, location: str, name: str = "Pickleball Session", result_user_id: str = None):
    """
    Schedules a new pickleball session.
    
    Args:
        date_time_iso: The date and time of the session in ISO 8601 format (e.g., '2023-10-27T18:00:00').
        location: The physical location of the session (e.g., 'Central Park Courts').
        name: A name for the session (optional, defaults to 'Pickleball Session').
        result_user_id: (Hidden) The ID of the user creating the session.
    """
    db = firestore.client()
    
    try:
        dt = datetime.fromisoformat(date_time_iso)
    except ValueError:
        return f"Error: Invalid date format '{date_time_iso}'. Please use ISO 8601 format (YYYY-MM-DDTHH:MM:SS)."

    new_session_ref = db.collection("sessions").document()
    
    session_data = {
        "scheduledDate": dt,
        "location": location,
        "name": name,
        "status": "SCHEDULED",
        "players": [],
        "matches": [],
        "createdBy": result_user_id,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP
    }
    
    if result_user_id:
        # Optimally, add the creator to the session automatically? 
        # For now, let's keep it clean and just create it. 
        # If we wanted to add them, we'd need their Player ID, not User ID.
        pass

    new_session_ref.set(session_data)
    
    return f"Successfully scheduled session '{name}' at {location} for {dt}. ID: {new_session_ref.id}"

def get_upcoming_sessions(limit: int = 5):
    """
    Retrieves a list of upcoming scheduled sessions.
    
    Args:
        limit: The maximum number of sessions to return (default 5).
    """
    db = firestore.client()
    now = datetime.now()
    
    query = db.collection("sessions")\
        .where("scheduledDate", ">", now)\
        .order_by("scheduledDate")\
        .limit(limit)
        
    results = query.stream()
    
    sessions = []
    for doc in results:
        data = doc.to_dict()
        # Convert timestamp to string for display
        date_str = str(data.get('scheduledDate', 'Unknown'))
        sessions.append(f"- {data.get('name')} on {date_str} at {data.get('location', 'Unknown location')}")
        
    if not sessions:
        return "No upcoming sessions found."
        
    return "Upcoming Sessions:\n" + "\n".join(sessions)
