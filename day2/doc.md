### Why histograms, not averages

You cannot recover a percentile from a mean. To answer "what did the 95th-percentile user experience?" you must keep the **shape** of the distribution.

A Prometheus histogram does this by counting observations into pre-defined **buckets**. Each bucket is a cumulative counter le ("less-than-or-equal"):

```
# one histogram = many counters
http_request_duration_seconds_bucket{le="0.05"} 7
http_request_duration_seconds_bucket{le="0.1"}  19
http_request_duration_seconds_bucket{le="0.25"} 44
http_request_duration_seconds_bucket{le="0.5"}  51
http_request_duration_seconds_bucket{le="+Inf"} 53
http_request_duration_seconds_sum   8.94
http_request_duration_seconds_count 53
```

Percentiles are **interpolated** from buckets at query time with `histogram_quantile()`

```
histogram_quantile(0.95,
  sum by (le, route) (
    rate(http_request_duration_seconds_bucket[5m])
  ))
```

**Resolution lives in your bucket**. A p99 only as precise as the bucket it lands in. If everything piles into `le="+Inf"`, your p99 is a lie. Choose buckets around your SLO.

> Histograms aggregate across instances; qiantiles (the old `summary` type) don't. Prefer histograms for anything you'll sum.

### RED - Golden Signals for request services

Tom Wilkie's **RED method** is the Golden Signals minus saturation, specialized for request-driven services. Three metrics, per service, per endpoint.

**R - rate**: Requests per second the service handles ( = Traffic)
**E - Errors**: Number / fraction of those requests that failed ( = Errors)
**D - Duration**: Distribution of time each request took ( = Latency)

> [!Important]
> **The Power of RED**: It's identical for every service. Same three panels, same queries, same dashboard template - whether it serves orders, users or payments. That uniformity is what makes a fleet observable.

### RED vs USE - symptoms vs causes

|                  | RED (Wilkie)                 | USE (Gregg)                          |
| ---------------- | ---------------------------- | ------------------------------------ |
| Measures         | Rate - Errors - Duration     | Utilization - Saturation - Errors    |
| Unit of analysis | A request / service          | A resource (CPU, disk, queue)        |
| Viewpoint        | The caller / user experience | The machine / resource               |
| Answers          | "Are users in pain ?"        | "Which resource is the bottleneck ?" |
| Best for         | Request-driven services      | Hosts, queues, finite resources      |

> [!Tip]
> **Use them together**: RED tells you the service is unhealthy (symptom); USE tells your why (a saturated resource). You build RED today; USE in day3.
