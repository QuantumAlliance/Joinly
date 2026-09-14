#!/usr/bin/env bash
# Phase 6 — profile completeness ring.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:completeness
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
  args=(-s -o /tmp/kbody -w '%{http_code}' -X "$m" "$B$p")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  curl "${args[@]}"
}

g() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);process.stdout.write(String($1))}catch(e){}})" < /tmp/kbody; }

# Read one step's `done` flag straight off the ring.
step() { req GET /users/me/completeness '' "$1" >/dev/null; g "r.data.steps.find(s=>s.key==='$2').done"; }
pct()  { req GET /users/me/completeness '' "$1" >/dev/null; g "r.data.percentage"; }

otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
    "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')" \
    | tr -d '\r\n'
}

SUFFIX=$(date +%s)
EMAIL="ring.$SUFFIX@example.com"

echo "== setup =="
req POST /auth/register "{\"firstName\":\"Ada\",\"lastName\":\"Ring\",\"email\":\"$EMAIL\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
OTP=$(otp_for "$EMAIL")
req POST /auth/verify-otp "{\"email\":\"$EMAIL\",\"otpCode\":\"$OTP\"}" >/dev/null
USER=$(g "r.data.accessToken")
[ -n "$USER" ] || { echo "  FAIL setup"; exit 1; }
printf '  fresh account created (name only)\n'

echo "== the shape of the response =="
code=$(req GET /users/me/completeness '' "$USER")
check "completeness" 200 "$code" "$(cat /tmp/kbody)"
assert "  four steps, as the frame draws" "4" "$(g "r.data.steps.length")"
assert "  step keys in frame order" "name,interests,location,profilePhoto" "$(g "r.data.steps.map(s=>s.key).join(',')")"
assert "  every step carries a label" "4" "$(g "r.data.steps.filter(s=>s.label&&s.label.length>0).length")"
assert "  total is reported" "4" "$(g "r.data.total")"
code=$(req GET /users/me/completeness)
check "requires a token" 401 "$code" "$(cat /tmp/kbody)"

echo "== a fresh account: name only =="
assert "name done (required at registration)" "true" "$(step "$USER" name)"
assert "interests not done" "false" "$(step "$USER" interests)"
assert "location not done" "false" "$(step "$USER" location)"
assert "photo not done" "false" "$(step "$USER" profilePhoto)"
assert "percentage is 25" "25" "$(pct "$USER")"
assert "completed count agrees" "1" "$(g "r.data.completed")"

echo "== each step moves the ring =="
req GET /categories '' "$USER" >/dev/null
CAT3=$(g "r.data.slice(0,3).map(c=>'\"'+c.id+'\"').join(',')")
req PATCH /users/me/interests "{\"categoryIds\":[$CAT3]}" "$USER" >/dev/null
assert "interests selected -> done" "true" "$(step "$USER" interests)"
assert "  ring at 50" "50" "$(pct "$USER")"

req PATCH /users/me/location '{"country":"Switzerland","region":"Vaud","city":"Lausanne"}' "$USER" >/dev/null
assert "location set manually -> done" "true" "$(step "$USER" location)"
assert "  ring at 75" "75" "$(pct "$USER")"

req PATCH /users/me/profile-photo '{"profilePhoto":"/uploads/ring.png"}' "$USER" >/dev/null
assert "photo added -> done" "true" "$(step "$USER" profilePhoto)"
assert "  ring complete at 100" "100" "$(pct "$USER")"
assert "  all four steps done" "4" "$(g "r.data.steps.filter(s=>s.done).length")"

echo "== GPS alone also satisfies location =="
GPS="gps.$SUFFIX@example.com"
req POST /auth/register "{\"firstName\":\"Gus\",\"lastName\":\"Pin\",\"email\":\"$GPS\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
GOTP=$(otp_for "$GPS")
req POST /auth/verify-otp "{\"email\":\"$GPS\",\"otpCode\":\"$GOTP\"}" >/dev/null
GUSER=$(g "r.data.accessToken")
assert "location not done yet" "false" "$(step "$GUSER" location)"
req PATCH /users/me/location '{"latitude":46.5197,"longitude":6.6323}' "$GUSER" >/dev/null
# Coordinates alone are a complete answer — demanding a typed address too would
# mark a GPS user incomplete for using the permission prompt as designed.
assert "coordinates alone satisfy location" "true" "$(step "$GUSER" location)"
assert "  ring at 50" "50" "$(pct "$GUSER")"

echo "== the ring is derived, not stored =="
# Clearing the photo directly in the database must move the ring back.
docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet \
  --eval "db.users.updateOne({email:'$EMAIL'},{\$set:{profilePhoto:null}})" >/dev/null
assert "photo cleared -> step reverts" "false" "$(step "$USER" profilePhoto)"
assert "  ring back to 75" "75" "$(pct "$USER")"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
