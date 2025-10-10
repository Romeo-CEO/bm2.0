import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { CompanyProfileController } from './companyProfileController';

const {
  sendCompanyInvitationEmailMock,
  logAuditEventMock,
  getConnectionMock,
  passwordMeetsPolicyMock,
  hashPasswordMock,
  generateTokenMock,
  getJwtExpiryDurationMsMock,
} = vi.hoisted(() => ({
  sendCompanyInvitationEmailMock: vi.fn(),
  logAuditEventMock: vi.fn(),
  getConnectionMock: vi.fn(),
  passwordMeetsPolicyMock: vi.fn(() => true),
  hashPasswordMock: vi.fn(async (value: string) => `hashed:${value}`),
  generateTokenMock: vi.fn(() => 'test-jwt'),
  getJwtExpiryDurationMsMock: vi.fn(() => 3600 * 1000),
}));

let connectionMock: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
vi.mock('../config/database', () => ({
  getConnection: (...args: any[]) => getConnectionMock(...args),
}));

vi.mock('../services/emailService', () => ({
  sendCompanyInvitationEmail: (...args: any[]) => sendCompanyInvitationEmailMock(...args),
  emailService: { isEnabled: true },
}));

vi.mock('../services/auditService', () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args),
}));

vi.mock('../utils/passwordPolicy', () => ({
  passwordMeetsPolicy: passwordMeetsPolicyMock,
  hashPassword: hashPasswordMock,
}));

vi.mock('../utils/jwt', () => ({
  generateToken: generateTokenMock,
  getJwtExpiryDurationMs: getJwtExpiryDurationMsMock,
}));

const defaultUser = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  companyId: 'company-123',
  companyAdmin: true,
  role: 'user',
  firstName: 'Ada',
  lastName: 'Admin',
  subscriptionTier: 'diy',
};

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

const createRequest = (
  body: Record<string, unknown>,
  options: Partial<Request & { user?: any; query?: any; params?: any }> = {}
): Request => {
  const defaultHeaders = { 'user-agent': 'vitest' } as Record<string, string>;
  const req: Partial<Request> = {
    body,
    user: { ...defaultUser },
    headers: defaultHeaders,
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' } as any,
    query: {},
    params: {},
  };

  if (options.user !== undefined) {
    req.user = options.user as any;
  }
  if (options.headers) {
    req.headers = { ...defaultHeaders, ...(options.headers as any) };
  }
  if (options.query) {
    req.query = options.query as any;
  }
  if (options.params) {
    req.params = options.params as any;
  }

  return { ...req, ...options } as unknown as Request;
};

beforeEach(() => {
  connectionMock = {
    query: vi.fn(),
    release: vi.fn(),
  };
  getConnectionMock.mockReset();
  getConnectionMock.mockResolvedValue(connectionMock);
  sendCompanyInvitationEmailMock.mockReset();
  logAuditEventMock.mockReset();
  connectionMock.query.mockReset();
  connectionMock.release.mockReset();
  passwordMeetsPolicyMock.mockReset();
  passwordMeetsPolicyMock.mockReturnValue(true);
  hashPasswordMock.mockReset();
  hashPasswordMock.mockImplementation(async (value: string) => `hashed:${value}`);
  generateTokenMock.mockReset();
  generateTokenMock.mockReturnValue('test-jwt');
  getJwtExpiryDurationMsMock.mockReset();
  getJwtExpiryDurationMsMock.mockReturnValue(3600 * 1000);
});

