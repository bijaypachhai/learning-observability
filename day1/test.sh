# --- health checks ---
curl -s localhost:3000/api/health        | grep -q ok      && echo "grafana ✔"
curl -s localhost:9090/-/healthy                            && echo "prometheus ✔"
curl -s localhost:3100/ready                                && echo "loki ✔"
curl -s localhost:3200/ready                                && echo "tempo ✔"
curl -s localhost:9009/ready                                && echo "mimir ✔"
curl -s localhost:4040/healthz                              && echo "pyroscope ✔"
curl -s localhost:8080/healthz                              && echo "api ✔"

# Grafana datasources all "alive":
curl -s localhost:3000/api/datasources | \
  python3 -c 'import sys,json;[print(d["name"]) for d in json.load(sys.stdin)]'

# --- drive an order through api → SNS → SQS → worker → S3 ---
curl -s -XPOST localhost:8080/orders \
  -H 'content-type: application/json' \
  -d '{"item":"widget","qty":10}' | python3 -m json.tool

# --- confirm the worker wrote the result to S3 ---
docker compose exec -T localstack awslocal s3 ls s3://order-results/orders/
docker compose logs worker --since=30s | grep processed
