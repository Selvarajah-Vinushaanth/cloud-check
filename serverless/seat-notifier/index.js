/**
 * AWS Lambda Function: seat-notifier
 * Triggered by Event Service when seats_available < threshold
 * Writes a notification entry to an S3 bucket with event ID, timestamp, and remaining seats
 */

const AWS = require('aws-sdk');
const s3  = new AWS.S3();

const BUCKET_NAME = process.env.NOTIFICATION_BUCKET || 'cloudsummit-seat-notifications';

exports.handler = async (event) => {
  console.log('[seat-notifier] Received event:', JSON.stringify(event));

  const {
    event_id,
    event_title,
    venue,
    seats_available,
    timestamp
  } = event;

  // Compose notification object
  const notification = {
    event_id:        event_id,
    event_title:     event_title,
    venue:           venue,
    seats_available: seats_available,
    threshold_alert: seats_available < 10 ? 'CRITICAL' : 'WARNING',
    notification_at: timestamp || new Date().toISOString(),
    message:         `Only ${seats_available} seat(s) remaining for "${event_title}" at ${venue}.`
  };

  // Write to S3 bucket
  const key = `notifications/${event_id}/${Date.now()}.json`;

  try {
    await s3.putObject({
      Bucket:      BUCKET_NAME,
      Key:         key,
      Body:        JSON.stringify(notification, null, 2),
      ContentType: 'application/json',
      Metadata: {
        event_id:        String(event_id),
        seats_available: String(seats_available)
      }
    }).promise();

    console.log(`[seat-notifier] Notification written to s3://${BUCKET_NAME}/${key}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Notification stored successfully',
        bucket:  BUCKET_NAME,
        key:     key
      })
    };
  } catch (err) {
    console.error('[seat-notifier] S3 write failed:', err.message);
    throw err;
  }
};