describe('CompanyProfileController.inviteCompanyUser', () => {

  it('creates invitation, sends email, and logs audit event on success', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({ email: 'new.user@example.com' });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM platform_settings')) {
        return { rows: [{ setting_value: '75' }] };
      }
      if (sql.includes('FROM users')) {
        expect(params?.[0]).toBe('company-123');
        return { rows: [{ total: 4 }] };
      }
      if (sql.includes('FROM company_invitations') && sql.includes('COUNT')) {
        return { rows: [{ total: 0 }] };
      }
      if (sql.startsWith('INSERT INTO company_invitations')) {
        expect(params?.[2]).toBe('new.user@example.com');
        expect(params?.[3]).toHaveLength(64);
        return { rows: [] };
      }
      if (sql.includes('FROM companies')) {
        return { rows: [{ name: 'Acme Corp' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.inviteCompanyUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(sendCompanyInvitationEmailMock).toHaveBeenCalledTimes(1);
    expect(sendCompanyInvitationEmailMock).toHaveBeenCalledWith(
      'new.user@example.com',
      expect.stringContaining('token='),
      expect.objectContaining({ companyName: 'Acme Corp', invitedByName: 'Ada Admin' })
    );
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'COMPANY_USER_INVITE_SENT',
        success: true,
        metadata: expect.objectContaining({
          invitedEmail: 'new.user@example.com',
          companyId: 'company-123',
          seatLimit: 25,
        }),
      })
    );
  });

  it('returns 409 when seat limit exceeded without generating token', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({ email: 'limit.user@example.com' });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM platform_settings')) {
        return { rows: [{ setting_value: '5' }] };
      }
      if (sql.includes('FROM users')) {
        return { rows: [{ total: 5 }] };
      }
      if (sql.includes('FROM company_invitations') && sql.includes('COUNT')) {
        return { rows: [{ total: 0 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.inviteCompanyUser(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ success: false, error: 'Seat limit exceeded', errorCode: 'SEAT_LIMIT_EXCEEDED' });
    expect(sendCompanyInvitationEmailMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
    expect(connectionMock.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO company_invitations'), expect.anything());
  });

  it('rejects invalid email addresses without hitting the database', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({ email: 'invalid-email' });
    const res = createMockResponse();

    await controller.inviteCompanyUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Invalid email address.' });
    expect(getConnectionMock).not.toHaveBeenCalled();
    expect(sendCompanyInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('returns 500 and logs audit failure when email sending fails repeatedly', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({ email: 'fail.user@example.com' });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM platform_settings')) {
        return { rows: [{ setting_value: '75' }] };
      }
      if (sql.includes('FROM users')) {
        return { rows: [{ total: 1 }] };
      }
      if (sql.includes('FROM company_invitations') && sql.includes('COUNT')) {
        return { rows: [{ total: 0 }] };
      }
      if (sql.startsWith('INSERT INTO company_invitations')) {
        return { rows: [] };
      }
      if (sql.includes('FROM companies')) {
        return { rows: [{ name: 'Acme Corp' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    sendCompanyInvitationEmailMock.mockRejectedValue(new Error('Send failed'));

    await controller.inviteCompanyUser(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to send invitation email.' });
    expect(sendCompanyInvitationEmailMock).toHaveBeenCalledTimes(3);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'COMPANY_USER_INVITE_SENT',
        success: false,
        metadata: expect.objectContaining({
          invitedEmail: 'fail.user@example.com',
          reason: 'EMAIL_FAILED',
        }),
      })
    );
  });
});

describe('CompanyProfileController.removeCompanyUser', () => {
  it('removes a user from the company and logs audit event', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { id: 'target-user-id' } });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM users WHERE id = ?')) {
        expect(params).toEqual(['target-user-id']);
        return {
          rows: [
            {
              id: 'target-user-id',
              email: 'target@example.com',
              company_id: 'company-123',
              company_admin: 0,
              is_active: 1,
            },
          ],
        };
      }

      if (sql.includes('UPDATE users SET company_id = NULL')) {
        expect(params).toEqual(['target-user-id']);
        return { rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.removeCompanyUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'COMPANY_USER_REMOVED',
        success: true,
        metadata: expect.objectContaining({
          removedUserId: 'target-user-id',
          companyId: 'company-123',
        }),
      })
    );
  });

  it('blocks removing self when the last company admin', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { id: 'admin-user-id' } });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM users WHERE id = ?')) {
        return {
          rows: [
            {
              id: 'admin-user-id',
              email: 'admin@example.com',
              company_id: 'company-123',
              company_admin: 1,
              is_active: 1,
            },
          ],
        };
      }

      if (sql.includes('COUNT(*) AS total FROM users WHERE company_id = ?')) {
        expect(params).toEqual(['company-123', 'admin-user-id']);
        return { rows: [{ total: 0 }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.removeCompanyUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Cannot remove yourself as the last company admin.' });
  });

  it('rejects removing a user from another company', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { id: 'other-user' } });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE id = ?')) {
        return {
          rows: [
            {
              id: 'other-user',
              email: 'other@example.com',
              company_id: 'other-company',
              company_admin: 0,
            },
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.removeCompanyUser(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: 'Forbidden.' });
  });
});

