#!/usr/bin/env bash
# Full endpoint sweep across every module. 51 checks.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:all
# Override with API_URL / DB_CONTAINER / DB_NAME.
# Phase 0 smoke test: exercise every module against MongoDB.
B="${API_URL:-http://localhost:4500/api/v1}"
pass=0; fail=0

# check NAME EXPECTED_HTTP ACTUAL_HTTP BODY
check() {
  if [ "$2" = "$3" ]; then
    pass=$((pass+1)); printf '  ok   %-42s %s\n' "$1" "$3"
  else
    fail=$((fail+1)); printf '  FAIL %-42s expected %s got %s\n     %s\n' "$1" "$2" "$3" "$(echo "$4" | head -c 200)"
  fi
}

req() { # METHOD PATH [DATA] [TOKEN]
  local m="$1"
  local p="$2"
  local d="$3"
  local t="$4"
  local args
  args=(-s -o /tmp/body -w '%{http_code}' -X "$m" "$B$p")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  curl "${args[@]}"
}

# Latest unused OTP for an address, straight from the database.
otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval     "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')"     | tr -d '
'
}

echo "== auth =="
code=$(req POST /auth/admin/login '{"email":"admin@contenthub.io","password":"admin123"}')
body=$(cat /tmp/body); check "admin login" 200 "$code" "$body"
ADMIN=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.accessToken)}catch(e){}})")

code=$(req POST /auth/admin/login '{"email":"admin@contenthub.io","password":"wrong"}')
check "admin login rejects bad password" 401 "$code" "$(cat /tmp/body)"

USER_EMAIL="smoke$(date +%s)@example.com"
code=$(req POST /auth/register "{\"firstName\":\"Smoke\",\"lastName\":\"Test\",\"email\":\"$USER_EMAIL\",\"password\":\"passw0rd\",\"acceptTerms\":true}")
check "register" 201 "$code" "$(cat /tmp/body)"

OTP=$(otp_for "$USER_EMAIL")
code=$(req POST /auth/verify-otp "{\"email\":\"$USER_EMAIL\",\"otpCode\":\"$OTP\"}")
body=$(cat /tmp/body); check "verify OTP (consumes code)" 200 "$code" "$body"
USER=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.accessToken)}catch(e){}})")

code=$(req POST /auth/verify-otp "{\"email\":\"$USER_EMAIL\",\"otpCode\":\"$OTP\"}")
check "same OTP cannot be replayed" 400 "$code" "$(cat /tmp/body)"

echo "== guards =="
check "protected route without token" 401 "$(req GET /users/me)" "$(cat /tmp/body)"
check "admin route as normal user" 403 "$(req GET /users/admin/users '' "$USER")" "$(cat /tmp/body)"

echo "== categories =="
code=$(req GET /categories '' "$USER"); body=$(cat /tmp/body); check "list active categories" 200 "$code" "$body"
CAT=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data[0].id)}catch(e){}})")
CAT3=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.slice(0,3).map(c=>'\"'+c.id+'\"').join(','))}catch(e){}})")
check "admin categories + stats" 200 "$(req GET '/categories/admin/categories?page=1&limit=5' '' "$ADMIN")" "$(cat /tmp/body)"
check "category search (regex path)" 200 "$(req GET '/categories/admin/categories?search=foot' '' "$ADMIN")" "$(cat /tmp/body)"
check "duplicate category rejected" 409 "$(req POST /categories/admin/categories '{"categoryName":"Football"}' "$ADMIN")" "$(cat /tmp/body)"

echo "== users =="
check "my profile (aggregations)" 200 "$(req GET /users/me '' "$USER")" "$(cat /tmp/body)"
check "update interests (min 3)" 200 "$(req PATCH /users/me/interests "{\"categoryIds\":[$CAT3]}" "$USER")" "$(cat /tmp/body)"
check "update location (geo mirror)" 200 "$(req PATCH /users/me/location '{"latitude":46.8,"longitude":8.2,"country":"Switzerland"}' "$USER")" "$(cat /tmp/body)"
check "app preferences" 200 "$(req PATCH /users/me/app-preferences '{"dateFormat":"DD/MM/YYYY"}' "$USER")" "$(cat /tmp/body)"
check "blocked users list" 200 "$(req GET /users/me/blocked-users '' "$USER")" "$(cat /tmp/body)"
check "admin users list" 200 "$(req GET '/users/admin/users?page=1&limit=10' '' "$ADMIN")" "$(cat /tmp/body)"
check "admin users search" 200 "$(req GET '/users/admin/users?search=smoke' '' "$ADMIN")" "$(cat /tmp/body)"
check "malformed id rejected, not 500" 400 "$(req GET /users/admin/users/not-an-id '' "$ADMIN")" "$(cat /tmp/body)"

echo "== activities =="
code=$(req POST /activities "{\"activityName\":\"Smoke Hike\",\"categoryId\":\"$CAT\",\"descriptions\":\"A test hike\",\"maximumNumberOfParticipants\":2,\"activityDate\":\"2030-06-01\",\"activityTime\":\"10:00\",\"activityDuration\":\"1 Hour\",\"activityLocation\":\"Test Park\",\"latitude\":46.81,\"longitude\":8.21,\"minAge\":18,\"maxAge\":80}" "$USER")
body=$(cat /tmp/body); check "create activity" 201 "$code" "$body"
ACT=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.id)}catch(e){}})")

