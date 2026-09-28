# Practise in the Lab

### Configure Data Sources in Grafana `datasources.yaml`

> [!Important]
> The `derivedFields + traceToLogs / traceToMetrics` blocks are the magic: they create clickable jumps between signals. Note the escaped `$${...}` so Grafana doesn't treat it as an env var.

### Configure Prometheus `prometheus.yml`

The api exposes `/metrics` on its HTTP port; the worker (no HTTP server) exposes the OpenTelemetry Prometheus exporter on `:9464`. Both are scraped on the Docker network by service name.

### Configure Otel Collector `config.yaml`

One receiver, one batch processor, fan-out to four backends. Traces -> Tempo, Logs -> Loki, Metrics -> Mimir and a Prometheus-scrapeable endpoint. This is the canonical OTLP-in / multi-backend-out shape.

### Configure Alloy

Alloy complements the collector: it handles **pull-based** scraping (Prometheus) and **profile** collection, while the Collector handles **push-based** OTLP from app instrumentation. Both can coexist; this is how real Grafana shops run.

> It also replaces the combination of Promtail + Grafana Agent in the newer LGTM Stack.

### Express Application

`require('./otel')` runs the OpenTelemetry Node SDK (with AWS SDK instrumentation) before any AWS Client is created, so the SNS publish is auto-traced and trace context is injected into the message. `app.js` stays clean of telemetry code.

Auto-instrumentation covers Express, the HTTP Layer, and AWS SDK v3 - so SNS/SQS/S3 calls become spans automatically, and the propagator writes the trace context into SQS message attributes for free.

### Worker Application

SNS-to-SQS delivers an envelope; the real order is in envelope.Message . `forcePathStyle:true` is required for S3 against LocalStack. `MessageAttributeNames:['All]` lets the OTel propagator rebuild the trace across the async hop.

## Run the Stack

```bash
docker compose up -d --build # comment worker service till localstack starts with SNS Topic
docker compose up worker -d
bash test.sh
```

## Queries

```
# PromQL query to see if the api container is up
up{job="api"}

# LogQL query to see all api container logs in the last 5 minutes
{service="api"} |= ""
```

## References

**Mimir Configuration**: [Github: Mimir](https://github.com/grafana/mimir/blob/main/docs/sources/mimir/get-started/play-with-grafana-mimir/config/mimir.yaml)

**Tempo Configuration**: [Github: Tempo]()