describe('CompanyProfileController.validateCompanyInvitation', () => {
  it('returns valid when invitation is pending and not expired', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { query: { token: 'token-123' }, user: undefined });
    const res = createMockResponse();

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM company_invitations') && sql.includes('token_hash')) {
        return {
          rows: [
            {
              id: 'invite-1',
              company_id: 'company-123',
              email: 'member@example.com',
              status: 'pending',
              expires_at: future,
              accepted_at: null,
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.validateCompanyInvitation(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'valid' });
  });

  it('marks invitation expired and returns expired status', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { query: { token: 'token-456' }, user: undefined });
    const res = createMockResponse();

    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let updated = false;

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM company_invitations') && sql.includes('token_hash')) {
        return {
          rows: [
            {
              id: 'invite-2',
              company_id: 'company-123',
              email: 'expired@example.com',
              status: 'pending',
              expires_at: past,
              accepted_at: null,
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE company_invitations SET status')) {
        expect(params?.[0]).toBe('expired');
        expect(params?.[1]).toBe('invite-2');
        updated = true;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.validateCompanyInvitation(req, res);

    expect(updated).toBe(true);
    expect(res.body).toEqual({ status: 'expired' });
  });

  it('returns used when invitation already accepted', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { query: { token: 'token-789' }, user: undefined });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM company_invitations') && sql.includes('token_hash')) {
        return {
          rows: [
            {
              id: 'invite-3',
              company_id: 'company-123',
              email: 'used@example.com',
              status: 'accepted',
              expires_at: new Date().toISOString(),
              accepted_at: new Date().toISOString(),
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.validateCompanyInvitation(req, res);

    expect(res.body).toEqual({ status: 'used' });
  });
});

describe('CompanyProfileController.acceptCompanyInvitation', () => {
  it('creates a new user, marks invitation accepted, and returns JWT', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest(
      { token: 'invite-token', password: 'Password123!', firstName: 'New', lastName: 'User' },
      { user: undefined }
    );
    const res = createMockResponse();

    generateTokenMock.mockReturnValue('new-jwt-token');
    const queries: string[] = [];

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      queries.push(sql);
      if (sql.startsWith('BEGIN TRANSACTION')) {
        return { rows: [] };
      }
      if (sql.includes('FROM company_invitations') && sql.includes('token_hash')) {
        return {
          rows: [
            {
              id: 'invite-10',
              company_id: 'company-123',
              email: 'new.member@example.com',
              status: 'pending',
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              accepted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM users WHERE LOWER(email)')) {
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO users')) {
        expect(params?.[1]).toBe('new.member@example.com');
        expect(params?.[2]).toBe('hashed:Password123!');
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE company_invitations SET status')) {
        expect(params?.[0]).toBe('accepted');
        expect(params?.[1]).toBe('invite-10');
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM users WHERE id = ?')) {
        return {
          rows: [
            {
              id: params?.[0] ?? 'user-10',
              email: 'new.member@example.com',
              first_name: 'New',
              last_name: 'User',
              role: 'user',
              company_id: 'company-123',
              company_admin: 0,
              subscription_tier: 'trial',
            },
          ],
        };
      }
      if (sql.startsWith('INSERT INTO auth_tokens')) {
        expect(params?.[0]).toBe('new-jwt-token');
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('COMMIT TRANSACTION')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.acceptCompanyInvitation(req, res);

    expect(passwordMeetsPolicyMock).toHaveBeenCalledWith('Password123!');
    expect(hashPasswordMock).toHaveBeenCalledWith('Password123!');
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.token).toBe('new-jwt-token');
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'COMPANY_INVITE_ACCEPTED', success: true })
    );
    expect(queries).toContainEqual(expect.stringContaining('INSERT INTO users'));
  });

  it('updates existing user without company and accepts invitation', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({ token: 'invite-token', password: 'Password123!' }, { user: undefined });
    const res = createMockResponse();

    const updateParams: any[] = [];

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.startsWith('BEGIN TRANSACTION')) return { rows: [] };
      if (sql.includes('FROM company_invitations') && sql.includes('token_hash')) {
        return {
          rows: [
            {
              id: 'invite-20',
              company_id: 'company-123',
              email: 'existing@example.com',
              status: 'pending',
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              accepted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM users WHERE LOWER(email)')) {
        return {
          rows: [
            {
              id: 'user-existing',
              email: 'existing@example.com',
              company_id: null,
              role: 'user',
              company_admin: 0,
              subscription_tier: 'trial',
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE users SET')) {
        updateParams.push({ sql, params });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE company_invitations SET status')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM users WHERE id = ?')) {
        return {
          rows: [
            {
              id: 'user-existing',
              email: 'existing@example.com',
              first_name: 'Existing',
              last_name: 'User',
              role: 'user',
              company_id: 'company-123',
              company_admin: 0,
              subscription_tier: 'trial',
            },
          ],
        };
      }
      if (sql.startsWith('INSERT INTO auth_tokens')) return { rows: [], rowCount: 1 };
      if (sql.startsWith('COMMIT TRANSACTION')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.acceptCompanyInvitation(req, res);

    expect(updateParams).toHaveLength(1);
    const update = updateParams[0] as { sql: string; params: any[] };
    expect(update.sql).toContain('UPDATE users SET');
    expect(update.params?.[0]).toBe('hashed:Password123!');
    expect(update.params?.[1]).toBe('company-123');
    expect(res.body?.success).toBe(true);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'COMPANY_INVITE_ACCEPTED', success: true })
    );
  });

  it('rejects acceptance when existing user belongs to different company', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({ token: 'invite-token', password: 'Password123!' }, { user: undefined });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('BEGIN TRANSACTION')) return { rows: [] };
      if (sql.includes('FROM company_invitations') && sql.includes('token_hash')) {
        return {
          rows: [
            {
              id: 'invite-30',
              company_id: 'company-123',
              email: 'existing@example.com',
              status: 'pending',
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              accepted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM users WHERE LOWER(email)')) {
        return {
          rows: [
            {
              id: 'user-existing',
              email: 'existing@example.com',
              company_id: 'other-company',
            },
          ],
        };
      }
      if (sql.startsWith('ROLLBACK TRANSACTION')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.acceptCompanyInvitation(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ success: false, error: 'Invitation cannot be accepted for this account.' });
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'COMPANY_INVITE_ACCEPT_FAILED',
        success: false,
        metadata: expect.objectContaining({ reason: 'DIFFERENT_COMPANY' }),
      })
    );
  });

  it('returns 410 when invitation already expired', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({ token: 'invite-token', password: 'Password123!' }, { user: undefined });
    const res = createMockResponse();

    let updatedToExpired = false;

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.startsWith('BEGIN TRANSACTION')) return { rows: [] };
      if (sql.includes('FROM company_invitations') && sql.includes('token_hash')) {
        return {
          rows: [
            {
              id: 'invite-40',
              company_id: 'company-123',
              email: 'expired@example.com',
              status: 'pending',
              expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
              accepted_at: null,
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE company_invitations SET status')) {
        expect(params?.[0]).toBe('expired');
        updatedToExpired = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('COMMIT TRANSACTION')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.acceptCompanyInvitation(req, res);

    expect(updatedToExpired).toBe(true);
    expect(res.statusCode).toBe(410);
    expect(res.body).toEqual({ success: false, error: 'Invitation has expired.' });
  });
});

describe('CompanyProfileController.resendCompanyInvitation', () => {
  it('regenerates token, updates invitation, and sends email', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { id: 'invite-1' } });
    const res = createMockResponse();

    sendCompanyInvitationEmailMock.mockResolvedValue(undefined);
    const updatedTokens: string[] = [];

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.startsWith('BEGIN TRANSACTION')) return { rows: [] };
      if (sql.includes('FROM company_invitations WHERE id = ?')) {
        expect(params?.[0]).toBe('invite-1');
        return {
          rows: [
            {
              id: 'invite-1',
              company_id: 'company-123',
              email: 'pending@example.com',
              status: 'pending',
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE company_invitations SET token_hash')) {
        const tokenHash = params?.[0];
        expect(typeof tokenHash).toBe('string');
        expect(tokenHash).toHaveLength(64);
        updatedTokens.push(tokenHash);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SELECT name FROM companies')) {
        return { rows: [{ name: 'Acme Corp' }] };
      }
      if (sql.startsWith('COMMIT TRANSACTION')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.resendCompanyInvitation(req, res);

    expect(updatedTokens).toHaveLength(1);
    expect(sendCompanyInvitationEmailMock).toHaveBeenCalledTimes(1);
    const inviteUrl = sendCompanyInvitationEmailMock.mock.calls[0][1];
    expect(inviteUrl).toContain('token=');
    expect(res.body).toEqual({ success: true });
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'COMPANY_INVITE_RESENT', success: true })
    );
  });

  it('returns 400 when invitation is not pending', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { id: 'invite-2' } });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('BEGIN TRANSACTION')) return { rows: [] };
      if (sql.includes('FROM company_invitations WHERE id = ?')) {
        return {
          rows: [
            {
              id: 'invite-2',
              company_id: 'company-123',
              email: 'used@example.com',
              status: 'accepted',
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            },
          ],
        };
      }
      if (sql.startsWith('ROLLBACK TRANSACTION')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.resendCompanyInvitation(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Only pending invitations can be resent.' });
    expect(sendCompanyInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('returns 403 when user does not belong to invitation company', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { id: 'invite-3' }, user: { ...defaultUser, companyId: 'company-999' } });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('BEGIN TRANSACTION')) return { rows: [] };
      if (sql.includes('FROM company_invitations WHERE id = ?')) {
        return {
          rows: [
            {
              id: 'invite-3',
              company_id: 'company-123',
              email: 'pending@example.com',
              status: 'pending',
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            },
          ],
        };
      }
      if (sql.startsWith('ROLLBACK TRANSACTION')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.resendCompanyInvitation(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: 'You are not authorized to manage this invitation.' });
    expect(sendCompanyInvitationEmailMock).not.toHaveBeenCalled();
  });
});

