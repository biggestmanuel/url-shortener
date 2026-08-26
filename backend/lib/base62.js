const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = ALPHABET.length;

export function encodeBase62(num) {
  if (!Number.isSafeInteger(num) || num < 0) {
    throw new Error('Base62 input must be a non-negative safe integer');
  }

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
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid Base62 character');
    num = num * BASE + index;
  }

  return num;
}
