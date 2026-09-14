#!/usr/bin/env bash
# Phase 3 — Home & discovery. Sort modes, hero count, autocomplete, bell badge.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:home
# Override with API_URL / DB_CONTAINER / DB_NAME.
B="${API_URL:-http://localhost:4500/api/v1}"
pass=0; fail=0

check() {
  if [ "$2" = "$3" ]; then
    pass=$((pass+1)); printf '  ok   %-46s %s\n' "$1" "$3"
  else
    fail=$((fail+1)); printf '  FAIL %-46s expected %s got %s\n     %s\n' "$1" "$2" "$3" "$(echo "$4" | head -c 220)"
  fi
}

req() { # METHOD PATH [DATA] [TOKEN]
  local m="$1" p="$2" d="$3" t="$4" args
  args=(-s -o /tmp/hbody -w '%{http_code}' -X "$m" "$B$p")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  curl "${args[@]}"
}

jq_get() { # read an expression off the last response body
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);process.stdout.write(String($1))}catch(e){}})" < /tmp/hbody
}

otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
    "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')" \
    | tr -d '\r\n'
}

SUFFIX=$(date +%s)
EMAIL="home.$SUFFIX@example.com"
TODAY=$(date +%Y-%m-%d)

echo "== setup =="
req POST /auth/admin/login '{"email":"admin@contenthub.io","password":"admin123"}' >/dev/null
ADMIN=$(jq_get "r.data.accessToken")
[ -n "$ADMIN" ] && pass=$((pass+1)) || fail=$((fail+1))
printf '  %-51s %s\n' "admin signed in" "$([ -n "$ADMIN" ] && echo ok || echo FAIL)"

req POST /auth/register "{\"firstName\":\"Home\",\"lastName\":\"Tester\",\"email\":\"$EMAIL\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
OTP=$(otp_for "$EMAIL")
req POST /auth/verify-otp "{\"email\":\"$EMAIL\",\"otpCode\":\"$OTP\"}" >/dev/null
USER=$(jq_get "r.data.accessToken")

req GET /categories '' "$USER" >/dev/null
CAT=$(jq_get "r.data[0].id")

# Two activities today at the same spot, so the geo paths have something to find.
NAME_A="Zephyr Paddling $SUFFIX"
NAME_B="Zephyr Bouldering $SUFFIX"
mk() { # NAME MAX
  req POST /activities "{\"activityName\":\"$1\",\"categoryId\":\"$CAT\",\"descriptions\":\"Phase 3 fixture\",\"maximumNumberOfParticipants\":$2,\"activityDate\":\"$TODAY\",\"activityTime\":\"10:00\",\"activityDuration\":\"2 hours\",\"activityLocation\":\"Lakeside\",\"latitude\":46.5197,\"longitude\":6.6323,\"minAge\":18,\"maxAge\":90}" "$USER" >/dev/null
  jq_get "r.data.id"
}
ACT_A=$(mk "$NAME_A" 12)
ACT_B=$(mk "$NAME_B" 12)
req PATCH "/activities/admin/activities/$ACT_A/status" '{"status":"Approved"}' "$ADMIN" >/dev/null
req PATCH "/activities/admin/activities/$ACT_B/status" '{"status":"Approved"}' "$ADMIN" >/dev/null
printf '  %-51s %s\n' "two approved activities today" "$ACT_A"

echo "== discover sort modes =="
code=$(req GET "/activities?sort=recent" '' "$USER")
check "sort=recent" 200 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities?sort=popular" '' "$USER")
check "sort=popular" 200 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities?sort=nearby&latitude=46.5197&longitude=6.6323" '' "$USER")
check "sort=nearby" 200 "$code" "$(cat /tmp/hbody)"
# The count runs as an aggregation $match, which rejects $near — meta.total
# proves the find and the count are not sharing the same clause.
TOTAL=$(jq_get "r.meta.total")
if [ -n "$TOTAL" ] && [ "$TOTAL" -ge 2 ]; then
  pass=$((pass+1)); printf '  ok   %-46s meta.total=%s\n' "nearby paginates (count avoids \$near)" "$TOTAL"
