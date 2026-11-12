import { HIDDEN, maskContactInfo } from '@/core/contactMasking';
import { formatAddress, formatEgyptMobile, maskPhone, normalizeEgyptMobile, publicName, toLatinDigits, validateAddress } from '@/core/identity';

describe('Egyptian mobile numbers', () => {
  it.each([
    ['01012345678', '+201012345678'],
    ['+20 101 234 5678', '+201012345678'],
    ['00201112345678', '+201112345678'],
    ['201212345678', '+201212345678'],
    ['1512345678', '+201512345678'],
    ['010-1234-5678', '+201012345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '+201012345678'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeEgyptMobile(input)).toBe(expected);
  });

  it.each(['0101234567', '01312345678', '0225551234', '+447700900123', 'hello'])('rejects %s', (input) => {
    expect(normalizeEgyptMobile(input)).toBeNull();
  });

  it('formats and masks for display', () => {
    expect(formatEgyptMobile('+201012345678')).toBe('+20 101 234 5678');
    expect(maskPhone('+201012345678')).toBe('+20 10• ••• ••78');
    expect(toLatinDigits('رقم ٠١٢')).toBe('رقم 012');
  });

  it('only shows a first name and initial to other users', () => {
    expect(publicName('Karim Ahmed Matat')).toBe('Karim M.');
    expect(publicName('  Omar ')).toBe('Omar');
    expect(publicName('')).toBe('EVWorld user');
  });
});

describe('delivery addresses', () => {
  it('requires the fields a courier needs', () => {
    expect(Object.keys(validateAddress({}))).toEqual(expect.arrayContaining(['governorate', 'city', 'street', 'building']));
    expect(validateAddress({ governorate: 'Cairo', city: 'New Cairo', street: '90th Street', building: '12' })).toEqual({});
  });

  it('formats an address on one line with the landmark', () => {
    expect(
      formatAddress({ id: 'a', label: 'Home', governorate: 'Cairo', city: 'New Cairo', street: '90th Street', building: '12', floor: '3', apartment: '7', landmark: 'Point 90 Mall' }),
    ).toBe('Bldg 12, Floor 3, Apt 7, 90th Street, New Cairo, Cairo (near Point 90 Mall)');
  });
});

describe('chat contact masking', () => {
  it.each([
    'call me on 01012345678',
    'my number is 010 1234 5678',
    'رقمي ٠١٠١٢٣٤٥٦٧٨',
    'WhatsApp +20 101-234-5678 please',
    'email me at host@example.com',
    'add me wa.me/201012345678',
    'zero one zero one two three four five six seven eight',
  ])('hides contact details in "%s"', (msg) => {
    const r = maskContactInfo(msg);
    expect(r.masked).toBe(true);
    expect(r.text).toContain(HIDDEN);
    expect(r.text).not.toMatch(/\d{4}.*\d{4}/);
  });

  it.each(['The charger is 22 kW', 'I can come at 10:30 tomorrow', 'Price is EGP 1,500 for 120 kWh', 'Gate 3, building 12, flat 7', 'Total 165000 EGP'])(
    'keeps normal messages intact: "%s"',
    (msg) => {
      expect(maskContactInfo(msg)).toEqual({ text: msg, masked: false });
    },
  );
});
