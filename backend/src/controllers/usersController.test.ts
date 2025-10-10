import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { UsersController } from './usersController';

const {
  getConnectionMock,
  logAuditEventMock,
  sendTemporaryPasswordEmailMock,
  getSeatUsageMock,
  hashPasswordMock,
  passwordMeetsPolicyMock,
} = vi.hoisted(() => ({
  getConnectionMock: vi.fn(),
  logAuditEventMock: vi.fn(),
  sendTemporaryPasswordEmailMock: vi.fn(),
  getSeatUsageMock: vi.fn(),
  hashPasswordMock: vi.fn(async (value: string) => `hashed:${value}`),
  passwordMeetsPolicyMock: vi.fn(() => true),
}));

vi.mock('../config/database', () => ({
  getConnection: (...args: any[]) => getConnectionMock(...args),
}));

vi.mock('../services/auditService', () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args),
}));

vi.mock('../services/emailService', () => ({
  sendTemporaryPasswordEmail: (...args: any[]) => sendTemporaryPasswordEmailMock(...args),
}));

vi.mock('../utils/companySeats', () => ({
  getSeatUsage: (...args: any[]) => getSeatUsageMock(...args),
}));

vi.mock('../utils/passwordPolicy', () => ({
  hashPassword: (...args: any[]) => (hashPasswordMock as any)(...args),
  passwordMeetsPolicy: (...args: any[]) => (passwordMeetsPolicyMock as any)(...args),
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

const baseUserContext = {
  id: 'company-admin-id',
  email: 'admin@company.test',
  role: 'user',
  companyId: 'company-123',
  companyAdmin: true,
  subscriptionTier: 'diy',
  subscriptionExpiry: null,
};

const createRequest = (
  body: Record<string, unknown>,
  overrides: Partial<Request & { user?: any; params?: any; headers?: any }> = {}
): Request => {
  const req: Partial<Request> = {
    body,
    user: { ...baseUserContext },
    headers: { 'user-agent': 'vitest' },
    params: {},
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' } as any,
  };

  if (overrides.user !== undefined) {
    req.user = overrides.user as any;
  }
  if (overrides.params) {
    req.params = overrides.params as any;
  }
  if (overrides.headers) {
    req.headers = { ...(req.headers as any), ...(overrides.headers as any) };
  }

  return { ...req, ...overrides } as Request;
};

let connectionMock: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

beforeEach(() => {
  connectionMock = {
    query: vi.fn(),
    release: vi.fn(),
  };
  getConnectionMock.mockReset();
  getConnectionMock.mockResolvedValue(connectionMock);
  logAuditEventMock.mockClear();
  sendTemporaryPasswordEmailMock.mockClear();
  getSeatUsageMock.mockReset();
  getSeatUsageMock.mockResolvedValue({ seatLimit: 10, activeUsers: 2, pendingInvites: 1 });
  hashPasswordMock.mockClear();
  hashPasswordMock.mockImplementation(async (value: string) => `hashed:${value}`);
  passwordMeetsPolicyMock.mockClear();
  passwordMeetsPolicyMock.mockReturnValue(true);
  connectionMock.query.mockReset();
  connectionMock.release.mockReset();
});

describe('UsersController.createUserWithTemporaryPassword', () => {
  it('creates a user, sends email, and logs audit event', async () => {
    const controller = new UsersController();
    const req = createRequest({ email: 'new.user@example.com', firstName: 'New', lastName: 'User' });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT id FROM users WHERE email = ?')) {
        expect(params).toEqual(['new.user@example.com']);
        return { rows: [] };
      }
      if (sql.includes('SELECT name FROM companies WHERE id = ?')) {
        expect(params).toEqual(['company-123']);
        return { rows: [{ name: 'Acme Corp' }] };
      }
      if (sql.includes('INSERT INTO users')) {
        expect(params?.[0]).toBeDefined();
        expect(params?.[1]).toBe('new.user@example.com');
        expect(params?.[2]).toMatch(/^hashed:/);
        expect(params?.[3]).toBe('New');
        expect(params?.[4]).toBe('User');
        expect(params?.[5]).toBe('diy');
        expect(params?.[7]).toBe('company-123');
        return { rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.createUserWithTemporaryPassword(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.userId).toBeDefined();
    expect(res.body).not.toHaveProperty('temporaryPassword');
    expect(sendTemporaryPasswordEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTemporaryPasswordEmailMock.mock.calls[0][0]).toBe('new.user@example.com');
    expect(typeof sendTemporaryPasswordEmailMock.mock.calls[0][1]).toBe('string');
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'USER_TEMP_PASSWORD_CREATED',
        success: true,
        metadata: expect.objectContaining({ email: 'new.user@example.com', companyId: 'company-123' }),
      })
    );
  });

  it('returns 409 when seat limit is exceeded', async () => {
    const controller = new UsersController();
    const req = createRequest({ email: 'seat.full@example.com' });
    const res = createMockResponse();

    getSeatUsageMock.mockResolvedValue({ seatLimit: 3, activeUsers: 3, pendingInvites: 0 });

    await controller.createUserWithTemporaryPassword(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ success: false, code: 'SEAT_LIMIT_EXCEEDED', error: 'Seat limit exceeded for this company' });
    expect(connectionMock.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), expect.anything());
    expect(sendTemporaryPasswordEmailMock).not.toHaveBeenCalled();
  });

  it('requires a company for non-admin users', async () => {
    const controller = new UsersController();
    const req = createRequest(
      { email: 'nocorp@example.com' },
      { user: { id: 'u1', email: 'user@example.com', role: 'user', companyAdmin: true, companyId: null } }
    );
    const res = createMockResponse();

    await controller.createUserWithTemporaryPassword(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, code: 'COMPANY_NOT_FOUND', error: 'No company associated with current user' });
  });
});

describe('UsersController.getUserById', () => {
  it('returns user details for admins', async () => {
    const controller = new UsersController();
    const req = createRequest({}, { params: { id: 'user-123' }, user: { role: 'admin', id: 'admin', email: 'admin@test', companyAdmin: false } });
    const res = createMockResponse();

    connectionMock.query.mockResolvedValue({
      rows: [
        {
          id: 'user-123',
          email: 'person@example.com',
          first_name: 'Person',
          last_name: 'Example',
          role: 'user',
          company_id: 'company-999',
          company_admin: 0,
          subscription_tier: 'trial',
          subscription_expiry: null,
          is_active: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ],
    });

    await controller.getUserById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      user: expect.objectContaining({ id: 'user-123', email: 'person@example.com', companyId: 'company-999' }),
    });
  });

  it('enforces company scope for company admins', async () => {
    const controller = new UsersController();
    const req = createRequest({}, { params: { id: 'user-abc' } });
    const res = createMockResponse();

    connectionMock.query.mockResolvedValue({
      rows: [
        {
          id: 'user-abc',
          email: 'other@example.com',
          company_id: 'different-company',
          company_admin: 0,
        },
      ],
    });

    await controller.getUserById(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, code: 'COMPANY_SCOPE_VIOLATION', error: 'Forbidden' });
  });

  it('returns 404 when user does not exist', async () => {
    const controller = new UsersController();
    const req = createRequest({}, { params: { id: 'missing-user' }, user: { ...baseUserContext } });
    const res = createMockResponse();

    connectionMock.query.mockResolvedValue({ rows: [] });

    await controller.getUserById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, code: 'USER_NOT_FOUND', error: 'User not found' });
  });
});