else
  fail=$((fail+1)); printf '  FAIL %-46s meta.total=%s\n' "nearby paginates (count avoids \$near)" "$TOTAL"
fi
code=$(req GET "/activities?sort=nearby&latitude=46.5197&longitude=6.6323&maxDistance=50" '' "$USER")
check "sort=nearby with a radius" 200 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities?sort=nearby" '' "$USER")
check "sort=nearby without coordinates" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities?sort=sideways" '' "$USER")
check "unknown sort rejected" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities" '' "$USER")
check "no sort keeps chronological default" 200 "$code" "$(cat /tmp/hbody)"

echo "== hero banner count =="
code=$(req GET "/activities/summary?latitude=46.5197&longitude=6.6323" '' "$USER")
check "summary near a point" 200 "$code" "$(cat /tmp/hbody)"
COUNT=$(jq_get "r.data.count"); RADIUS=$(jq_get "r.data.radiusKm"); DATE=$(jq_get "r.data.date")
if [ "$COUNT" -ge 2 ] && [ "$RADIUS" = "25" ] && [ "$DATE" = "$TODAY" ]; then
  pass=$((pass+1)); printf '  ok   %-46s count=%s radiusKm=%s\n' "counts today within the default radius" "$COUNT" "$RADIUS"
else
  fail=$((fail+1)); printf '  FAIL %-46s count=%s radiusKm=%s date=%s\n' "counts today within the default radius" "$COUNT" "$RADIUS" "$DATE"
fi
code=$(req GET "/activities/summary?latitude=-33.86&longitude=151.20&maxDistance=5" '' "$USER")
FAR=$(jq_get "r.data.count")
if [ "$FAR" = "0" ]; then
  pass=$((pass+1)); printf '  ok   %-46s count=0\n' "radius actually excludes far activities"
else
  fail=$((fail+1)); printf '  FAIL %-46s count=%s (expected 0)\n' "radius actually excludes far activities" "$FAR"
fi
# No coordinates anywhere: the count is national, and radiusKm says so.
code=$(req GET "/activities/summary" '' "$USER")
NULLR=$(jq_get "r.data.radiusKm")
if [ "$NULLR" = "null" ]; then
  pass=$((pass+1)); printf '  ok   %-46s radiusKm=null\n' "no location -> not claimed as \"near you\""
else
  fail=$((fail+1)); printf '  FAIL %-46s radiusKm=%s\n' "no location -> not claimed as \"near you\"" "$NULLR"
fi

echo "== search autocomplete =="
code=$(req GET "/activities/suggestions?q=Zephyr" '' "$USER")
check "suggestions" 200 "$code" "$(cat /tmp/hbody)"
N=$(jq_get "r.data.length")
if [ "$N" -ge 2 ]; then
  pass=$((pass+1)); printf '  ok   %-46s %s rows\n' "matches both fixtures" "$N"
else
  fail=$((fail+1)); printf '  FAIL %-46s %s rows\n' "matches both fixtures" "$N"
fi
# The point of not using the text index: a prefix must match mid-word.
code=$(req GET "/activities/suggestions?q=Zep" '' "$USER")
PREFIX=$(jq_get "r.data.length")
if [ "$PREFIX" -ge 2 ]; then
  pass=$((pass+1)); printf '  ok   %-46s %s rows\n' "partial prefix matches (not word-boundary)" "$PREFIX"
else
  fail=$((fail+1)); printf '  FAIL %-46s %s rows\n' "partial prefix matches (not word-boundary)" "$PREFIX"
fi
HASCAT=$(jq_get "r.data[0].categoryName")
[ -n "$HASCAT" ] && { pass=$((pass+1)); printf '  ok   %-46s %s\n' "rows carry categoryName" "$HASCAT"; } \
                 || { fail=$((fail+1)); printf '  FAIL %-46s empty\n' "rows carry categoryName"; }
