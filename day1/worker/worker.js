require("./otel");
const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require("@aws-sdk/client-sqs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const cfg = {
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT,
};
const sqs = new SQSClient(cfg);
const s3 = new S3Client({ ...cfg, forcePathStyle: true });

async function loop() {
  const { Messages } = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 5, // long polling
      MessageAttributeNames: ["All"], // carries trace context
    }),
  );
  for (const m of Messages || []) {
    const envelope = JSON.parse(m.Body); // SNS envelope
    const order = JSON.parse(envelope.Message); // our order
    const result = { ...order, status: "processed", processedAt: Date.now() };
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.RESULT_BUCKET,
        Key: `orders/${order.id}.json`,
        Body: JSON.stringify(result),
        ContentType: "application/json",
      }),
    );
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        ReceiptHandle: m.ReceiptHandle,
      }),
    );
    console.log("processed", order.id);
  }
  setImmediate(loop);
}
loop();
