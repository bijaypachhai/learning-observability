// instrumentation must load FIRST (auto-instruments http + aws-sdk)
require("./otel");
const express = require("express");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const sns = new SNSClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT, // http://localstack:4566
});

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/orders", async (req, res) => {
  const { item, qty } = req.body || {};
  if (!item || !Number.isInteger(qty) || qty < 1) {
    return res
      .status(400)
      .json({ error: "item (string) and qty (int>=1) required" });
  }
  const order = { id: crypto.randomUUID(), item, qty, ts: Date.now() };
  await sns.send(
    new PublishCommand({
      TopicArn: process.env.TOPIC_ARN,
      Message: JSON.stringify(order),
    }),
  );
  res.status(202).json({ accepted: true, order });
});

app.listen(8080, () => console.log("api listening on :8080"));
