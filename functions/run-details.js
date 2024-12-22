const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const STRAVA_API_URL = "https://www.strava.com/api/v3/athlete/activities";

    // Extract token from Authorization header
    const authHeader = event.headers['Authorization'] || event.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return {
            statusCode: 401,
            headers: {
                "Access-Control-Allow-Origin": "https://nate-sepich.github.io", // Added CORS header
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
            },
            body: JSON.stringify({ error: "Access token is missing." }),
        };
    }

    try {
        const activitiesResponse = await fetch(STRAVA_API_URL, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!activitiesResponse.ok) {
            throw new Error(`Failed to fetch run details: ${activitiesResponse.statusText}`);
        }

        const activitiesData = await activitiesResponse.json();

        const runDetails = activitiesData
            .filter(activity => activity.type === "Run")
            .map(activity => ({
                id: activity.id,
                name: activity.name,
                distance: (activity.distance * 0.000621371).toFixed(2), // Convert meters to miles
                duration: (activity.moving_time / 60).toFixed(2), // Convert seconds to minutes
                start_date: activity.start_date,
            }));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "https://nate-sepich.github.io", // Added CORS header
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
            },
            body: JSON.stringify(runDetails),
        };
    } catch (error) {
        console.error("Error fetching run details:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "https://nate-sepich.github.io", // Added CORS header
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
            },
            body: JSON.stringify({ error: error.message }),
        };
    }
};