code=$(req GET "/activities/suggestions?q=a" '' "$USER")
check "single character rejected" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities/suggestions" '' "$USER")
check "missing q rejected" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities/suggestions?q=Zephyr&limit=1" '' "$USER")
ONE=$(jq_get "r.data.length")
[ "$ONE" = "1" ] && { pass=$((pass+1)); printf '  ok   %-46s 1\n' "limit honoured"; } \
                 || { fail=$((fail+1)); printf '  FAIL %-46s %s\n' "limit honoured" "$ONE"; }

echo "== bell badge =="
code=$(req GET /notifications/unread-count '' "$USER")
check "unread-count" 200 "$code" "$(cat /tmp/hbody)"
BEFORE=$(jq_get "r.data.unreadCount")
req POST /notifications/admin/notifications "{\"notificationTitle\":\"Phase 3 $SUFFIX\",\"messageContent\":\"Badge fixture\",\"audience\":\"Everyone\"}" "$ADMIN" >/dev/null
req GET /notifications/unread-count '' "$USER" >/dev/null
AFTER=$(jq_get "r.data.unreadCount")
if [ "$AFTER" -eq $((BEFORE + 1)) ]; then
  pass=$((pass+1)); printf '  ok   %-46s %s -> %s\n' "a broadcast increments the badge" "$BEFORE" "$AFTER"
else
  fail=$((fail+1)); printf '  FAIL %-46s %s -> %s\n' "a broadcast increments the badge" "$BEFORE" "$AFTER"
fi
req GET /notifications '' "$USER" >/dev/null
NID=$(jq_get "r.data[0].id")
req PATCH "/notifications/$NID/read" '' "$USER" >/dev/null
req GET /notifications/unread-count '' "$USER" >/dev/null
READ=$(jq_get "r.data.unreadCount")
if [ "$READ" -eq "$BEFORE" ]; then
  pass=$((pass+1)); printf '  ok   %-46s %s -> %s\n' "marking read decrements the badge" "$AFTER" "$READ"
else
  fail=$((fail+1)); printf '  FAIL %-46s %s -> %s\n' "marking read decrements the badge" "$AFTER" "$READ"
fi
code=$(req GET /notifications/unread-count)
check "unread-count requires a token" 401 "$code" "$(cat /tmp/hbody)"

echo "== bad numbers are a 400, not a 500 =="
# These all reach $centerSphere / $maxDistance unaltered. Before the bounds
# were added, Mongo threw and the raw driver message surfaced as a 500.
code=$(req GET "/activities?maxDistance=-5&latitude=46.5&longitude=6.6" '' "$USER")
check "discover negative radius" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities?sort=nearby&latitude=46.5&longitude=6.6&maxDistance=-5" '' "$USER")
check "nearby negative radius" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities?maxDistance=5&latitude=999&longitude=6.6" '' "$USER")
check "discover latitude out of range" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities?maxDistance=5&latitude=46.5&longitude=999" '' "$USER")
check "discover longitude out of range" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities/summary?latitude=46.5&longitude=6.6&maxDistance=-5" '' "$USER")
check "summary negative radius" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities/summary?latitude=999&longitude=6.6" '' "$USER")
check "summary latitude out of range" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities/suggestions?q=Zep&limit=999" '' "$USER")
check "suggestions limit above the cap" 400 "$code" "$(cat /tmp/hbody)"
code=$(req GET "/activities/suggestions?q=Zep&limit=-3" '' "$USER")
check "suggestions negative limit" 400 "$code" "$(cat /tmp/hbody)"
# Written to the GeoJSON mirror, where the 2dsphere index would reject it.
code=$(req PATCH "/activities/$ACT_A" '{"latitude":999}' "$USER")
check "update activity latitude out of range" 400 "$code" "$(cat /tmp/hbody)"

echo "== cleanup =="
req DELETE "/activities/$ACT_A" '' "$USER" >/dev/null
code=$(req DELETE "/activities/$ACT_B" '' "$USER")
check "fixtures removed" 200 "$code" "$(cat /tmp/hbody)"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
