# Strava Running Activity Visualization

## Introduction
This is a simple Flask-based UI with an authentication mechanism that connects to the Strava API to fetch and display the developer's running activities over the last year. It visualizes the data as a heatmap, providing a summary of total runs and mileage.

---

## Example
### Example Page

![Example Page](docs/page.png)

### Example Tooltip

![Example Tooltip](docs/tooltip.png)

---

## Requirements
To use this application, you need:
- **Python** (v3.7+ recommended)
- A **Strava Developer Account** with an application created
- Strava Developer **Client ID** and **Client Secret**

---

## Setup and Installation

1. **Clone the Repository**  
    Clone the project from your repository to your local machine.

    ```bash
    git clone https://github.com/nate-sepich/strava-gh-viz.git
    cd strava-gh-viz
    ```

2. **Install Dependencies**  
    Install all the required dependencies using pip:

    ```bash
    cd flask-app
    pip install -r requirements.txt
    ```

3. **Setup Environment Variables**  
    Create a `.env` file in the flask-app folder and add your Strava credentials:

    ```plaintext
    CLIENT_ID=<your_client_id>
    CLIENT_SECRET=<your_client_secret>
    ```

4. **Run the Flask Application**  
    Navigate to the `flask-app` directory and start the app:

    ```bash
    cd flask-app
    python app.py
    ```

5. **Authorize the Application**  
    Open the authorization link printed in the terminal.
    Grant access to your Strava data.
    After successful authorization, the application will redirect you to the UI.

---

## Features
- **Authentication**: Uses OAuth 2.0 to securely fetch your Strava activities.
- **Data Visualization**: Displays a GitHub-like heatmap of your running activity.
- **Summary Statistics**: Provides a summary of total runs and total mileage for the year.

---

## How It Works
### File Overview
- **app.py**  
  Handles the core Flask application logic:
  - Fetches user profile and running activity data from Strava.
  - Prepares the data for visualization.
  - Renders the heatmap and summary statistics on the UI.

- **auth.py**  
  Manages Strava authentication:
  - Refreshes expired tokens.
  - Guides the user through the authorization process.

- **index.html**  
  Provides the front-end structure and heatmap rendering logic.
  Includes tooltips and a color-coded legend for activity intensity.

---

## Usage
### Starting the App
Once the app is running locally, open the provided link in your browser. You’ll see:
- A heatmap representing your running activity intensity.
- A summary of your total runs and mileage.

### Understanding the Heatmap
- Each square represents a day of the week for a specific week of the year.
- Colors indicate activity intensity:
  - Gray: No activity
  - Light green: Low intensity
  - Dark green: High intensity

---

## Notes
- Ensure your Strava Developer App is set up correctly with the necessary scopes:
  - `read_all`
  - `profile:read_all`
  - `activity:read_all`
- If your Strava token expires, the app will automatically refresh it.

---

## Troubleshooting
### No Data Displayed
Ensure that your Strava account has activities logged in the past year and that the app is authorized to read your data.

### Authorization Issues
Double-check the `CLIENT_ID` and `CLIENT_SECRET` values in the `.env` file.

### Missing Heatmap or UI Elements
Ensure your `index.html` and CSS are correctly linked and not modified unintentionally.

---

## Future Enhancements
- Add filters for activity types and date ranges.
- Improve mobile responsiveness.
- Integrate additional metrics like elevation gain or average pace.

---

## License
This project is licensed under the MIT License.