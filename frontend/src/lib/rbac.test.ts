import { describe, expect, it } from 'vitest';
import { can, canAccess, homeFor } from './rbac';

describe('rbac', () => {
  it('sends each role to its home screen', () => {
    expect(homeFor('DISPATCHER')).toBe('/board');
    expect(homeFor('AUDITOR')).toBe('/reports');
    expect(homeFor('DRIVER')).toBe('/driver');
    expect(homeFor('CLINIC_RECEIVER')).toBe('/driver');
  });
  it('keeps auditors read-only and off the live board', () => {
    expect(canAccess('/board', 'AUDITOR')).toBe(false);
    expect(can.createShipment('AUDITOR')).toBe(false);
    expect(can.ackAlert('AUDITOR')).toBe(false);
  });
  it('keeps drivers out of the board and reports', () => {
    expect(canAccess('/board', 'DRIVER')).toBe(false);
    expect(canAccess('/reports', 'DRIVER')).toBe(false);
  });
});
