
import os
import json
from stravalib import Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

CLIENT_ID = os.getenv('CLIENT_ID')
CLIENT_SECRET = os.getenv('CLIENT_SECRET')
REDIRECT_URI = os.getenv('REDIRECT_URI')

def authenticate():
    client = Client()
    # authorize_url = client.authorization_url(
    #     client_id=CLIENT_ID,
    #     redirect_uri=REDIRECT_URI,
    #     scope=['read_all', 'profile:read_all', 'activity:read_all']
    # )
    # print(f"Please authorize the app by visiting this URL: {authorize_url}")
    code = "a4eeaf2194bafada7969a167015b4628fa64924f"
    token_response = client.exchange_code_for_token(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        code=code
    )
    return token_response

def fetch_data(client: Client, access_token):
    client.access_token = access_token
    athlete = client.get_athlete()
    activities = client.get_activities(limit=200)
    run_details = []
    for activity in activities:
        if activity.type == 'Run':
            run_details.append({
                'id': activity.id,
                'name': activity.name,
                'distance': round(activity.distance.real / 1609.34, 2),  # meters to miles
                'duration': round(activity.moving_time.real / 60, 2),  # seconds to minutes
                'start_date': activity.start_date.strftime('%Y-%m-%d')
            })
    return {
        'athlete': {
            'name': athlete.firstname + ' ' + athlete.lastname,
            'avatar': athlete.profile,
        },
        'run_details': run_details
    }

def save_to_json(data, filename='strava_data.json'):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)
    print(f"Data saved to {filename}")

def main():
    token_response = authenticate()
    client = Client()
    data = fetch_data(client, token_response['access_token'])
    save_to_json(data)

if __name__ == '__main__':
    main()