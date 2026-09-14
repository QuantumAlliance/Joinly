#!/usr/bin/env bash
# Phase 7 — notification targeting by interest.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:targeting
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
  args=(-s -o /tmp/tbody -w '%{http_code}' -X "$m" "$B$p")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  curl "${args[@]}"
}

g() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);process.stdout.write(String($1))}catch(e){}})" < /tmp/tbody; }

otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
    "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')" \
    | tr -d '\r\n'
}

signup() { # EMAIL FIRSTNAME -> token
  req POST /auth/register "{\"firstName\":\"$2\",\"lastName\":\"Seg\",\"email\":\"$1\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
  local otp; otp=$(otp_for "$1")
  req POST /auth/verify-otp "{\"email\":\"$1\",\"otpCode\":\"$otp\"}" >/dev/null
  g "r.data.accessToken"
}

unread() { req GET /notifications/unread-count '' "$1" >/dev/null; g "r.data.unreadCount"; }

SUFFIX=$(date +%s)

echo "== setup =="
req POST /auth/admin/login '{"email":"admin@contenthub.io","password":"admin123"}' >/dev/null
ADMIN=$(g "r.data.accessToken")
SWIM=$(signup "swim.$SUFFIX@example.com" "Sasha")
GOLF=$(signup "golf.$SUFFIX@example.com" "Gale")
[ -n "$ADMIN" ] && [ -n "$SWIM" ] && [ -n "$GOLF" ] || { echo "  FAIL setup"; exit 1; }

req GET /categories '' "$ADMIN" >/dev/null
CAT_SWIM=$(g "r.data.find(c=>c.categoryName==='Swimming').id")
CAT_GOLF=$(g "r.data.find(c=>c.categoryName==='Golf').id")
CAT_BOX=$(g "r.data.find(c=>c.categoryName==='Boxing').id")
CAT_TEN=$(g "r.data.find(c=>c.categoryName==='Tennis').id")

# Two users with disjoint interests, so a segment provably excludes someone.
req PATCH /users/me/interests "{\"categoryIds\":[\"$CAT_SWIM\",\"$CAT_BOX\",\"$CAT_TEN\"]}" "$SWIM" >/dev/null
req PATCH /users/me/interests "{\"categoryIds\":[\"$CAT_GOLF\",\"$CAT_BOX\",\"$CAT_TEN\"]}" "$GOLF" >/dev/null
printf '  swimmer + golfer, disjoint on Swimming/Golf\n'

SWIM_BEFORE=$(unread "$SWIM"); GOLF_BEFORE=$(unread "$GOLF")

echo "== the retired audiences are gone =="
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"Legacy $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Seniors\"}" "$ADMIN")
check "audience Seniors rejected" 400 "$code" "$(cat /tmp/tbody)"
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"Legacy $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Volunteers\"}" "$ADMIN")
check "audience Volunteers rejected" 400 "$code" "$(cat /tmp/tbody)"
code=$(req GET '/notifications/admin/notifications?audience=Seniors' '' "$ADMIN")
check "  and cannot be filtered on either" 400 "$code" "$(cat /tmp/tbody)"
assert "no legacy rows survive in the database" "0" \
  "$(docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval "print(db.notifications.countDocuments({audience:{\$in:['Seniors','Volunteers']}}))" | tr -d '\r\n')"

echo "== the two halves must agree =="
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"T $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Interests\"}" "$ADMIN")
check "Interests with no categories rejected" 400 "$code" "$(cat /tmp/tbody)"
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"T $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Everyone\",\"audienceCategoryIds\":[\"$CAT_SWIM\"]}" "$ADMIN")
check "Everyone with categories rejected" 400 "$code" "$(cat /tmp/tbody)"
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"T $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Interests\",\"audienceCategoryIds\":[\"000000000000000000000000\"]}" "$ADMIN")
check "unknown category rejected" 400 "$code" "$(cat /tmp/tbody)"
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"T $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Interests\",\"audienceCategoryIds\":[\"notanid\"]}" "$ADMIN")
check "malformed category id rejected, not 500" 400 "$code" "$(cat /tmp/tbody)"

echo "== an interest broadcast reaches only that segment =="
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"Swim news $SUFFIX\",\"messageContent\":\"Lane closures\",\"audience\":\"Interests\",\"audienceCategoryIds\":[\"$CAT_SWIM\"]}" "$ADMIN")
check "send to Swimming" 201 "$code" "$(cat /tmp/tbody)"
assert "  audience is Interests" "Interests" "$(g "r.data.audience")"
assert "  the category is named back" "Swimming" "$(g "r.data.audienceCategories[0].categoryName")"
RC=$(g "r.data.recipientCount")
[ "$RC" -ge 1 ] && { pass=$((pass+1)); printf '  ok   %-48s %s\n' "  recipientCount recorded" "$RC"; } \
                || { fail=$((fail+1)); printf '  FAIL %-48s %s\n' "  recipientCount recorded" "$RC"; }
