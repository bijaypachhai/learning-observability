while true; do
  curl -s -o /dev/null -X POST http://localhost:3001/orders \
    -H 'content-type: application/json' \
    -d '{"sku":"SKU-42","qty":2}'
  # occasionally send a bad order to create 4xx/5xx
  [ $((RANDOM % 10)) -eq 0 ] && curl -s -o /dev/null -X POST \
    http://localhost:3001/orders -d '{"bad":true}'
  sleep 0.1
done