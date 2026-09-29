# Lab Practice

## 1. Add the Prometheus Client to `api`

We use `prom-client` - the de-facto Node Prometheus library. Install it in the `api` service and confirm the default registry works.

```bash
npm install prom-client@15
```

> If `api` already runs in a container, rebuild after editing `package.json: docker compose build api`. We restart it at the end of step 4. Keep the file edits and the rebuild together so you only bounce the container once.

## 2. Define the Counter, histogram & in-flight gauge

Add file `api/metrics.js`

Buckets are chosen around the SLO, not evenly - that's where you want percentile resolution.

## 3. Wire middleware & expose `/metrics`

Add file `api/server.js`

> [!Caution]
> **Cardinality Guard**: label with the route template ( `/orders` ), never the raw URL with IDs ( `/orders/abc-123` ) - that explodes the series count and OOMs Prometheus.

## 4. Scrape `api` from Prometheus & reload

```yaml
scrape_configs:
  - job_name: "api"
    metrics_path: /metrics
    static_configs:
      - targets: ["api:3001"] # service:port on the compose network
        labels:
          service: orders-api
```

Rebuild the api with new code, then hot-reload Prometheus (no restart, no scrape gap)

```bash
docker compose up -d --build api

# Prometheus must be started with --web.enable-lifecycle
curl -X POST http://localhost:9090/-/reload

# confirm the target is UP
curl -s http://localhost:9090/api/v1/targets \
  | jq '.data.activeTargets[] | select(.labels.job=="api") | {health, lastError}'
```

> **Expected**: `{"health":"up","lastError":""}`. Also open **Status -> Targets** in the Prometheus UI on `:9090`

## 5. Verify `/metrics` exposes both metrics

Before querying, confirm the endpoint actually emits the counter and histogram families.

```bash
# hit it directly (api published on host :3001)
curl -s http://localhost:3001/metrics | grep -E '^http_request' | head -20


## EXPECTED OUTPUT

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{route="/orders",method="POST",status="202"} 3
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{route="/orders",method="POST",status="202",le="0.05"} 1
http_request_duration_seconds_bucket{route="/orders",method="POST",status="202",le="0.25"} 3
http_request_duration_seconds_bucket{...,le="+Inf"} 3
http_request_duration_seconds_sum{route="/orders",...} 0.214
http_request_duration_seconds_count{route="/orders",...} 3
```

See `_bucket`, `_sum`, `_count` for the histogram ? You are ready for PromQL

## 6. Generate Load through `POST /orders`

Empty graphs teach nothing. Drive traffic so rate/error/duration come alive. Pick one.

- Plain `curl` loop - zero deps

```bash
while true; do
  curl -s -o /dev/null -X POST http://localhost:3001/orders \
    -H 'content-type: application/json' \
    -d '{"sku":"SKU-42","qty":2}'
  # occasionally send a bad order to create 4xx/5xx
  [ $((RANDOM % 10)) -eq 0 ] && curl -s -o /dev/null -X POST \
    http://localhost:3001/orders -d '{"bad":true}'
  sleep 0.1
done
```

- hey - steady concurrency for 60s

```bash
hey -z 60s -c 20 -m POST \
  -H 'content-type: application/json' \
  -d '{"sku":"SKU-42","qty":2}' \
  http://localhost:3001/orders
```

Leave load running in one terminal while you build the dashboard in the next steps.
