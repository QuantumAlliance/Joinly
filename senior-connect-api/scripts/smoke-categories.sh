#!/usr/bin/env bash
# Phase 4 — user-created categories with non-blocking approval.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:categories
# Override with API_URL / DB_CONTAINER / DB_NAME.
B="${API_URL:-http://localhost:4500/api/v1}"
pass=0; fail=0

check() {
  if [ "$2" = "$3" ]; then
    pass=$((pass+1)); printf '  ok   %-48s %s\n' "$1" "$3"
  else
    fail=$((fail+1)); printf '  FAIL %-48s expected %s got %s\n     %s\n' "$1" "$2" "$3" "$(echo "$4" | head -c 220)"
  fi
}

assert() { # LABEL EXPECTED ACTUAL
  if [ "$2" = "$3" ]; then
    pass=$((pass+1)); printf '  ok   %-48s %s\n' "$1" "$3"
  else
    fail=$((fail+1)); printf '  FAIL %-48s expected %s got %s\n' "$1" "$2" "$3"
  fi
}

req() { # METHOD PATH [DATA] [TOKEN]
  local m="$1" p="$2" d="$3" t="$4" args
  args=(-s -o /tmp/cbody -w '%{http_code}' -X "$m" "$B$p")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  curl "${args[@]}"
}

g() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);process.stdout.write(String($1))}catch(e){}})" < /tmp/cbody; }

otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
    "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')" \
    | tr -d '\r\n'
}

SUFFIX=$(date +%s)
EMAIL="cat.$SUFFIX@example.com"
PROPOSED="Kitesurfing $SUFFIX"
REJECTED="Underwater Chess $SUFFIX"
WIZARD="Hedge Racing $SUFFIX"

echo "== setup =="
req POST /auth/admin/login '{"email":"admin@contenthub.io","password":"admin123"}' >/dev/null
ADMIN=$(g "r.data.accessToken")
req POST /auth/register "{\"firstName\":\"Cat\",\"lastName\":\"Tester\",\"email\":\"$EMAIL\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
OTP=$(otp_for "$EMAIL")
req POST /auth/verify-otp "{\"email\":\"$EMAIL\",\"otpCode\":\"$OTP\"}" >/dev/null
USER=$(g "r.data.accessToken")
[ -n "$ADMIN" ] && [ -n "$USER" ] && printf '  admin + user signed in\n' || { echo "  FAIL setup"; exit 1; }

echo "== a user proposes a category =="
code=$(req POST /categories "{\"categoryName\":\"$PROPOSED\"}" "$USER")
check "any authenticated user may propose" 201 "$code" "$(cat /tmp/cbody)"
CAT_P=$(g "r.data.id")
assert "created as Pending" "Pending" "$(g "r.data.status")"

code=$(req POST /categories "{\"categoryName\":\"$PROPOSED\"}" "$USER")
check "proposing an existing name is not an error" 201 "$code" "$(cat /tmp/cbody)"
assert "  and returns the same row" "$CAT_P" "$(g "r.data.id")"

code=$(req POST /categories "{\"categoryName\":\"x\"}" "$USER")
check "name under 2 characters rejected" 400 "$code" "$(cat /tmp/cbody)"
code=$(req POST /categories "{\"categoryName\":\"Anon $SUFFIX\"}")
check "proposing requires a token" 401 "$code" "$(cat /tmp/cbody)"

echo "== pending stays out of the public chips =="
req GET /categories '' "$USER" >/dev/null
IN_PUBLIC=$(g "r.data.filter(c=>c.id==='$CAT_P').length")
assert "pending category absent from GET /categories" "0" "$IN_PUBLIC"

echo "== but it is usable immediately (non-blocking) =="
code=$(req POST /activities "{\"activityName\":\"Kite Session $SUFFIX\",\"categoryId\":\"$CAT_P\",\"descriptions\":\"Phase 4 fixture\",\"maximumNumberOfParticipants\":6,\"activityDate\":\"2030-06-01\",\"activityTime\":\"10:00\",\"activityDuration\":\"2 hours\",\"activityLocation\":\"Bay\",\"latitude\":46.5,\"longitude\":6.6,\"minAge\":18,\"maxAge\":90}" "$USER")
check "activity publishes with a pending category" 201 "$code" "$(cat /tmp/cbody)"
ACT_P=$(g "r.data.id")
req GET "/activities/$ACT_P" '' "$USER" >/dev/null
assert "  and still renders its category name" "$PROPOSED" "$(g "r.data.category.categoryName")"

