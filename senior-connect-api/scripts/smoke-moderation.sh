#!/usr/bin/env bash
# Phase 5 — participant moderation. Organizer removal, seat release, re-join bar.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:moderation
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
  args=(-s -o /tmp/mbody -w '%{http_code}' -X "$m" "$B$p")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  curl "${args[@]}"
}

g() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);process.stdout.write(String($1))}catch(e){}})" < /tmp/mbody; }

otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
    "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')" \
    | tr -d '\r\n'
}

db() { docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval "$1" | tr -d '\r\n'; }

signup() { # EMAIL -> token
  req POST /auth/register "{\"firstName\":\"$2\",\"lastName\":\"Mod\",\"email\":\"$1\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
  local otp; otp=$(otp_for "$1")
  req POST /auth/verify-otp "{\"email\":\"$1\",\"otpCode\":\"$otp\"}" >/dev/null
  g "r.data.accessToken"
}

SUFFIX=$(date +%s)

echo "== setup =="
req POST /auth/admin/login '{"email":"admin@contenthub.io","password":"admin123"}' >/dev/null
ADMIN=$(g "r.data.accessToken")
ORG=$(signup "org.$SUFFIX@example.com" "Orla")
P1=$(signup "p1.$SUFFIX@example.com" "Pat")
P1_ID=$(g "r.data.user.id")
P2=$(signup "p2.$SUFFIX@example.com" "Robin")
P2_ID=$(g "r.data.user.id")
OUTSIDER=$(signup "out.$SUFFIX@example.com" "Sam")
[ -n "$ORG" ] && [ -n "$P1" ] && [ -n "$P2" ] || { echo "  FAIL setup"; exit 1; }
printf '  organizer + 2 participants + outsider signed up\n'

req GET /categories '' "$ORG" >/dev/null
CAT=$(g "r.data[0].id")
req POST /activities "{\"activityName\":\"Moderation Drill $SUFFIX\",\"categoryId\":\"$CAT\",\"descriptions\":\"Phase 5 fixture\",\"maximumNumberOfParticipants\":3,\"activityDate\":\"2030-07-01\",\"activityTime\":\"10:00\",\"activityDuration\":\"1 hour\",\"activityLocation\":\"Field\",\"latitude\":46.5,\"longitude\":6.6,\"minAge\":18,\"maxAge\":90}" "$ORG" >/dev/null
ACT=$(g "r.data.id")
req PATCH "/activities/admin/activities/$ACT/status" '{"status":"Approved"}' "$ADMIN" >/dev/null
req POST "/participants/activities/$ACT/join" '' "$P1" >/dev/null
assert "two of three seats taken" "2/3" "$(req POST "/participants/activities/$ACT/join" '' "$P2" >/dev/null; g "r.data.participants")"

echo "== only the organizer may remove =="
code=$(req DELETE "/participants/activities/$ACT/participants/$P2_ID" '' "$P1")
check "another participant cannot remove" 403 "$code" "$(cat /tmp/mbody)"
code=$(req DELETE "/participants/activities/$ACT/participants/$P1_ID" '' "$OUTSIDER")
check "an outsider cannot remove" 403 "$code" "$(cat /tmp/mbody)"
code=$(req DELETE "/participants/activities/$ACT/participants/$P1_ID" '' "$ADMIN")
check "even an admin cannot (organizer-only)" 403 "$code" "$(cat /tmp/mbody)"
code=$(req DELETE "/participants/activities/$ACT/participants/$P1_ID")
check "removal requires a token" 401 "$code" "$(cat /tmp/mbody)"

echo "== the organizer removes a participant =="
code=$(req DELETE "/participants/activities/$ACT/participants/$P1_ID" '' "$ORG")
check "organizer removes" 200 "$code" "$(cat /tmp/mbody)"
assert "  the seat is released" "1/3" "$(g "r.data.participants")"
assert "  status is Removed, not Cancelled" "Removed" \
  "$(db "print((db.activity_participants.findOne({activityId:ObjectId('$ACT'),userId:ObjectId('$P1_ID')})||{}).status)")"
assert "  joinedCount matches the Joined rows" \
  "$(db "print(db.activity_participants.countDocuments({activityId:ObjectId('$ACT'),status:'Joined'}))")" \
  "$(db "print(db.activities.findOne({_id:ObjectId('$ACT')}).joinedCount)")"

