/**
 * notifier.js - Triggers the serverless seat-notifier AWS Lambda
 * when seats_available drops below the configured threshold.
 */
const AWS = require('aws-sdk');

const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || 'ap-south-1'
});

const LAMBDA_FUNCTION_NAME = process.env.SEAT_NOTIFIER_LAMBDA || 'seat-notifier';

/**
 * Triggers the seat-notifier Lambda function.
 * @param {Object} event - The event row from the DB
 */
async function triggerSeatNotifier(event) {
  const payload = {
    event_id:        event.id,
    event_title:     event.title,
    venue:           event.venue,
    seats_available: event.seats_available,
    timestamp:       new Date().toISOString()
  };

  console.log('[notifier] Triggering seat-notifier Lambda for event:', event.id);

  const params = {
    FunctionName:   LAMBDA_FUNCTION_NAME,
    InvocationType: 'Event',         // Async invocation (fire-and-forget)
    Payload:        JSON.stringify(payload)
  };

  await lambda.invoke(params).promise();
  console.log('[notifier] Lambda triggered successfully');
}

module.exports = { triggerSeatNotifier };
