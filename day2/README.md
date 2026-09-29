# Golden Signals & the RED Method

The four numbers that tell you whether a request-driven service is healthy - and how to actually measure them with Prometheus histograms instead of lying averages.

### You cannot watch every metric. So watch the right four.

**A modern service emits thousands of metrics. Paging on all of them = alert fatigue. Paging on none = flying blind.**
The Golden Signals are Google SRE's answer: a tiny, universal set that captures **user-visible health** for any request-serving system. If all four are good, your users are probably happy - regardless of what's happening underneath.

**By the end of this day, you can...**

- Instrument `api` with a request counter + a latency histogram
- Write PromQL for rate, error-ratio, p50/p95/p99, in-flight
- Read why an **average** latency hides your worst users
- Build a RED dashboard that lights up under load

> [!Important]
> **Mental Model**: Golden Signals are the symptoms (is the user in pain ?). Tomorrow's USE method covers the causes (is a resource exhausted ?). You need both.

## The four Golden Signals

From the Google SRE book, Ch. 6. Measured at the **edge of the service** - what the caller experiences.

> **Latency**: How long a request takes. _Success and error latency_ are different signals - keep them apart
> **Traffic**: How much demand. For an HTTP service: requests/second. The "size" of your system right now.
> **Errors**: Rate of failed requests - explicit (5xx), implicit (200 with wrong body), or policy (too slow).
> **Saturation**: How "full" the service is - the most constrained resource, and how close to the limit.

### Latency: time to serve a request

Sounds simple. Two traps make is the isgnal people get wrong most often.

> [!Caution]
> **Trap 1 - mixing success & error latency**. A failing endpoint that returns HTTP 500 in 3ms will improve your average latency while your users are broken. Always split latency by outcome.
> **Trap 2 - the average**. The mean hides the tail. If 1% of requests take 10s, the mean barely moves - but that 1% is a real user, every few seconds.

**What to actually track**

- Latency distribution (a histogram), not a single number
- Percentiles: p50 (typical), p95/p99 (the tail)
- Split by `status` class - 2xx vs 5xx latency are unrelated stories

> **Slow** is a tail problem. You manage tails with percentiles, and percentiles need histograms.

### Traffic: how much is being asked

A measure of demand on the system, in the unit that matters for your device

- HTTP Service -> **requests per second**
- Message consumer -> **messages per second**
- Storage system -> **I/O ops or bytes per second**

Traffic is the denominator for almost everything else: errors are meaningful only as a **fraction** of traffic, and saturation is "demand relative to capacity"

**In our system**
`api` traffic = `POST /orders` per second. Downstream traffic also exists: SNS publishes/s, SQS receives, S3 puts in the `worker`. Each hop has its own traffic signal. Today we measure traffic at the `api` edge - the request the user actually waits on.

### Errors: rate of requests that failed

"Failed" is broader than you think. Three flavors:

1. **Explicit**
   HTTP 5xx, thrown exceptions, RPC error codes. The obvious ones.
2. **Implicit**
   HTTP 200 with the wrong body - bad JSON, empty result, wrong content. Looks fine to a status-code monitor
3. **Policy**
   Served correctly but too slow - e.g. > 1second violates your SLO, so it counts as failed.

> **Express it as a ratio, not a count**. "500 errors/min" mean nothing without traffic. **Error ratio = failed / total** is what maps to an SLO and an error budget. We compute exactly this in PromQL.

### Saturation: how full the service is

How constrained your most-limited resource is, and how close it is to the edge. Saturation is a **leading indicator** - it rises before latency and errors do.

- For our `api`: **in-flight requests** - concurrent requests being served right now
- Classic proxies: CPU run-queue, memory, thread-pool depth, connection-pool usage, queue length
- Watch utilization and the trend toward 100%

**Why "in-flight" is the right cheap signal**: By Little's law: `concurrency = arrival_rate x latency`. When latency climbs and traffic holds, in-flight rises. A rising in-flight gauge is an early warning that the service is backing up - before users see timeouts.

> We expose in-flight as a Prometheus **gauge** in the lab - it goes up and down, unlike a counter.

[](../images/four-signal.jpg)

All four are measured at the `api` edge - the same place we add two metrics in the lab.
