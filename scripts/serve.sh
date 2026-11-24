#!/usr/bin/env bash
# rebuild and (re)start the production server on :3210
netstat -ano | grep ":3210" | grep LISTEN | awk '{print $5}' | sort -u | while read pid; do taskkill //PID $pid //F //T >/dev/null 2>&1; done
npx next build 2>&1 | grep -E "rror|Compiled|Failed" | head -8
(npx next start -p 3210 > /dev/null 2>&1 &)
for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210 && break; done
