# auth.py

import time
from stravalib import Client
from flask import Flask, request
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Strava API credentials
CLIENT_ID = os.getenv('CLIENT_ID')
CLIENT_SECRET = os.getenv('CLIENT_SECRET')

app = Flask(__name__)
access_token = None
TOKEN_FILE = 'token.json'

def save_token(token_response):
    """
    Save the token response to a file.
    """
    with open(TOKEN_FILE, 'w') as f:
        json.dump(token_response, f)

def load_token():
    """
    Load the token from a file if it exists.
    """
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'r') as f:
            return json.load(f)
    return None

@app.route('/api/authorized')
def authorized():
    """
    Endpoint to handle the authorization callback from Strava.
    Exchanges the authorization code for an access token.
    """
    global access_token
    code = request.args.get('code')
    client = Client()
    try:
        token_response = client.exchange_code_for_token(
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET,
            code=code
        )
        access_token = token_response['access_token']
        save_token(token_response)
        return "Authorization successful! You can close this window."
    except Exception as e:
        print(f"Authorization failed: {e}")
        return "Authorization failed. Please check the logs for more details."

def refresh_token_if_needed(client):
    """
    Refresh the access token if it has expired.
    """
    token_info = load_token()
    if token_info and token_info.get('expires_at', 0) < time.time():
        try:
            refresh_response = client.refresh_access_token(
                client_id=CLIENT_ID,
                client_secret=CLIENT_SECRET,
                refresh_token=token_info['refresh_token']
            )
            save_token(refresh_response)
            return refresh_response['access_token']
        except Exception as e:
            print(f"Failed to refresh token: {e}")
            return None
    return token_info['access_token'] if token_info else None

def get_access_token():
    """
    Get the access token, refreshing it if necessary.
    If no token is available, prompt the user to authorize the app.
    """
    global access_token
    client = Client()
    access_token = refresh_token_if_needed(client)
    if not access_token:
        authorize_url = client.authorization_url(
            client_id=CLIENT_ID,
            redirect_uri='http://localhost:5000/api/authorized',
            scope=['read_all', 'profile:read_all', 'activity:read_all']
        )
        print(f"Please authorize the app by visiting this URL: {authorize_url}")
        app.run(port=8282)
    return access_token