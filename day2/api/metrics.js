const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register }); // process/node metrics

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["route", "method", "status"],
  register,
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["route", "method", "status"],
  // buckets bracket our SLO (~250ms) and the tail
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  register,
});

const httpInFlight = new client.Gauge({
  name: "http_requests_in_flight",
  help: "In-flight HTTP requests",
  labelNames: ["route"],
  register,
});

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  httpInFlight,
};
