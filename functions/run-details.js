const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const STRAVA_API_URL = "https://www.strava.com/api/v3/athlete/activities";
    let year = 2024; // Default year

    // Extract username from query parameters
    const username = event.queryStringParameters && event.queryStringParameters.username ? event.queryStringParameters.username : 'default';

    // Extract year from query parameters or request body
    if (event.httpMethod === 'GET') {
        const query = event.queryStringParameters;
        if (query && query.year) {
            year = parseInt(query.year, 10);
            console.log(`Received year parameter from GET: ${year}`);
        }
    } else if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            if (body.year) {
                year = parseInt(body.year, 10);
                console.log(`Received year parameter from POST: ${year}`);
            }
        } catch (error) {
            console.error("Invalid JSON body:", error);
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ error: "Invalid JSON body." }),
            };
        }
    }

    // Calculate UNIX timestamps for the start and end of the selected year
    const startOfYear = Math.floor(new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000);
    const endOfYear = Math.floor(new Date(`${year}-12-31T23:59:59Z`).getTime() / 1000);

    console.log(`Fetching run activities for user '${username}' in year ${year} (Timestamp range: ${startOfYear} - ${endOfYear})`);

    // Define CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "https://nate-sepich.github.io",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };

    // Handle CORS Preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: headers,
            body: '',
        };
    }

    // Extract token from Authorization header
    const authHeader = event.headers['Authorization'] || event.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log("Access token is missing.");
        return {
            statusCode: 401,
            headers: headers,
            body: JSON.stringify({ error: "Access token is missing." }),
        };
    }

    try {
        let page = 1;
        const perPage = 200; // Maximum allowed by Strava
        let allRuns = [];
        let morePages = true;

        console.log(`Fetching run activities starting from page ${page}`);

        while (morePages) {
            const activitiesResponse = await fetch(`${STRAVA_API_URL}?per_page=${perPage}&page=${page}&after=${startOfYear}&before=${endOfYear}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!activitiesResponse.ok) {
                throw new Error(`Failed to fetch run details: ${activitiesResponse.statusText}`);
            }

            const activitiesData = await activitiesResponse.json();
            console.log(`Fetched page ${page} with ${activitiesData.length} activities.`);

            const filteredRuns = activitiesData
                .filter(activity => activity.type === "Run")
                .map(activity => ({
                    id: activity.id,
                    name: activity.name,
                    distance: (activity.distance * 0.000621371).toFixed(2), // Convert meters to miles
                    duration: (activity.moving_time / 60).toFixed(2), // Convert seconds to minutes
                    start_date: activity.start_date,
                }));

            allRuns = allRuns.concat(filteredRuns);
            console.log(`Filtered ${filteredRuns.length} runs from page ${page}. Total runs: ${allRuns.length}`);

            if (activitiesData.length < perPage) {
                morePages = false;
                console.log("No more pages to fetch.");
            } else {
                page += 1;
            }
        }

        console.log(`Total runs fetched for ${username} in ${year}: ${allRuns.length}`);

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify(allRuns),
        };
    } catch (error) {
        console.error("Error fetching run details:", error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
