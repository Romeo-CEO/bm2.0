import { describe, expect, it } from 'vitest';
import { computeSignature, sanitizeNotification, verifySignature, isIpAllowed } from './payfastService';

describe('payfastService', () => {
  it('computes and verifies signature correctly', () => {
    const params = {
      payment_status: 'COMPLETE',
      amount_gross: '100.00',
      pf_payment_id: '12345',
    };
    const withSignature = {
      ...params,
      signature: computeSignature(params, 'passphrase'),
    };
    const sanitized = sanitizeNotification(withSignature);
    expect(verifySignature(sanitized, 'passphrase')).toBe(true);
  });

  it('rejects signatures that do not match', () => {
    const params = { payment_status: 'COMPLETE', signature: 'invalid' };
    expect(verifySignature(params, 'passphrase')).toBe(false);
  });

  it('validates PayFast IPs', () => {
    expect(isIpAllowed('196.33.227.175', false)).toBe(true);
    expect(isIpAllowed('196.33.227.206', true)).toBe(true);
    expect(isIpAllowed('127.0.0.1', false)).toBe(false);
  });
});
