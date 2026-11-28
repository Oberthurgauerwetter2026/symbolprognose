import { describe, expect, it } from 'vitest';
import { PULL_MAX, PULL_TRIGGER, isPullGesture, pullDistance, shouldRefresh } from './pull-refresh';

describe('pull to refresh', () => {
  it('refreshes only after a clear downward pull', () => {
    expect(shouldRefresh(pullDistance(40))).toBe(false);
    expect(shouldRefresh(pullDistance(PULL_TRIGGER * 2))).toBe(true);
  });
  it('ignores upward movement and caps the indicator travel', () => {
    expect(pullDistance(-30)).toBe(0);
    expect(pullDistance(5000)).toBe(PULL_MAX);
  });
  it('leaves sideways swipes to the hourly strip', () => {
    expect(isPullGesture(40, 10)).toBe(false);
    expect(isPullGesture(5, 40)).toBe(true);
    expect(isPullGesture(0, -40)).toBe(false);
  });
});