echo "== the Create Activity wizard seam =="
# categoryName instead of categoryId: the category is created on the fly.
code=$(req POST /activities "{\"activityName\":\"Hedge Sprint $SUFFIX\",\"categoryName\":\"$WIZARD\",\"descriptions\":\"Phase 4 fixture\",\"maximumNumberOfParticipants\":6,\"activityDate\":\"2030-06-02\",\"activityTime\":\"10:00\",\"activityDuration\":\"1 hour\",\"activityLocation\":\"Lane\",\"latitude\":46.5,\"longitude\":6.6,\"minAge\":18,\"maxAge\":90}" "$USER")
check "wizard creates the category inline" 201 "$code" "$(cat /tmp/cbody)"
ACT_W=$(g "r.data.id")
CAT_W=$(g "r.data.category.id")
req GET "/categories/admin/categories?search=Hedge%20Racing" '' "$ADMIN" >/dev/null
assert "  created as Pending, not Disabled" "Pending" "$(g "r.data.categories[0].status")"

echo "== admin review queue =="
code=$(req GET "/categories/admin/categories?status=Pending&limit=100" '' "$ADMIN")
check "admin can filter on Pending" 200 "$code" "$(cat /tmp/cbody)"
QUEUED=$(g "r.data.categories.filter(c=>c.id==='$CAT_P').length")
assert "  the proposal is in the queue" "1" "$QUEUED"
PENDING_STAT=$(g "r.data.stats.pendingReview")
if [ "$PENDING_STAT" -ge 2 ]; then
  pass=$((pass+1)); printf '  ok   %-48s %s\n' "stats.pendingReview badges the queue" "$PENDING_STAT"
else
  fail=$((fail+1)); printf '  FAIL %-48s %s\n' "stats.pendingReview badges the queue" "$PENDING_STAT"
fi
PROPOSER=$(g "(r.data.categories.find(c=>c.id==='$CAT_P')||{}).proposedBy?.firstName")
assert "  row names who proposed it" "Cat" "$PROPOSER"

echo "== approve =="
code=$(req PATCH "/categories/admin/categories/$CAT_P/status" '{"status":"Active"}' "$ADMIN")
check "admin approves" 200 "$code" "$(cat /tmp/cbody)"
assert "  status becomes Active" "Active" "$(g "r.data.status")"
req GET /categories '' "$USER" >/dev/null
assert "  now a public chip" "1" "$(g "r.data.filter(c=>c.id==='$CAT_P').length")"

echo "== reject =="
req POST /categories "{\"categoryName\":\"$REJECTED\"}" "$USER" >/dev/null
CAT_R=$(g "r.data.id")
code=$(req PATCH "/categories/admin/categories/$CAT_R/status" '{"status":"Disabled"}' "$ADMIN")
check "admin rejects" 200 "$code" "$(cat /tmp/cbody)"
assert "  status becomes Disabled" "Disabled" "$(g "r.data.status")"
req GET /categories '' "$USER" >/dev/null
assert "  stays out of the public chips" "0" "$(g "r.data.filter(c=>c.id==='$CAT_R').length")"
# A rejected category is kept, not deleted — an activity may still point at it.
code=$(req GET "/categories/admin/categories?search=Underwater" '' "$ADMIN")
assert "  the row still exists (not deleted)" "1" "$(g "r.data.categories.length")"

echo "== review guards =="
code=$(req PATCH "/categories/admin/categories/$CAT_R/status" '{"status":"Pending"}' "$ADMIN")
check "cannot review back into Pending" 400 "$code" "$(cat /tmp/cbody)"
code=$(req PATCH "/categories/admin/categories/$CAT_R/status" '{"status":"Nonsense"}' "$ADMIN")
check "unknown status rejected" 400 "$code" "$(cat /tmp/cbody)"
code=$(req PATCH "/categories/admin/categories/$CAT_R/status" '{"status":"Active"}' "$USER")
check "a normal user cannot approve" 403 "$code" "$(cat /tmp/cbody)"
code=$(req PATCH "/categories/admin/categories/notanid/status" '{"status":"Active"}' "$ADMIN")
check "malformed id rejected, not 500" 400 "$code" "$(cat /tmp/cbody)"

echo "== admin-added categories skip the queue =="
code=$(req POST /categories/admin/categories "{\"categoryName\":\"Admin Added $SUFFIX\"}" "$ADMIN")
check "admin add" 201 "$code" "$(cat /tmp/cbody)"
CAT_A=$(g "r.data.id")
assert "  live immediately, no review" "Active" "$(g "r.data.status")"

echo "== cleanup =="
req DELETE "/activities/$ACT_P" '' "$USER" >/dev/null
req DELETE "/activities/$ACT_W" '' "$USER" >/dev/null
for c in "$CAT_P" "$CAT_R" "$CAT_W" "$CAT_A"; do
  req DELETE "/categories/admin/categories/$c" '' "$ADMIN" >/dev/null
done
code=$(req GET "/categories/admin/categories?search=$SUFFIX" '' "$ADMIN")
assert "fixtures removed" "0" "$(g "r.data.categories.length")"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