check "admin list pending" 200 "$(req GET '/activities/admin/activities?status=Pending' '' "$ADMIN")" "$(cat /tmp/body)"
check "admin approve" 200 "$(req PATCH "/activities/admin/activities/$ACT/status" '{"status":"Approved"}' "$ADMIN")" "$(cat /tmp/body)"
check "discover" 200 "$(req GET '/activities?page=1&limit=10' '' "$USER")" "$(cat /tmp/body)"
check "discover with geo radius" 200 "$(req GET '/activities?latitude=46.8&longitude=8.2&maxDistance=50' '' "$USER")" "$(cat /tmp/body)"
check "discover map view" 200 "$(req GET '/activities?view=map' '' "$USER")" "$(cat /tmp/body)"
check "discover search" 200 "$(req GET '/activities?search=smoke' '' "$USER")" "$(cat /tmp/body)"
check "featured" 200 "$(req GET /activities/featured '' "$USER")" "$(cat /tmp/body)"
check "my activities" 200 "$(req GET '/activities/my-activities?tab=Upcoming' '' "$USER")" "$(cat /tmp/body)"
check "joined activities" 200 "$(req GET /activities/joined-activities '' "$USER")" "$(cat /tmp/body)"
check "activity details" 200 "$(req GET "/activities/$ACT" '' "$USER")" "$(cat /tmp/body)"

echo "== participants (capacity guard) =="
check "organizer cannot join own" 400 "$(req POST "/participants/activities/$ACT/join" '' "$USER")" "$(cat /tmp/body)"

# second user joins
J_EMAIL="joiner$(date +%s)@example.com"
req POST /auth/register "{\"firstName\":\"Jo\",\"lastName\":\"Iner\",\"email\":\"$J_EMAIL\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
JOTP=$(otp_for "$J_EMAIL")
body=$(req POST /auth/verify-otp "{\"email\":\"$J_EMAIL\",\"otpCode\":\"$JOTP\"}" >/dev/null; cat /tmp/body)
JOINER=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.accessToken)}catch(e){}})")

check "join activity" 201 "$(req POST "/participants/activities/$ACT/join" '' "$JOINER")" "$(cat /tmp/body)"
check "double join rejected" 409 "$(req POST "/participants/activities/$ACT/join" '' "$JOINER")" "$(cat /tmp/body)"
check "participants list" 200 "$(req GET "/participants/activities/$ACT/participants" '' "$USER")" "$(cat /tmp/body)"
check "leave activity" 200 "$(req DELETE "/participants/activities/$ACT/leave" '' "$JOINER")" "$(cat /tmp/body)"
check "leave twice rejected" 404 "$(req DELETE "/participants/activities/$ACT/leave" '' "$JOINER")" "$(cat /tmp/body)"

echo "== favorites =="
check "add favorite" 201 "$(req POST "/favorites/activities/$ACT" '' "$JOINER")" "$(cat /tmp/body)"
check "duplicate favorite rejected" 409 "$(req POST "/favorites/activities/$ACT" '' "$JOINER")" "$(cat /tmp/body)"
check "list favorites" 200 "$(req GET /favorites '' "$JOINER")" "$(cat /tmp/body)"
check "remove favorite" 200 "$(req DELETE "/favorites/activities/$ACT" '' "$JOINER")" "$(cat /tmp/body)"

echo "== notifications =="
check "compose broadcast" 201 "$(req POST /notifications/admin/notifications '{"notificationTitle":"Smoke","messageContent":"Hello from the smoke test"}' "$ADMIN")" "$(cat /tmp/body)"
check "admin history" 200 "$(req GET '/notifications/admin/notifications?page=1&limit=5' '' "$ADMIN")" "$(cat /tmp/body)"
check "my notifications" 200 "$(req GET /notifications '' "$JOINER")" "$(cat /tmp/body)"

echo "== dashboard =="
check "statistics" 200 "$(req GET /dashboard/statistics '' "$ADMIN")" "$(cat /tmp/body)"
check "category distribution (\$lookup)" 200 "$(req GET /dashboard/category-distribution '' "$ADMIN")" "$(cat /tmp/body)"
check "recent users" 200 "$(req GET /dashboard/recent-users '' "$ADMIN")" "$(cat /tmp/body)"
check "recent activities" 200 "$(req GET /dashboard/recent-activities '' "$ADMIN")" "$(cat /tmp/body)"
check "admin user details" 200 "$(req GET "/users/admin/users/$(curl -s "$B/users/admin/users?limit=1" -H "Authorization: Bearer $ADMIN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data[0].id)}catch(e){}})")" '' "$ADMIN")" "$(cat /tmp/body)"

echo "== contact =="
check "public contact" 200 "$(req GET /contact)" "$(cat /tmp/body)"
check "admin contact update" 200 "$(req PATCH /contact/admin/contact '{"email":"support@arooby.io","phoneNumber":"+41000000"}' "$ADMIN")" "$(cat /tmp/body)"

echo "== cleanup =="
check "organizer deletes activity" 200 "$(req DELETE "/activities/$ACT" '' "$USER")" "$(cat /tmp/body)"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
