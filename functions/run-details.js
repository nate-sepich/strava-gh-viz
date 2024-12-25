const { getAccessToken } = require('./auth');
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const STRAVA_API_URL = "https://www.strava.com/api/v3/athlete/activities";

    let afterTimestamp, beforeTimestamp;
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        if (body.startDate && body.endDate) {
            afterTimestamp = Math.floor(new Date(body.startDate).getTime() / 1000);
            beforeTimestamp = Math.floor(new Date(body.endDate).getTime() / 1000);
        }
    }
    // Fallback: last 365 days if none provided
    if (!afterTimestamp || !beforeTimestamp) {
        const now = new Date();
        const start = new Date();
        start.setDate(now.getDate() - 365);
        afterTimestamp = Math.floor(start.getTime() / 1000);
        beforeTimestamp = Math.floor(now.getTime() / 1000);
    }

    console.log(`Fetching runs from ${afterTimestamp} to ${beforeTimestamp}`);

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
            const activitiesResponse = await fetch(`${STRAVA_API_URL}?per_page=${perPage}&page=${page}&after=${afterTimestamp}&before=${beforeTimestamp}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!activitiesResponse.ok) {
                throw new Error(`Failed to fetch run details: ${activitiesResponse.statusText}`);
            }

            const activitiesData = await activitiesResponse.json();
            console.log(`Fetched page ${page} with ${activitiesData.length} activities.`);

            const filteredRuns = activitiesData
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

        // Fill in missing dates with zero distance
        const runMap = {};
        const startDate = new Date(afterTimestamp * 1000);
        const endDate = new Date(beforeTimestamp * 1000);
        for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
            const key = `${d.getMonth() + 1}-${d.getDate()}`;
            runMap[key] = 0;
        }
        allRuns.forEach(run => {
            const date = new Date(run.start_date);
            const key = `${date.getMonth() + 1}-${date.getDate()}`;
            if (!runMap[key]) {
                runMap[key] = 0;
            }
            runMap[key] += parseFloat(run.distance); // Sum the mileage for multiple runs on the same date
        });

        console.log(`Total runs fetched: ${allRuns.length}`);
        console.log(runMap);


        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify(runMap),
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