assert "swimmer received it" "$((SWIM_BEFORE + 1))" "$(unread "$SWIM")"
assert "golfer did NOT receive it" "$GOLF_BEFORE" "$(unread "$GOLF")"

echo "== a user matching two targeted categories gets one copy =="
SWIM_B=$(unread "$SWIM")
req POST /notifications/admin/notifications "{\"notificationTitle\":\"Multi $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Interests\",\"audienceCategoryIds\":[\"$CAT_BOX\",\"$CAT_TEN\"]}" "$ADMIN" >/dev/null
# Read everything off this response before any other request overwrites the body.
NID=$(g "r.data.id")
MULTI_CATS=$(g "r.data.audienceCategories.length")
assert "one delivery row, not two" "1" \
  "$(docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval "print(db.user_notifications.countDocuments({notificationId:ObjectId('$NID')},{}) && db.user_notifications.countDocuments({notificationId:ObjectId('$NID'),userId:db.users.findOne({email:'swim.$SUFFIX@example.com'})._id}))" | tr -d '\r\n')"
assert "  badge moved by exactly one" "$((SWIM_B + 1))" "$(unread "$SWIM")"
assert "  both categories named in history" "2" "$MULTI_CATS"

echo "== a segment nobody matches is empty, not failed =="
req POST /categories/admin/categories "{\"categoryName\":\"Orienteering $SUFFIX\"}" "$ADMIN" >/dev/null
LONELY=$(g "r.data.id")
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"Nobody $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Interests\",\"audienceCategoryIds\":[\"$LONELY\"]}" "$ADMIN")
check "send to an unused category" 201 "$code" "$(cat /tmp/tbody)"
# Nothing broke — the audience is simply empty. recipientCount is what tells
# the admin the difference, which "Delivered" alone cannot.
assert "  status is Delivered" "Delivered" "$(g "r.data.status")"
assert "  recipientCount is 0" "0" "$(g "r.data.recipientCount")"

echo "== Everyone still reaches everyone =="
SWIM_C=$(unread "$SWIM"); GOLF_C=$(unread "$GOLF")
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"All $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Everyone\"}" "$ADMIN")
check "send to Everyone" 201 "$code" "$(cat /tmp/tbody)"
assert "  no categories attached" "0" "$(g "r.data.audienceCategories.length")"
assert "swimmer received it" "$((SWIM_C + 1))" "$(unread "$SWIM")"
assert "golfer received it too" "$((GOLF_C + 1))" "$(unread "$GOLF")"
# The Figma compose card sends no audience at all.
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"Default $SUFFIX\",\"messageContent\":\"m\"}" "$ADMIN")
check "omitting audience defaults to Everyone" 201 "$code" "$(cat /tmp/tbody)"
assert "  audience is Everyone" "Everyone" "$(g "r.data.audience")"

echo "== history renders the segment =="
code=$(req GET '/notifications/admin/notifications?audience=Interests&limit=50' '' "$ADMIN")
check "filter on Interests" 200 "$code" "$(cat /tmp/tbody)"
assert "  every row names its categories or is empty" "0" \
  "$(g "r.data.filter(n=>!Array.isArray(n.audienceCategories)).length")"
assert "  the swim broadcast is listed by name" "1" \
  "$(g "r.data.filter(n=>n.notificationTitle==='Swim news $SUFFIX'&&n.audienceCategories.some(c=>c.categoryName==='Swimming')).length")"
req GET /notifications '' "$SWIM" >/dev/null
assert "mobile inbox carries the segment too" "1" \
  "$(g "r.data.filter(n=>n.notificationTitle==='Swim news $SUFFIX').length")"

echo "== guards =="
code=$(req POST /notifications/admin/notifications "{\"notificationTitle\":\"X $SUFFIX\",\"messageContent\":\"m\",\"audience\":\"Interests\",\"audienceCategoryIds\":[\"$CAT_SWIM\"]}" "$SWIM")
check "a normal user cannot broadcast" 403 "$code" "$(cat /tmp/tbody)"

echo "== cleanup =="
req DELETE "/categories/admin/categories/$LONELY" '' "$ADMIN" >/dev/null
docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet \
  --eval "const ids=db.notifications.find({notificationTitle:/$SUFFIX/}).toArray().map(n=>n._id); db.user_notifications.deleteMany({notificationId:{\$in:ids}}); db.notifications.deleteMany({_id:{\$in:ids}})" >/dev/null
assert "fixtures removed" "0" \
  "$(docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval "print(db.notifications.countDocuments({notificationTitle:/$SUFFIX/}))" | tr -d '\r\n')"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
