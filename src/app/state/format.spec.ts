import { formatClock, formatNumber } from './format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [240, '240'],
    [1234, '1,234'],
    [1234567, '1,234,567'],
  ])('formats %i as %s', (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [1000, '0:01'],
    [59_999, '0:59'],
    [60_000, '1:00'],
    [252_000, '4:12'],
    [4_503_000, '75:03'],
  ])('formats %i ms as %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});
