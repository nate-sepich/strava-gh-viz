const { getAccessToken } = require('./auth');

exports.handler = async (event, context) => {
    const fetch = (await import('node-fetch')).default;
    const STRAVA_API_URL = "https://www.strava.com/api/v3/athlete/activities";

    const token = event.queryStringParameters.access_token;

    if (!token) {
        return {
            statusCode: 401,
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
            body: JSON.stringify(runDetails),
        };
    } catch (error) {
        console.error("Error fetching run details:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
