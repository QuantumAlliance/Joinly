#!/usr/bin/env bash
# Phase 2 — dual-identity auth. Phone as a first-class login identifier.
#
# Requires: the API running, and the Mongo container up.
#   docker compose up -d && PORT=4500 npm run start:dev
#   npm run test:phone
# Override with API_URL / DB_CONTAINER / DB_NAME.
#
# Twilio is not needed: with TWILIO_* unset the code is logged instead of sent,
# and this script reads it straight from the database either way.
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
  args=(-s -o /tmp/pbody -w '%{http_code}' -X "$m" "$B$p")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  curl "${args[@]}"
}

# Latest unused OTP for an identifier (email or E.164), straight from the DB.
otp_for() {
  docker exec "${DB_CONTAINER:-arooby-db}" mongosh "${DB_NAME:-arooby}" --quiet --eval \
    "const o=db.otps.findOne({identifier:'$1',isUsed:false},{},{sort:{createdAt:-1}}); print(o?o.otpCode:'')" \
    | tr -d '\r\n'
}

# Read a top-level `data` field out of the last response body.
field() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(String(JSON.parse(s).data['$1']??''))}catch(e){}})" < /tmp/pbody
}

# Unique per run so the per-identifier budget is never the thing under test.
SUFFIX=$(date +%s)
CC="+41"
NUM1="79${SUFFIX: -7}"
NUM2="78${SUFFIX: -7}"
E164_1="${CC}${NUM1}"
E164_2="${CC}${NUM2}"
MAIL="phone.$SUFFIX@example.com"

echo "== registration from a phone number alone =="
code=$(req POST /auth/register "{\"firstName\":\"Pia\",\"lastName\":\"Renner\",\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM1\",\"password\":\"passw0rd\",\"acceptTerms\":true}")
check "register with phone only" 201 "$code" "$(cat /tmp/pbody)"

POTP=$(otp_for "$E164_1")
if [ -n "$POTP" ]; then
  pass=$((pass+1)); printf '  ok   %-46s %s\n' "OTP keyed on E.164, not email" "$POTP"
else
  fail=$((fail+1)); printf '  FAIL %-46s no OTP row for %s\n' "OTP keyed on E.164, not email" "$E164_1"
fi

echo "== the number is not a login until it is proven =="
code=$(req POST /auth/login "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM1\",\"password\":\"passw0rd\"}")
check "login by phone before verify" 403 "$code" "$(cat /tmp/pbody)"

echo "== verify =="
code=$(req POST /auth/phone/verify "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM1\",\"otpCode\":\"$POTP\"}")
check "verify phone (also signs in)" 200 "$code" "$(cat /tmp/pbody)"
code=$(req POST /auth/phone/verify "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM1\",\"otpCode\":\"$POTP\"}")
check "same phone OTP cannot be replayed" 400 "$code" "$(cat /tmp/pbody)"

echo "== login by phone =="
code=$(req POST /auth/login "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM1\",\"password\":\"passw0rd\"}")
check "login by phone" 200 "$code" "$(cat /tmp/pbody)"
code=$(req POST /auth/login "{\"phoneE164\":\"$E164_1\",\"password\":\"passw0rd\"}")
check "login by pre-joined phoneE164" 200 "$code" "$(cat /tmp/pbody)"
# A trunk '0' and punctuation are the same subscriber once normalised.
code=$(req POST /auth/login "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"0${NUM1:0:2} ${NUM1:2}\",\"password\":\"passw0rd\"}")
check "login normalises trunk 0 and spaces" 200 "$code" "$(cat /tmp/pbody)"
code=$(req POST /auth/login "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM1\",\"password\":\"wrong\"}")
check "login by phone rejects bad password" 401 "$code" "$(cat /tmp/pbody)"

