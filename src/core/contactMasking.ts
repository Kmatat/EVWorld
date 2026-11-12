import { toLatinDigits } from './identity';

/**
 * CONTACT MASKING FOR IN-APP CHAT
 * ===============================
 * Users talk inside EVWorld, never by phone. That protects them from spam
 * and harassment (a home charger's location is public), keeps a record if
 * there is a dispute, and keeps payments on the platform.
 *
 * Messages that contain phone numbers, emails, or WhatsApp / Telegram /
 * social links get those parts replaced before anyone sees them. The same
 * rule runs on the server, so a modified app can't bypass it.
 */

export const HIDDEN = '[contact hidden]';

// A run of digits and common separators (spaces, dots, dashes, brackets, plus).
const DIGIT_RUN = /\+?[\d٠-٩۰-۹][\d٠-٩۰-۹\s.\-()]{6,}[\d٠-٩۰-۹]/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LINKS = /(https?:\/\/)?(www\.)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|instagram\.com|facebook\.com|fb\.me|m\.me)\/\S*/gi;
// People spell numbers out to dodge filters: "zero one zero ...".
const SPELLED = /\b(zero|one|two|three|four|five|six|seven|eight|nine)(\W+(zero|one|two|three|four|five|six|seven|eight|nine)){6,}\b/gi;

export interface MaskResult {
  text: string;
  masked: boolean;
}

export function maskContactInfo(input: string): MaskResult {
  let masked = false;
  const replace = (s: string, re: RegExp, test?: (m: string) => boolean) =>
    s.replace(re, (m) => {
      if (test && !test(m)) return m;
      masked = true;
      return HIDDEN;
    });

  let text = replace(input, LINKS);
  text = replace(text, EMAIL);
  text = replace(text, SPELLED);
  // Only mask digit runs long enough to be a phone number (9+ digits), so
  // prices ("EGP 1,500"), power ("22 kW") and times ("10:30") stay visible.
  text = replace(text, DIGIT_RUN, (m) => toLatinDigits(m).replace(/\D/g, '').length >= 9);
  return { text, masked };
}
