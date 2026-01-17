from firebase_functions import https_fn
from firebase_admin import initialize_app

initialize_app()

# Import tools to register Cloud Functions
from tools.communication_hub import sync_session_channel, sync_club_channel