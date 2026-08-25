// Base62 = 0-9, a-z, A-Z (62 characters). Turning a plain incrementing
// database ID into base62 is why short codes look like "aB3xK9" instead
// of "1000000" — same information, far fewer characters, because each
// digit position can represent 62 values instead of 10.
//
// This only works because `id` comes from a Postgres bigserial column
// (see schema.sql) — the database guarantees it's unique and
// ever-increasing, so encoding it can never collide. That's the whole
// trick: you're not "generating a random string and hoping it's
// unique," you're deterministically encoding a number the database
// already guaranteed was unique.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = ALPHABET.length; // 62

export function encodeBase62(num) {
  if (num === 0) return ALPHABET[0];
  let encoded = '';
  let n = num;
  while (n > 0) {
    encoded = ALPHABET[n % BASE] + encoded;
    n = Math.floor(n / BASE);
  }
  return encoded;
}

export function decodeBase62(str) {
  let num = 0;
  for (const char of str) {
    num = num * BASE + ALPHABET.indexOf(char);
  }
  return num;
}
