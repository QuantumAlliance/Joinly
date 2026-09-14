#!/usr/bin/env bash
# Concurrency: one user firing repeated joins at one activity.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:all
# Override with API_URL / DB_CONTAINER / DB_NAME.
# Regression: ONE user firing N simultaneous joins at the same activity.
# Exactly 1 must succeed and joinedCount must land on 1 — the seat must not be
# taken once per in-flight request.
B="${API_URL:-http://localhost:4500/api/v1}"
TRIES=5

otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
    "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')" \
    | tr -d '\r\n'
}
tok() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.accessToken)}catch(e){}})"; }
jid() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.id)}catch(e){}})"; }

signup() {
  curl -s -X POST "$B/auth/register" -H 'Content-Type: application/json' \
    -d "{\"firstName\":\"R\",\"lastName\":\"U\",\"email\":\"$1\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
  curl -s -X POST "$B/auth/verify-otp" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"otpCode\":\"$(otp_for "$1")\"}" | tok
}

STAMP=$(date +%s)
ORG=$(signup "solo-org$STAMP@example.com")
SOLO=$(signup "solo$STAMP@example.com")
ADMIN=$(curl -s -X POST "$B/auth/admin/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@contenthub.io","password":"admin123"}' | tok)
CAT=$(curl -s "$B/categories" -H "Authorization: Bearer $ORG" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data[0].id)}catch(e){}})")

ACT=$(curl -s -X POST "$B/activities" -H 'Content-Type: application/json' -H "Authorization: Bearer $ORG" \
  -d "{\"activityName\":\"Solo Race $STAMP\",\"categoryId\":\"$CAT\",\"descriptions\":\"same-user race\",\"maximumNumberOfParticipants\":10,\"activityDate\":\"2030-06-01\",\"activityTime\":\"10:00\",\"activityDuration\":\"1 Hour\",\"activityLocation\":\"Park\",\"minAge\":18,\"maxAge\":80}" | jid)
curl -s -X PATCH "$B/activities/admin/activities/$ACT/status" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN" -d '{"status":"Approved"}' >/dev/null

echo "one user, $TRIES simultaneous joins on a 10-seat activity..."
rm -f /tmp/solo_*.code
for i in $(seq 1 $TRIES); do
  curl -s -o /dev/null -w '%{http_code}' -X POST "$B/participants/activities/$ACT/join" \
    -H "Authorization: Bearer $SOLO" > "/tmp/solo_$i.code" &
done
wait

codes=$(cat /tmp/solo_*.code | tr -d '\r\n')
ok201=$(echo "$codes" | grep -o '201' | wc -l | tr -d ' ')
c409=$(echo "$codes" | grep -o '409' | wc -l | tr -d ' ')
count=$(docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
  "print(db.activities.findOne({_id:ObjectId('$ACT')}).joinedCount)" | tr -d '\r\n')
rows=$(docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
  "print(db.activity_participants.countDocuments({activityId:ObjectId('$ACT'),status:'Joined'}))" | tr -d '\r\n')

echo "  raw codes:            $codes"
echo "  201 (joined):         $ok201"
echo "  409 (already/full):   $c409"
echo "  activity.joinedCount: $count   (expected 1)"
echo "  Joined rows:          $rows   (expected 1)"

fail=0
[ "$ok201" = "1" ] || { echo "  FAIL: expected exactly 1 successful join"; fail=1; }
[ "$count" = "1" ]  || { echo "  FAIL: joinedCount leaked to $count for a single participant"; fail=1; }
[ "$rows" = "1" ]   || { echo "  FAIL: $rows membership rows"; fail=1; }
[ "$fail" = 0 ] && echo "PASS - one user consumes exactly one seat" || echo "FAILED"
exit $fail
