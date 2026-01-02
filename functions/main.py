from firebase_functions import https_fn
from firebase_admin import initialize_app, auth
from firebase_functions.params import SecretParam
import google.generativeai as genai

initialize_app()

# 1. DEFINE THE SECRET
# This matches the name you used in the terminal command: 
# firebase functions:secrets:set GOOGLE_API_KEY
GOOGLE_API_KEY = SecretParam('GOOGLE_API_KEY')

from tools.players import lookup_player, add_player
from tools.sessions import create_session, get_upcoming_sessions
from tools.wallet import get_wallet_balance
from tools.betting import get_my_active_bets

# 2. UNLOCK THE SECRET IN THE DECORATOR
@https_fn.on_request(secrets=[GOOGLE_API_KEY])
def chat_agent(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP function that acts as a chatbot agent using Gemini.
    """
    
    # Handle CORS Preflight Request
    if req.method == 'OPTIONS':
        return https_fn.Response(
            status=204,
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
        )

    # Standard CORS headers for main response
    cors_headers = {
        'Access-Control-Allow-Origin': '*'
    }

    # Verify Firebase Auth Token
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return https_fn.Response("Unauthorized: Missing or invalid token", status=401, headers=cors_headers)
    
    id_token = auth_header.split('Bearer ')[1]
    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
    except Exception as e:
        return https_fn.Response(f"Unauthorized: Invalid token - {str(e)}", status=401, headers=cors_headers)

    # 3. CONFIGURE GEMINI USING THE SECRET VALUE
    genai.configure(api_key=GOOGLE_API_KEY.value)

    # Wrap add_player to pre-fill the user ID without the model needing to know
    import functools
    add_player_tool = functools.partial(add_player, result_user_id=uid)
    add_player_tool.__name__ = "add_player"
    add_player_tool.__doc__ = add_player.__doc__

    create_session_tool = functools.partial(create_session, result_user_id=uid)
    create_session_tool.__name__ = "create_session"
    create_session_tool.__doc__ = create_session.__doc__

    get_wallet_balance_tool = functools.partial(get_wallet_balance, result_user_id=uid)
    get_wallet_balance_tool.__name__ = "get_wallet_balance"
    get_wallet_balance_tool.__doc__ = get_wallet_balance.__doc__

    get_my_active_bets_tool = functools.partial(get_my_active_bets, result_user_id=uid)
    get_my_active_bets_tool.__name__ = "get_my_active_bets"
    get_my_active_bets_tool.__doc__ = get_my_active_bets.__doc__

    # Use 'gemini-2.5-flash' for faster, cheaper tool use. 
    model = genai.GenerativeModel('gemini-2.5-flash', tools=[
        lookup_player, 
        add_player_tool, 
        create_session_tool, 
        get_upcoming_sessions,
        get_wallet_balance_tool,
        get_my_active_bets_tool
    ])
    
    # Parse request
    try:
        req_json = req.get_json()
        user_message = req_json.get('message')
        history = req_json.get('history', [])
    except Exception as e:
         return https_fn.Response(f"Error parsing request: {str(e)}", status=400, headers=cors_headers)

    if not user_message:
        return https_fn.Response("Missing 'message' field in request body.", status=400, headers=cors_headers)

    # Enable Automatic Function Calling
    chat = model.start_chat(history=history, enable_automatic_function_calling=True)

    try:
        response = chat.send_message(user_message)
        return https_fn.Response(response.text, headers=cors_headers)
    except Exception as e:
        error_msg = f"Error communicating with agent: {str(e)}"
        try:
            # Attempt to list models to help debug "Model not found" errors
            models = list(genai.list_models())
            model_names = [m.name for m in models]
            error_msg += f"\n\nAvailable models: {model_names}"
        except Exception as list_err:
            error_msg += f"\n\nCould not list models: {str(list_err)}"
        
        return https_fn.Response(error_msg, status=500, headers=cors_headers)