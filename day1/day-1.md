# Why Observability Matters

### You can't debug what you can't ask questions about

When a distributed system misbehaves at 3am, dashboards built for yesterday's failure don't help. The systems that recover fast are the ones where engineers can pose a brand-new question — and get an answer in seconds, without shipping a code change

### The Gap

Most teams "monitor" - they watch a fixed set of pre-defined graphs. The real outage is always the question nobody pre-wired.

### The Skill

Observability is an engineering property: instrument once, then interrogate the system arbitrarily after the fact.

## Three pillars + Profiling = four signals

Each signal is a different lens. None is sufficient alone; together they let you move from "something's wrong" to "this line of code".

**Metrics**: Aggregated numbers over time. Cheap, low-cardinality. Trends and alerts.
**Logs**: Discrete timestamped event. Mid cost, high detail. Context for one thing.
**Traces**: Casually-linked spans across services. Where time went.
**Profiles**: Sampled stack traces & resource usage. Which code burned CPU/mem

> [!Important]
> Mental Mode: **Metrics** tell you something changed -> **traces** tell you where -> **logs** tell you the detail -> **profiles** tell you which function.

### Each Signal has a cost & cardinality profile

Choosing a signal is a cost decision. Cardinality (number of unique label/series combinations) is what blows up storage and query cost.

| Signal   | Granularity                  | Cardinality Risk              | Relative cost     | Retention you'd pick |
| -------- | ---------------------------- | ----------------------------- | ----------------- | -------------------- |
| Metrics  | Aggregated / pre-bucketed    | High if you put IDs in labels | low               | long (month-years)   |
| Logs     | Per-event, full detail       | Bounded by volume, not labels | Medium-High       | Medium (days-weeks)  |
| Traces   | Per-request span tree        | very high (unique trace IDs)  | High -> sample it | short (hours-days)   |
| Profiles | Statistically sampled stacks | Moderate                      | Medium            | short-medium         |

> [!Caution]
> **Cardinality Rule of Thumb**: never put unbounded values (user ID, request ID, order ID) in a metric label - that belongs in a log line or a trace span attribute. This single mistake is the #1 cause of runaway Prometheus/mimir cost

### "Concerns": which signal answers which question

During an incident you ask these in order. Map the question to the signal and you stop flailing.

| The Question                          | Concern      | Best Signal          |
| ------------------------------------- | ------------ | -------------------- |
| Is it broken                          | Detection    | Metrics (SLI/Alert)  |
| How broken - what's the blast radius? | Severity     | Metrics (RED/USE)    |
| Where is the broken ?                 | Localization | Traces               |
| Why is it broken ?                    | Root Cause   | Logs + Trace context |
| which code is reponsible ?            | Attribution  | Profiles             |

> [!Tip]
> The power move is **correlation**: jump from a spiking metric -> an exemplar trace -> that trace's logs -> a flamegraph for the slow span. The LGTM stack wires these jumps together by `trace_id`

## Start from Questions, not "collect everything"

"Collect everything" is a budget fire, and a signal-to-noise disaster. Instead, work backwards from what users feel.

1. Name the **user-facing SLIs**: e.g, "% of `POST /orders` that succeed < 300ms"
2. List the **questions** you'll ask when an SLI burns: where's the latency ? which dependency ? which release ?
3. Derive the **minimum instrumentation** that answers them - then add cardinality only where a real question needs it.

> This is the inversion most teams miss: instrumentation is a consequence of the questions you intend to ask, not a checkbox you complete up front. We'll formalize SLIs/RED on Day 2.

## The OSS Stack - who does what

| Tool           | Purpose                                                                          |
| -------------- | -------------------------------------------------------------------------------- |
| Grafana        | Single pane of glass - dashboards, Explore, correlation across all signals :3000 |
| Prometheus     | Pull-based metrics scrapper + TSDB + Alerting rules :9090                        |
| Mimir          | Horizontally-scalable long-term metrics store (prometheus-compatible)            |
| Loki           | Log aggregation, indexed by labels not full text. LogQL :3100                    |
| Tempo          | Trace Storage, OTLP-native, cheap object-store backend :4317/:4318               |
| Pyroscope      | Continuous profiling store + flamegraphs :4040                                   |
| Otel Collector | Vendor-neutral receive -> process -> export pipeline (contrib build)             |
| Grafana Alloy  | Grafana's OTel-based collector/agent - scraping, profiling, log shipping         |

## Collector & Alloy: Why a telemetry pipeline ?

Apps should emit telemetry to one local endpoint and forget about it. A collector decouples your code from your backends.

- **OpenTelemetry Collector (contrib)**
  Receivers (OTLP) -> Processors (batch, attributes, sampling) -> exporters (Tempo, Loki, Prometheus/Mimir). Vendor-neutral, the industry standard data plane.

- **Grafana Alloy**
  Grafana's distribution of the Collector with a config language (`.alloy` / River). Add Prometheus scraping, Pyroscope profiling pull and log discovery in one agent.

> **Why both ?** It mirrors reality: many shops run the upstream collector for OTLP and Alloy for Grafana-native scraping/profiling. You'll wire apps -> Collector, and let Alloy handle scrape/profile duties.

### The Workload we'll observer: an AWS event pipeline

To learn observability, you need something _worth_ observing - async, multi-hop, with a database/queue boundary where traces normally break.

**api** (node/express)
`POST /ordes` validates the order, then publishes it to an SNS topic via AWS SDK v3.

**worker** (Node)
Polls the SQS Queue (subscribed to the topic), and processes, and writes a result object to S3.

> The hard, interesting part: trace context must survive the **async hop** through SQS. We propagate it via SQS message attributes so a single trace spans api -> SNS -> SQS -> worker -> s3. That's the realistic distributed-tracing challenge.

**Signals** -> **Collectors** -> **Backends** -> **Grafana**

[](../images/whole-picture.jpg)
