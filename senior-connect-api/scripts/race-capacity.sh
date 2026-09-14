#!/usr/bin/env bash
# Concurrency: many users rushing a limited-seat activity.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:all
# Override with API_URL / DB_CONTAINER / DB_NAME.
# Concurrency check: 6 users rush a 2-seat activity at once.
# Exactly 2 must get in, and joinedCount must end at 2 — not 3+.
B="${API_URL:-http://localhost:4500/api/v1}"
SEATS=2
RUSHERS=6

otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
    "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')" \
    | tr -d '\r\n'
}
tok() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.accessToken)}catch(e){}})"; }
jid() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.id)}catch(e){}})"; }

signup() { # EMAIL -> token
  curl -s -X POST "$B/auth/register" -H 'Content-Type: application/json' \
    -d "{\"firstName\":\"R\",\"lastName\":\"User\",\"email\":\"$1\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
  curl -s -X POST "$B/auth/verify-otp" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"otpCode\":\"$(otp_for "$1")\"}" | tok
}

STAMP=$(date +%s)
echo "creating organizer and a $SEATS-seat activity..."
ORG=$(signup "org$STAMP@example.com")
ADMIN=$(curl -s -X POST "$B/auth/admin/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@contenthub.io","password":"admin123"}' | tok)
CAT=$(curl -s "$B/categories" -H "Authorization: Bearer $ORG" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data[0].id)}catch(e){}})")

ACT=$(curl -s -X POST "$B/activities" -H 'Content-Type: application/json' -H "Authorization: Bearer $ORG" \
  -d "{\"activityName\":\"Race Test\",\"categoryId\":\"$CAT\",\"descriptions\":\"capacity race\",\"maximumNumberOfParticipants\":$SEATS,\"activityDate\":\"2030-06-01\",\"activityTime\":\"10:00\",\"activityDuration\":\"1 Hour\",\"activityLocation\":\"Park\",\"minAge\":18,\"maxAge\":80}" | jid)
curl -s -X PATCH "$B/activities/admin/activities/$ACT/status" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN" -d '{"status":"Approved"}' >/dev/null

echo "signing up $RUSHERS rushers..."
TOKENS=()
for i in $(seq 1 $RUSHERS); do TOKENS+=("$(signup "rush$STAMP-$i@example.com")"); done

echo "all $RUSHERS joining simultaneously..."
rm -f /tmp/race_*.code
for i in $(seq 1 $RUSHERS); do
  curl -s -o /dev/null -w '%{http_code}' -X POST "$B/participants/activities/$ACT/join" \
    -H "Authorization: Bearer ${TOKENS[$((i-1))]}" > "/tmp/race_$i.code" &
done
wait

echo "  raw codes: $(cat /tmp/race_*.code | tr '
' ' ')"
joined=$(cat /tmp/race_*.code | tr -d '
' | grep -o '201' | wc -l | tr -d ' ')
full=$(cat /tmp/race_*.code | tr -d '
' | grep -o '409' | wc -l | tr -d ' ')
echo "  201 (joined): $joined"
echo "  409 (full):   $full"

count=$(docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
  "print(db.activities.findOne({_id:ObjectId('$ACT')}).joinedCount)" | tr -d '\r\n')
rows=$(docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
  "print(db.activity_participants.countDocuments({activityId:ObjectId('$ACT'),status:'Joined'}))" | tr -d '\r\n')
echo "  activity.joinedCount:   $count"
echo "  Joined participant rows: $rows"

ok=1
[ "$joined" = "$SEATS" ] || { echo "  FAIL: expected exactly $SEATS successful joins"; ok=0; }
[ "$count" = "$SEATS" ]  || { echo "  FAIL: joinedCount drifted to $count"; ok=0; }
[ "$rows" = "$SEATS" ]   || { echo "  FAIL: $rows membership rows, expected $SEATS"; ok=0; }
[ "$ok" = 1 ] && echo "PASS - capacity held under concurrency" || echo "FAILED"
exit $((1-ok))
