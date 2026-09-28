#!/usr/bin/env bash
set -euo pipefail
AWSLOCAL="docker compose exec -T localstack awslocal"

# 1) SNS topic
TOPIC_ARN=$($AWSLOCAL sns create-topic --name orders --query TopicArn --output text)

# 2) SQS queue + its ARN
$AWSLOCAL sqs create-queue --queue-name orders-queue >/dev/null
QURL=$($AWSLOCAL sqs get-queue-url --queue-name orders-queue --query QueueUrl --output text)
QARN=$($AWSLOCAL sqs get-queue-attributes --queue-url "$QURL" \
        --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

# 3) Subscribe the queue to the topic (raw delivery off → SNS envelope)
$AWSLOCAL sns subscribe --topic-arn "$TOPIC_ARN" \
  --protocol sqs --notification-endpoint "$QARN" >/dev/null

# 4) Result bucket
$AWSLOCAL s3 mb s3://order-results

# 5) Bucket for mimir
$AWSLOCAL s3 mb s3://mimir

echo "topic=$TOPIC_ARN"
echo "queue=$QURL"
echo "bucket=order-results  ✔ provisioned"