echo "== identifier validation =="
code=$(req POST /auth/login "{\"password\":\"passw0rd\"}")
check "login with no identifier" 400 "$code" "$(cat /tmp/pbody)"
code=$(req POST /auth/login "{\"email\":\"a@b.com\",\"phoneE164\":\"$E164_1\",\"password\":\"x\"}")
check "login with both identifiers" 400 "$code" "$(cat /tmp/pbody)"
code=$(req POST /auth/phone/request-otp "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"12\"}")
check "malformed number rejected" 400 "$code" "$(cat /tmp/pbody)"

echo "== an unknown number is never messaged =="
code=$(req POST /auth/phone/request-otp "{\"phoneE164\":\"+4179000${SUFFIX: -4}\"}")
check "request-otp for unknown number" 400 "$code" "$(cat /tmp/pbody)"

echo "== rate limiting =="
# The registration above already sent one; the cooldown must reject the next.
code=$(req POST /auth/phone/request-otp "{\"phoneE164\":\"$E164_1\"}")
check "request-otp inside cooldown" 429 "$code" "$(cat /tmp/pbody)"

echo "== duplicate identity =="
code=$(req POST /auth/register "{\"firstName\":\"Imp\",\"lastName\":\"Ostor\",\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM1\",\"password\":\"passw0rd\",\"acceptTerms\":true}")
check "register with a verified phone" 409 "$code" "$(cat /tmp/pbody)"

echo "== linking a phone to an email account =="
req POST /auth/register "{\"firstName\":\"Linn\",\"lastName\":\"Kerr\",\"email\":\"$MAIL\",\"password\":\"passw0rd\",\"acceptTerms\":true}" >/dev/null
MOTP=$(otp_for "$MAIL")
req POST /auth/verify-otp "{\"email\":\"$MAIL\",\"otpCode\":\"$MOTP\"}" >/dev/null
TOKEN=$(field accessToken)

code=$(req POST /auth/phone/request-otp "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM2\"}" "$TOKEN")
check "signed-in user may claim a free number" 200 "$code" "$(cat /tmp/pbody)"
LOTP=$(otp_for "$E164_2")
code=$(req POST /auth/phone/verify "{\"phoneCountryCode\":\"$CC\",\"phoneNumber\":\"$NUM2\",\"otpCode\":\"$LOTP\"}" "$TOKEN")
check "link number to the account in hand" 200 "$code" "$(cat /tmp/pbody)"

code=$(req POST /auth/phone/request-otp "{\"phoneE164\":\"$E164_1\"}" "$TOKEN")
check "cannot claim another account's number" 409 "$code" "$(cat /tmp/pbody)"

echo "== that account now has two working logins =="
code=$(req POST /auth/login "{\"email\":\"$MAIL\",\"password\":\"passw0rd\"}")
check "login by email" 200 "$code" "$(cat /tmp/pbody)"
code=$(req POST /auth/login "{\"phoneE164\":\"$E164_2\",\"password\":\"passw0rd\"}")
check "login by the linked phone" 200 "$code" "$(cat /tmp/pbody)"

echo "== password recovery over SMS =="
# A phone-only account has no inbox; restricting reset to email would strand it.
sleep 61
code=$(req POST /auth/forgot-password "{\"phoneE164\":\"$E164_1\"}")
check "forgot-password by phone" 200 "$code" "$(cat /tmp/pbody)"
ROTP=$(otp_for "$E164_1")
code=$(req POST /auth/reset-password "{\"phoneE164\":\"$E164_1\",\"otpCode\":\"$ROTP\",\"newPassword\":\"newpass1\",\"confirmPassword\":\"newpass1\"}")
check "reset password by phone" 200 "$code" "$(cat /tmp/pbody)"
code=$(req POST /auth/login "{\"phoneE164\":\"$E164_1\",\"password\":\"newpass1\"}")
check "login with the new password" 200 "$code" "$(cat /tmp/pbody)"
code=$(req POST /auth/login "{\"phoneE164\":\"$E164_1\",\"password\":\"passw0rd\"}")
check "old password no longer works" 401 "$code" "$(cat /tmp/pbody)"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
