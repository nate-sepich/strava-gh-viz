# app.py

from auth import get_access_token
from stravalib import Client
from flask import Flask, render_template
import pandas as pd
import arrow
from collections import defaultdict

app = Flask(__name__)

# Get the access token for Strava API
ACCESS_TOKEN = get_access_token()

# Initialize the Strava client with the access token
STRAVA_CLIENT = Client(access_token=ACCESS_TOKEN)

def fetch_user_profile():
    """
    Fetch the user's profile information from Strava.
    """
    try:
        client = STRAVA_CLIENT
        athlete = client.get_athlete()
        return {
            'name': athlete.firstname + ' ' + athlete.lastname,
            'avatar': athlete.profile,
            'total_runs': athlete.stats.all_run_totals.count,
            'total_mileage': round(athlete.stats.all_run_totals.distance * 0.000621371,2)
        }
    except Exception as e:
        print(f"Failed to fetch user profile: {e}")
        return {
            'name': 'Unknown',
            'avatar': '',
            'total_runs': 0,
            'total_mileage': 0
        }

def fetch_running_data():
    """
    Fetch the user's running activities from Strava and aggregate daily mileage and duration.
    """
    try:
        client = STRAVA_CLIENT
        activities = client.get_activities()
        daily_mileage = defaultdict(lambda: {'distance': 0, 'duration': 0})

        for activity in activities:
            if activity.type == 'Run':
                local_date = str(arrow.get(activity.start_date).to('local').date())
                # Ensure distance is real (e.g., in miles)
                distance_miles = activity.distance.real * 0.000621371 # Ensure distance is in miles
                duration_minutes = activity.moving_time.real /60  # Ensure moving time is in minutes
                
                # Aggregate data for the same date
                daily_mileage[local_date]['distance'] += distance_miles
                daily_mileage[local_date]['duration'] += duration_minutes
        
        return daily_mileage
    except Exception as e:
        print(f"Failed to fetch running data: {e}")
        return defaultdict(lambda: {'distance': 0, 'duration': 0})

def prepare_heatmap_data(daily_mileage):
    """
    Prepare the data for the heatmap visualization.
    """
    print(daily_mileage)  # Debugging: Print the mileage data to verify input

    # Create a DataFrame with all dates in the current year
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

    # Group by day_of_week and week_of_year, aggregating mileage and concatenating text
    df = df.groupby(['day_of_week', 'week_of_year'], as_index=False).agg({
        'mileage': 'sum', 
        'text': lambda x: '; '.join(x)  # Combine tooltips for multiple activities
    })

    # Pivot DataFrame to prepare heatmap format
    heatmap_data = df.pivot(index='day_of_week', columns='week_of_year', values='mileage').fillna(0)

    # Create a dictionary for heatmap values and tooltips
    heatmap = {
        'z': heatmap_data.values.tolist(),  # Mileage data for the heatmap
        'x': list(map(int, heatmap_data.columns)),    # Week numbers
        'y': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],  # Days of the week
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

@app.route('/')
def index():
    """
    Render the main page with the user's profile and heatmap data.
    """
    user_profile = fetch_user_profile()
    daily_mileage = fetch_running_data()
    heatmap_data = prepare_heatmap_data(daily_mileage)
    
    # Calculate summary statistics for 2024
    total_runs_2024, total_mileage_2024 = calculate_summary_statistics(daily_mileage, 2024)
    
    return render_template(
        'index.html', 
        heatmap_data=heatmap_data, 
        athlete_name=user_profile['name'], 
        current_year=pd.Timestamp.now().year, 
        avatar=user_profile['avatar'], 
        total_runs=user_profile['total_runs'], 
        total_mileage=user_profile['total_mileage'],
        total_runs_2024=total_runs_2024,
        total_mileage_2024=total_mileage_2024
    )

if __name__ == '__main__':
    app.run(debug=True)