req GET "/participants/activities/$ACT/participants" '' "$ORG" >/dev/null
assert "  gone from the participants list" "0" "$(g "r.data.filter(p=>p.userId==='$P1_ID').length")"
req GET /activities/joined-activities '' "$P1" >/dev/null
assert "  gone from their joined activities" "0" "$(g "r.data.filter(a=>a.id==='$ACT').length")"

echo "== removal sticks =="
code=$(req POST "/participants/activities/$ACT/join" '' "$P1")
check "a removed participant cannot re-join" 403 "$code" "$(cat /tmp/mbody)"
assert "  and the seat count is untouched" "1" \
  "$(db "print(db.activities.findOne({_id:ObjectId('$ACT')}).joinedCount)")"

echo "== removing twice does not double-release =="
code=$(req DELETE "/participants/activities/$ACT/participants/$P1_ID" '' "$ORG")
check "second removal is a 404" 404 "$code" "$(cat /tmp/mbody)"
assert "  joinedCount unchanged" "1" \
  "$(db "print(db.activities.findOne({_id:ObjectId('$ACT')}).joinedCount)")"

echo "== five simultaneous removals release exactly one seat =="
req POST "/participants/activities/$ACT/join" '' "$OUTSIDER" >/dev/null
OUT_ID=$(db "print(db.users.findOne({email:'out.$SUFFIX@example.com'})._id.toString())")
BEFORE=$(db "print(db.activities.findOne({_id:ObjectId('$ACT')}).joinedCount)")
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -X DELETE "$B/participants/activities/$ACT/participants/$OUT_ID" \
    -H "Authorization: Bearer $ORG" &
done
wait
AFTER=$(db "print(db.activities.findOne({_id:ObjectId('$ACT')}).joinedCount)")
assert "one seat released, not five" "$((BEFORE - 1))" "$AFTER"
assert "  joinedCount still matches Joined rows" \
  "$(db "print(db.activity_participants.countDocuments({activityId:ObjectId('$ACT'),status:'Joined'}))")" "$AFTER"

echo "== removal is not a block =="
req GET /users/me/blocked-users '' "$ORG" >/dev/null
assert "organizer's block list untouched" "0" "$(g "r.data.filter(u=>u.id==='$P1_ID').length")"
# The removed user still sees the organizer's other activities.
req GET "/activities/$ACT" '' "$P1" >/dev/null
assert "  removed user can still see the activity" "$ACT" "$(g "r.data.id")"
# Blocking stays a separate, explicit action.
code=$(req POST "/users/$P1_ID/block" '' "$ORG")
check "blocking is its own endpoint" 201 "$code" "$(cat /tmp/mbody)"
req GET /users/me/blocked-users '' "$ORG" >/dev/null
assert "  and now the block list has them" "1" "$(g "r.data.filter(u=>u.id==='$P1_ID').length")"

echo "== a voluntary leave still allows re-joining =="
code=$(req DELETE "/participants/activities/$ACT/leave" '' "$P2")
check "participant leaves" 200 "$code" "$(cat /tmp/mbody)"
code=$(req POST "/participants/activities/$ACT/join" '' "$P2")
check "  and may join again (Cancelled != Removed)" 201 "$code" "$(cat /tmp/mbody)"

echo "== bad input =="
code=$(req DELETE "/participants/activities/$ACT/participants/notanid" '' "$ORG")
check "malformed user id rejected, not 500" 400 "$code" "$(cat /tmp/mbody)"
code=$(req DELETE "/participants/activities/notanid/participants/$P1_ID" '' "$ORG")
check "malformed activity id rejected, not 500" 400 "$code" "$(cat /tmp/mbody)"
ORG_ID=$(db "print(db.users.findOne({email:'org.$SUFFIX@example.com'})._id.toString())")
code=$(req DELETE "/participants/activities/$ACT/participants/$ORG_ID" '' "$ORG")
check "organizer cannot remove themselves" 400 "$code" "$(cat /tmp/mbody)"

echo "== cleanup =="
req POST "/users/$P1_ID/block" '' "$ORG" >/dev/null
curl -s -o /dev/null -X DELETE "$B/users/$P1_ID/block" -H "Authorization: Bearer $ORG"
code=$(req DELETE "/activities/$ACT" '' "$ORG")
check "fixture removed" 200 "$code" "$(cat /tmp/mbody)"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
