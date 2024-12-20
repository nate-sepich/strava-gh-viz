
const fetch = require('node-fetch');
const sgMail = require('@sendgrid/mail');

// Set SendGrid API Key from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email configuration
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL;
const SENDER_EMAIL = process.env.SENDER_EMAIL;

async function getStravaData() {
    const response = await fetch(`${process.env.NETLIFY_BASE_URL}/run-details`);
    if (!response.ok) {
        throw new Error(`Failed to fetch run details: ${response.statusText}`);
    }
    return response.json();
}

exports.handler = async (event, context) => {
    try {
        const stravaData = await getStravaData();

        const msg = {
            to: RECIPIENT_EMAIL,
            from: SENDER_EMAIL,
            subject: 'Weekly Strava Data Update',
            text: 'Please find attached your latest Strava data.',
            attachments: [
                {
                    content: Buffer.from(JSON.stringify(stravaData, null, 2)).toString('base64'),
                    filename: 'strava_data.json',
                    type: 'application/json',
                    disposition: 'attachment',
                },
            ],
        };

        await sgMail.send(msg);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Weekly email sent successfully.' }),
        };
    } catch (error) {
        console.error('Error sending weekly email:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};