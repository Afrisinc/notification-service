// ---------------------------------------------------------------------------
// GSM-7 character set (basic + extended)
// ---------------------------------------------------------------------------
const GSM7_BASIC = new Set<string>([
  '@',
  '£',
  '$',
  '¥',
  'è',
  'é',
  'ù',
  'ì',
  'ò',
  'Ç',
  '\n',
  'Ø',
  'ø',
  '\r',
  'Å',
  'å',
  'Δ',
  '_',
  'Φ',
  'Γ',
  'Λ',
  'Ω',
  'Π',
  'Ψ',
  'Σ',
  'Θ',
  'Ξ',
  'Æ',
  'æ',
  'ß',
  'É',
  ' ',
  '!',
  '"',
  '#',
  '¤',
  '%',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  '-',
  '.',
  '/',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  ':',
  ';',
  '<',
  '=',
  '>',
  '?',
  '¡',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  'Ä',
  'Ö',
  'Ñ',
  'Ü',
  '§',
  '¿',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'ä',
  'ö',
  'ñ',
  'ü',
  'à',
]);

// Extended chars count as 2 GSM-7 units each
const GSM7_EXTENDED = new Set<string>(['^', '{', '}', '\\', '[', '~', ']', '|', '€', '\f']);

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export interface SmsSegmentResult {
  segments: number; // total SMS segments (billable units)
  encoding: 'GSM-7' | 'Unicode'; // character encoding used
  length: number; // character count (GSM-7 units or Unicode chars)
  charsPerSegment: number; // max chars per segment for this encoding
  charsUsedInLastSegment: number;
  charsRemainingInLastSegment: number;
  singleSmsLimit: number; // single-message limit for this encoding
  multipartLimit: number; // per-segment limit when multipart
}

export interface BatchSegmentResult extends SmsSegmentResult {
  text: string;
}

/**
 * Returns the GSM-7 character length of a string.
 * Extended characters count as 2 units.
 * Returns null if the string is NOT encodable in GSM-7.
 */
function getGsm7Length(text: string): number | null {
  let length = 0;
  for (const ch of text) {
    if (GSM7_BASIC.has(ch)) {
      length += 1;
    } else if (GSM7_EXTENDED.has(ch)) {
      length += 2; // escape + char
    } else {
      return null; // non-GSM-7 char found → Unicode required
    }
  }
  return length;
}

// Calculate SMS segments for a message.
export function calculateSmsSegments(text: string): SmsSegmentResult {
  if (typeof text !== 'string') {
    throw new TypeError('calculateSmsSegments: text must be a string');
  }

  const gsm7Length = getGsm7Length(text);
  const isGsm7 = gsm7Length !== null;
  const length = isGsm7 ? gsm7Length : [...text].length; // Unicode = code points

  const encoding = isGsm7 ? 'GSM-7' : 'Unicode';
  const singleSmsLimit = isGsm7 ? 160 : 70;
  const multipartLimit = isGsm7 ? 153 : 67;

  let segments: number;
  if (length === 0) {
    segments = 0;
  } else if (length <= singleSmsLimit) {
    segments = 1;
  } else {
    segments = Math.ceil(length / multipartLimit);
  }

  const effectiveLimit = segments <= 1 ? singleSmsLimit : multipartLimit;
  const charsUsedInLastSegment = length === 0 ? 0 : length % effectiveLimit || effectiveLimit;
  const charsRemainingInLastSegment = length === 0 ? singleSmsLimit : effectiveLimit - charsUsedInLastSegment;

  return {
    segments,
    encoding,
    length,
    charsPerSegment: effectiveLimit,
    charsUsedInLastSegment,
    charsRemainingInLastSegment,
    singleSmsLimit,
    multipartLimit,
  };
}

export function calculateBatchSegments(messages: string[]): BatchSegmentResult[] {
  if (!Array.isArray(messages)) {
    throw new TypeError('calculateBatchSegments: messages must be an array');
  }
  return messages.map((text) => ({ text, ...calculateSmsSegments(text) }));
}

//  Split a message into its actual SMS segment strings.
export function splitIntoSegments(text: string): string[] {
  const { segments, multipartLimit } = calculateSmsSegments(text);
  if (segments === 0) return [];
  if (segments === 1) return [text];

  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    parts.push(text.slice(i, i + multipartLimit));
    i += multipartLimit;
  }
  return parts;
}