describe('CompanyProfileController.cancelCompanyInvitation', () => {
  it('cancels a pending invitation and logs audit event', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { inviteId: 'invite-9' } });
    const res = createMockResponse();

    let updated = false;

    connectionMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM company_invitations WHERE id = ?')) {
        expect(params?.[0]).toBe('invite-9');
        return {
          rows: [
            {
              id: 'invite-9',
              company_id: 'company-123',
              email: 'cancelme@example.com',
              status: 'pending',
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE company_invitations SET status = ')) {
        updated = true;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.cancelCompanyInvitation(req, res);

    expect(updated).toBe(true);
    expect(res.body).toEqual({ success: true });
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'COMPANY_INVITE_CANCELLED', success: true })
    );
  });

  it('returns 400 when invitation already accepted', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { inviteId: 'invite-accepted' } });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM company_invitations WHERE id = ?')) {
        return {
          rows: [
            {
              id: 'invite-accepted',
              company_id: 'company-123',
              email: 'used@example.com',
              status: 'accepted',
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.cancelCompanyInvitation(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Accepted invitations cannot be cancelled.' });
  });

  it('returns 403 when cancelling invitation for another company', async () => {
    const controller = new CompanyProfileController();
    const req = createRequest({}, { params: { inviteId: 'invite-403' }, user: { ...defaultUser, companyId: 'company-other' } });
    const res = createMockResponse();

    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM company_invitations WHERE id = ?')) {
        return {
          rows: [
            {
              id: 'invite-403',
              company_id: 'company-123',
              email: 'pending@example.com',
              status: 'pending',
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await controller.cancelCompanyInvitation(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: 'You are not authorized to manage this invitation.' });
  });
});
