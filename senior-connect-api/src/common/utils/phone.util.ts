/**
 * Phone numbers as a login identifier.
 *
 * The Figma phone field is a country selector plus a local number, so the API
 * surface keeps that split (`phoneCountryCode` + `phoneNumber`). Neither half
 * is a usable unique key on its own — "+41" / "079 123 45 67" and "+41" /
 * "79 123 45 67" are the same subscriber — so the pair is canonicalised into
 * one E.164 string (`phoneE164`) and *that* is what carries the unique index
 * and what OTPs are keyed on.
 *
 * Deliberately dependency-free: a full libphonenumber pulls a ~150 kB metadata
 * table to buy per-country length rules we do not need. E.164 shape is enough
 * to guarantee "one subscriber, one row".
 */

/** E.164: a leading '+', a non-zero first digit, 15 digits maximum. */
const E164 = /^\+[1-9]\d{6,14}$/;

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * Canonicalise a dial code + local number into E.164, or null when the pair
 * cannot form a valid number. Callers turn null into a 400 — never store an
 * un-normalised number, or the unique index stops meaning anything.
 *
 * Tolerates the shapes a phone keypad actually produces: spaces, dashes,
 * parentheses, a dial code typed with or without its '+', and a national
 * trunk '0' prefix on the local part ("079…" → "79…").
 */
export const normalizePhone = (
  phoneCountryCode: string | null | undefined,
  phoneNumber: string | null | undefined,
): string | null => {
  if (!phoneCountryCode || !phoneNumber) return null;

  const dial = digitsOnly(phoneCountryCode);
  let local = digitsOnly(phoneNumber);
  if (!dial || !local) return null;

  // A local number keyed with its national trunk prefix ("079…") is the same
  // subscriber as "79…" once the country code is in front of it.
  while (local.startsWith('0')) local = local.slice(1);
  if (!local) return null;

  const candidate = `+${dial}${local}`;
  return E164.test(candidate) ? candidate : null;
};

/** Canonicalise a number already written in full ("+41791234567"). */
export const normalizeE164 = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const candidate = `+${digitsOnly(value)}`;
  return E164.test(candidate) ? candidate : null;
};

/**
 * Resolve whichever phone shape a request supplied — the Figma split, a
 * pre-joined E.164 string, or both — into one canonical number.
 */
export const resolvePhone = (input: {
  phoneE164?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
}): string | null =>
  normalizeE164(input.phoneE164) ?? normalizePhone(input.phoneCountryCode, input.phoneNumber);

/**
 * Mask a number for logs and error messages. Support transcripts and console
 * output should never carry a full subscriber number.
 */
export const maskPhone = (e164: string): string =>
  e164.length <= 5 ? e164 : `${e164.slice(0, 3)}${'•'.repeat(e164.length - 5)}${e164.slice(-2)}`;
