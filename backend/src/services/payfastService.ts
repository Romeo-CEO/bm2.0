import crypto from 'crypto';

type PayfastParams = Record<string, string>;

export const PAYFAST_PRODUCTION_IPS = [
  '196.33.227.175',
  '196.33.227.174',
  '41.74.179.194',
  '197.97.145.144',
  '197.97.145.145',
  '197.97.145.146',
];

export const PAYFAST_SANDBOX_IPS = ['196.33.227.206'];

export interface PayfastVerificationResult {
  isSignatureValid: boolean;
  isIpAllowed: boolean;
  isPostbackValid: boolean;
  signature: string;
  expectedSignature: string;
  postbackBody?: string;
}

export const sanitizeNotification = (body: Record<string, unknown>): PayfastParams => {
  const params: PayfastParams = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    params[key] = Array.isArray(value) ? value[0] : String(value);
  }
  return params;
};

export const computeSignature = (params: PayfastParams, passPhrase?: string): string => {
  const keys = Object.keys(params)
    .filter((key) => key.toLowerCase() !== 'signature' && params[key] !== '')
    .sort();
  const query = keys
    .map((key) => `${key}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`)
    .join('&');
  const payload = passPhrase ? `${query}&passphrase=${encodeURIComponent(passPhrase).replace(/%20/g, '+')}` : query;
  return crypto.createHash('md5').update(payload).digest('hex');
};

export const isIpAllowed = (ip: string | null, sandbox: boolean, disabled = false): boolean => {
  if (disabled) return true;
  if (!ip) return false;
  const candidates = sandbox ? PAYFAST_SANDBOX_IPS : PAYFAST_PRODUCTION_IPS;
  return candidates.includes(ip.trim());
};

export const verifySignature = (params: PayfastParams, passPhrase?: string): boolean => {
  const received = (params.signature || '').toLowerCase();
  const expected = computeSignature(params, passPhrase).toLowerCase();
  return received === expected;
};

export const postBackToPayfast = async (
  params: PayfastParams,
  sandbox: boolean,
  fetchImpl: typeof fetch = fetch
): Promise<{ body: string; ok: boolean }> => {
  const url = sandbox
    ? 'https://sandbox.payfast.co.za/eng/query/validate'
    : 'https://www.payfast.co.za/eng/query/validate';

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await response.text();
  return { body, ok: body.trim().toUpperCase() === 'VALID' };
};
