const { NodeSDK } = require("@opentelemetry/sdk-node");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");
const { PrometheusExporter } = require("@opentelemetry/exporter-prometheus");

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(), // uses OTEL_EXPORTER_OTLP_ENDPOINT
  metricReader: new PrometheusExporter({ port: 9464, endpoint: "/metrics" }),
  instrumentations: [getNodeAutoInstrumentations()], // http, express, aws-sdk, ...
});
sdk.start();
process.on("SIGTERM", () => sdk.shutdown());
