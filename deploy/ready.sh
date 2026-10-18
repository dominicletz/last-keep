#!/bin/bash

# One /health can be the process that is about to exit. Three answers in a
# row, with a gap, means the listener stayed up. The smoke is unchanged.
set -eu

url="${1:-https://agentyard.letz.tw/health}"
need="${READY_STREAK:-3}"
streak=0

for i in $(seq 1 40); do
  if curl -fsS --max-time 5 "$url" | grep -q '"ok":true'; then
    streak=$((streak + 1))
    if [ "$streak" -ge "$need" ]; then
      echo "ready after ${i}"
      exit 0
    fi
  else
    streak=0
  fi
  sleep 2
done

echo "the game did not stay up on /health" >&2
exit 1
