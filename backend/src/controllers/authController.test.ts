import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from './authController';

const { compareMock, logAuditEventMock, generateTokenMock, getJwtExpiryDurationMsMock } = vi.hoisted(() => ({
  compareMock: vi.fn(),
  logAuditEventMock: vi.fn(),
  generateTokenMock: vi.fn(() => 'test-token'),
  getJwtExpiryDurationMsMock: vi.fn(() => 3600 * 1000),
}));
let connectionMock: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

vi.mock('bcryptjs', () => ({
  default: {
    compare: compareMock,
    hash: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({
  getConnection: vi.fn(async () => connectionMock),
}));

vi.mock('../utils/jwt', () => ({
  generateToken: generateTokenMock,
  getJwtExpiryDurationMs: getJwtExpiryDurationMsMock,
}));

vi.mock('../services/auditService', () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args),
}));

vi.mock('../services/passwordResetService', () => ({
  createPasswordResetToken: vi.fn(),
  verifyPasswordResetToken: vi.fn(),
  markPasswordResetTokenUsed: vi.fn(),
}));

vi.mock('../services/emailService', () => ({
  sendPasswordResetEmail: vi.fn(),
  emailService: { isEnabled: true },
}));

const createMockResponse = (): Response & { body?: any; statusCode?: number } => {
  const res: Partial<Response & { body?: any; statusCode?: number }> = {};
  res.statusCode = 200;
  res.status = vi.fn(function (this: any, code: number) {
    this.statusCode = code;
    return this;
  });
  res.json = vi.fn(function (this: any, payload: any) {
    this.body = payload;
    return this;
  });
  return res as Response & { body?: any; statusCode?: number };
};

const createRequest = (body: Record<string, unknown>): Request => ({
  body,
  headers: { 'user-agent': 'vitest' },
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
} as unknown as Request);

describe('AuthController.login', () => {
  beforeEach(() => {
    connectionMock = {
      query: vi.fn(),
      release: vi.fn(),
    };
    compareMock.mockReset();
    logAuditEventMock.mockReset();
    generateTokenMock.mockClear();
    getJwtExpiryDurationMsMock.mockReturnValue(3600 * 1000);
  });

  it('returns token and user on successful login', async () => {
    const controller = new AuthController();
    const userRow = {
      id: 'user-1',
      email: 'user@example.com',
      password_hash: 'hashed',
      first_name: 'Test',
      last_name: 'User',
      role: 'user',
      company_id: 'company-1',
      company_admin: 1,
      subscription_tier: 'trial',
      subscription_expiry: null,
      is_active: 1,
      failed_login_attempts: 0,
      lockout_until: null,
    };

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users')) {
        return { rows: [userRow] };
      }
      return { rows: [] };
    });
    compareMock.mockResolvedValue(true);

    const req = createRequest({ email: 'user@example.com', password: 'Password123' });
    const res = createMockResponse();

    await controller.login(req, res);

    expect(res.body?.success).toBe(true);
    expect(res.body?.token).toBe('test-token');
    expect(res.body?.user.email).toBe('user@example.com');
    expect(logAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'AUTH_LOGIN', success: true }));
  });

  it('returns 401 on invalid credentials and increments attempts', async () => {
    const controller = new AuthController();
    const userRow = {
      id: 'user-1',
      email: 'user@example.com',
      password_hash: 'hashed',
      first_name: 'Test',
      last_name: 'User',
      role: 'user',
      company_id: 'company-1',
      company_admin: 0,
      subscription_tier: 'trial',
      subscription_expiry: null,
      is_active: 1,
      failed_login_attempts: 2,
      lockout_until: null,
    };

    connectionMock.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM users')) {
        return { rows: [userRow] };
      }
      if (sql.startsWith('UPDATE users SET failed_login_attempts')) {
        expect(params?.[0]).toBe(3);
        return { rows: [] };
      }
      return { rows: [] };
    });
    compareMock.mockResolvedValue(false);

    const req = createRequest({ email: 'user@example.com', password: 'WrongPass1' });
    const res = createMockResponse();

    await controller.login(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body?.success).toBe(false);
    expect(logAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('locks account after threshold and returns 423', async () => {
    const controller = new AuthController();
    const userRow = {
      id: 'user-1',
      email: 'user@example.com',
      password_hash: 'hashed',
      first_name: 'Test',
      last_name: 'User',
      role: 'user',
      company_id: 'company-1',
      company_admin: 0,
      subscription_tier: 'trial',
      subscription_expiry: null,
      is_active: 1,
      failed_login_attempts: 4,
      lockout_until: null,
    };

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users')) {
        return { rows: [userRow] };
      }
      return { rows: [] };
    });
    compareMock.mockResolvedValue(false);

    const req = createRequest({ email: 'user@example.com', password: 'WrongPass1' });
    const res = createMockResponse();

    await controller.login(req, res);

    expect(res.statusCode).toBe(423);
    expect(res.body?.success).toBe(false);
    expect(logAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'AUTH_LOGIN_LOCKOUT' }));
  });
});
