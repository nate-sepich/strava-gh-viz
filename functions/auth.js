const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const fs = require("fs");
const fetch = require('node-fetch');
const path = require("path");

// Directory to store tokens per user
const TOKEN_DIR = '/tmp/strava_tokens';

// Ensure the token directory exists
if (!fs.existsSync(TOKEN_DIR)){
    fs.mkdirSync(TOKEN_DIR);
}

function saveToken(username, tokenResponse) {
    const tokenData = {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: tokenResponse.expires_at,
    };

    const tokenPath = path.join(TOKEN_DIR, `${username}.json`);
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData));
}

function loadToken(username) {
    const tokenPath = path.join(TOKEN_DIR, `${username}.json`);
    if (fs.existsSync(tokenPath)) {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath));
        return {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: parseInt(tokenData.expires_at, 10),
        };
    }
    return null;
}

exports.handler = async (event, context) => {
    let code;
    let state;

    if (event.httpMethod === 'GET') {
        code = event.queryStringParameters.code;
        state = event.queryStringParameters.state;
        if (!code) {
            console.error("Missing 'code' in query parameters.");
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Invalid request. 'code' is required in query parameters." }),
            };
        }
    } else if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            if (!body.code || !body.state) {
                throw new Error("Missing 'code' or 'state' in request body.");
            }
            code = body.code;
            state = body.state;
        } catch (error) {
            console.error("Invalid request body:", error);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Invalid request body. 'code' and 'state' are required." }),
            };
        }
    } else {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method not allowed. Use GET or POST." }),
        };
    }

    const username = state || 'default';

    try {
        const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                grant_type: "authorization_code",
                redirect_uri: REDIRECT_URI, // Points to frontend
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error(`Failed to exchange code for token: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json();
        saveToken(username, tokenData);

        // Redirect back to frontend with token data in query string
        const frontendUrl = `${REDIRECT_URI}${username}?access_token=${tokenData.access_token}&expires_at=${tokenData.expires_at}&refresh_token=${tokenData.refresh_token}`;

        return {
            statusCode: 302,
            headers: {
                Location: frontendUrl,
            },
        };
    } catch (error) {
        console.error("Authorization failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

async function refreshTokenIfNeeded(username) {
    const tokenInfo = loadToken(username);

    if (tokenInfo && tokenInfo.expires_at < Math.floor(Date.now() / 1000)) {
        try {
            const refreshResponse = await fetch("https://www.strava.com/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: "refresh_token",
                    refresh_token: tokenInfo.refresh_token,
                }),
            });

            if (!refreshResponse.ok) {
                throw new Error(`Failed to refresh token: ${refreshResponse.statusText}`);
            }

            const refreshData = await refreshResponse.json();
            saveToken(username, refreshData);
            return refreshData.access_token;
        } catch (error) {
            console.error("Failed to refresh token:", error);
            return null;
        }
    }
    return tokenInfo ? tokenInfo.access_token : null;
}
