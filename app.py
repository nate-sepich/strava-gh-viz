import os
import time
import json
from flask import Flask, render_template, request, redirect
from flask_cors import CORS
import pandas as pd
import requests
from collections import defaultdict
from stravalib import Client
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)

# Load environment variables from .env file
load_dotenv()

# Strava API credentials
CLIENT_ID = os.getenv('CLIENT_ID')
CLIENT_SECRET = os.getenv('CLIENT_SECRET')
REDIRECT_URI = os.getenv('REDIRECT_URI')

# Base URL for Netlify functions
NETLIFY_BASE_URL = os.getenv('NETLIFY_BASE_URL')

access_token = None

def save_token(token_response):
    """
    Save the token response to environment variables.
    """
    os.environ['ACCESS_TOKEN'] = token_response['access_token']
    os.environ['REFRESH_TOKEN'] = token_response['refresh_token']
    os.environ['EXPIRES_AT'] = str(token_response['expires_at'])

def load_token():
    """
    Load the token from environment variables if it exists.
    """
    if 'ACCESS_TOKEN' in os.environ and 'REFRESH_TOKEN' in os.environ and 'EXPIRES_AT' in os.environ:
        return {
            'access_token': os.environ['ACCESS_TOKEN'],
            'refresh_token': os.environ['REFRESH_TOKEN'],
            'expires_at': int(os.environ['EXPIRES_AT']),
        }
    return None

@app.route('/authorized')
def authorized():
    """
    Endpoint to handle the authorization callback from Strava.
    Exchanges the authorization code for an access token.
    """
    global access_token
    code = request.args.get('code')
    if not code:
        return "No authorization code was provided.", 400
    client = Client()
    try:
        token_response = client.exchange_code_for_token(
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET,
            code=code
        )
        access_token = token_response['access_token']
        save_token(token_response)
        return redirect('/')
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
            redirect_uri=REDIRECT_URI,
            scope=['read_all', 'profile:read_all', 'activity:read_all']
        )
        return authorize_url
    return access_token

@app.route('/health')
def health_check():
    return {"status": "healthy"}

@app.route('/')
def index():
    """
    Render the main page with the user's profile and heatmap data.
    """
    access_token = get_access_token()
    if access_token.startswith('http'):
        return redirect(access_token)

    user_profile = fetch_user_profile()
    daily_mileage = fetch_running_data()
    heatmap_data = prepare_heatmap_data(daily_mileage)

    # Calculate summary statistics for the current year
    current_year = pd.Timestamp.now().year
    total_runs, total_mileage = calculate_summary_statistics(daily_mileage, current_year)
    
    return render_template(
        'index.html', 
        heatmap_data=heatmap_data, 
        athlete_name=user_profile['name'], 
        current_year=current_year, 
        avatar=user_profile['avatar'], 
        total_runs=user_profile['total_runs'], 
        total_mileage=user_profile['total_mileage'],
        total_runs_current_year=total_runs,
        total_mileage_current_year=total_mileage
    )

def fetch_user_profile():
    """
    Fetch the user's profile information from the Netlify function.
    """
    try:
        response = requests.get(f"{NETLIFY_BASE_URL}/athlete-profile")
        response.raise_for_status()  # Raise exception for HTTP errors
        data = response.json()
        return {
            'name': data.get('name', 'Unknown'),
            'avatar': data.get('avatar', ''),
            'total_runs': data.get('total_runs', 0),
            'total_mileage': data.get('total_mileage', 0)
        }
    except Exception as e:
        print(f"Failed to fetch user profile from Netlify: {e}")
        return {
            'name': 'Unknown',
            'avatar': '',
            'total_runs': 0,
            'total_mileage': 0
        }

def fetch_running_data():
    """
    Fetch the user's running activities from the Netlify function.
    """
    try:
        response = requests.get(f"{NETLIFY_BASE_URL}/run-details")
        response.raise_for_status()  # Raise exception for HTTP errors
        data = response.json()

        # Convert response to defaultdict format
        daily_mileage = defaultdict(lambda: {'distance': 0, 'duration': 0})
        for run in data:
            local_date = pd.to_datetime(run['start_date']).strftime('%Y-%m-%d')
            daily_mileage[local_date]['distance'] += float(run['distance'])
            daily_mileage[local_date]['duration'] += float(run['duration'])

        return daily_mileage
    except Exception as e:
        print(f"Failed to fetch running data from Netlify: {e}")
        return defaultdict(lambda: {'distance': 0, 'duration': 0})

def prepare_heatmap_data(daily_mileage):
    """
    Prepare the data for the heatmap visualization.
    """
    current_year = pd.Timestamp.now().year
    all_dates = pd.date_range(start=f'{current_year}-01-01', end=f'{current_year}-12-31')
    df = pd.DataFrame(all_dates, columns=['date'])

    # Add day_of_week and week_of_year columns
    df['day_of_week'] = df['date'].dt.dayofweek
    df['week_of_year'] = df['date'].dt.isocalendar().week

    # Map mileage and text data from daily_mileage
    df['mileage'] = df['date'].map(lambda date: daily_mileage.get(str(date.date()), {}).get('distance', 0))
    df['text'] = df['date'].map(
        lambda date: (
            f"{daily_mileage[str(date.date())]['distance']:.2f} miles in {daily_mileage[str(date.date())]['duration']:.2f} minutes on {date.date()}"
            if str(date.date()) in daily_mileage else "No activity"
        )
    )

    # Adjust week_of_year to align weeks starting from 0
    df['week_of_year'] = df['week_of_year'] - 1

    # Group by day_of_week and week_of_year
    df = df.groupby(['day_of_week', 'week_of_year'], as_index=False).agg({
        'mileage': 'sum', 
        'text': lambda x: '; '.join(x)
    })

    # Pivot DataFrame to prepare heatmap format
    heatmap_data = df.pivot(index='day_of_week', columns='week_of_year', values='mileage').fillna(0)

    # Create a dictionary for heatmap values and tooltips
    heatmap = {
        'z': heatmap_data.values.tolist(),
        'x': list(map(int, heatmap_data.columns)),
        'y': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        'text': df.pivot(index='day_of_week', columns='week_of_year', values='text').fillna("").values.tolist()
    }

    return heatmap

def calculate_summary_statistics(daily_mileage, year):
    """
    Calculate the total runs and total mileage for a specific year.
    """
    total_runs = 0
    total_mileage = 0.0

    for date_str, data in daily_mileage.items():
        date = pd.to_datetime(date_str)
        if date.year == year:
            total_runs += 1
            total_mileage += data['distance']

    return total_runs, round(total_mileage, 2)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
