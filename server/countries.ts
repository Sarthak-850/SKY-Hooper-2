/**
 * ISO 3166-1 Country database with emoji flags and helpers
 */

import { CountryInfo } from '../src/types/leaderboard.ts';

/**
 * Generate Unicode Flag Emoji from 2-letter ISO code
 */
export function getFlagEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '🌐';
  const codePoints = code
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export const COUNTRIES_LIST: CountryInfo[] = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
];

const countryMap = new Map<string, CountryInfo>();
for (const country of COUNTRIES_LIST) {
  countryMap.set(country.code.toUpperCase(), country);
}

export function findCountry(queryOrCode: string): CountryInfo {
  const clean = queryOrCode.trim().toUpperCase();
  if (countryMap.has(clean)) {
    return countryMap.get(clean)!;
  }
  const byName = COUNTRIES_LIST.find((c) => c.name.toLowerCase() === queryOrCode.trim().toLowerCase());
  if (byName) {
    return byName;
  }
  // Fallback to generated emoji
  if (clean.length === 2) {
    return {
      code: clean,
      name: queryOrCode.trim(),
      flag: getFlagEmoji(clean),
    };
  }
  return {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
  };
}
