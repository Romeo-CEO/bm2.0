import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { getConnection } from '../config/database';
import { logAuditEvent } from '../services/auditService';

const normalizeDomain = (domain: string): string => domain.trim().toLowerCase();

const isAdminRequest = (req: Request): boolean => Boolean(req.user && req.user.role === 'admin');

export class SsoApplicationsController {
  async list(req: Request, res: Response): Promise<void> {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const db = await getConnection();
    try {
      const result = await db.query(`
        SELECT id, name, domain, sso_enabled as ssoEnabled, metadata
        FROM sso_applications
        ORDER BY created_at DESC
      `);

      res.json({ success: true, items: result.rows });
    } catch (error) {
      console.error('Failed to list SSO applications', error);
      res.status(500).json({ error: 'Failed to list SSO applications' });
    } finally {
      db.release?.();
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const db = await getConnection();
    try {
      const result = await db.query(
        'SELECT id, name, domain, sso_enabled as ssoEnabled, metadata FROM sso_applications WHERE id = ?',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'SSO application not found' });
        return;
      }

      res.json({ success: true, item: result.rows[0] });
    } catch (error) {
      console.error('Failed to fetch SSO application', error);
      res.status(500).json({ error: 'Failed to fetch SSO application' });
    } finally {
      db.release?.();
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { name, domain, ssoEnabled = false, metadata = {} } = req.body || {};

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    if (!domain || typeof domain !== 'string') {
      res.status(400).json({ error: 'Domain is required' });
      return;
    }

    const normalizedDomain = normalizeDomain(domain);
    const db = await getConnection();
    try {
      const duplicateCheck = await db.query(
        'SELECT id FROM sso_applications WHERE LOWER(name) = LOWER(?) OR domain = ?',
        [name.trim(), normalizedDomain]
      );
      if (duplicateCheck.rows.length > 0) {
        res.status(409).json({ error: 'An application with that name or domain already exists' });
        return;
      }

      const id = randomUUID();
      await db.query(
        `INSERT INTO sso_applications (id, name, domain, sso_enabled, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
        [id, name.trim(), normalizedDomain, ssoEnabled ? 1 : 0, JSON.stringify(metadata)]
      );

      await logAuditEvent({
        eventType: 'SSO_APPLICATION_UPDATED',
        success: true,
        userId: req.user?.id,
        metadata: { action: 'create', id, name: name.trim(), domain: normalizedDomain }
      });

      res.status(201).json({ success: true, id });
    } catch (error) {
      console.error('Failed to create SSO application', error);
      res.status(500).json({ error: 'Failed to create SSO application' });
    } finally {
      db.release?.();
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const { name, domain, ssoEnabled, metadata } = req.body || {};

    const db = await getConnection();
    try {
      const currentResult = await db.query('SELECT * FROM sso_applications WHERE id = ?', [id]);
      if (currentResult.rows.length === 0) {
        res.status(404).json({ error: 'SSO application not found' });
        return;
      }

      const current = currentResult.rows[0];
      const nextName = typeof name === 'string' && name.trim() ? name.trim() : current.name;
      const nextDomain = typeof domain === 'string' && domain.trim() ? normalizeDomain(domain) : current.domain;
      const nextEnabled = typeof ssoEnabled === 'boolean' ? (ssoEnabled ? 1 : 0) : current.sso_enabled;
      const nextMetadata = metadata !== undefined ? JSON.stringify(metadata) : current.metadata;

      if (typeof name === 'string' || typeof domain === 'string') {
        const duplicateCheck = await db.query(
          'SELECT id FROM sso_applications WHERE id <> ? AND (LOWER(name) = LOWER(?) OR domain = ?)',
          [id, nextName, nextDomain]
        );
        if (duplicateCheck.rows.length > 0) {
          res.status(409).json({ error: 'An application with that name or domain already exists' });
          return;
        }
      }

      await db.query(
        `UPDATE sso_applications
         SET name = ?, domain = ?, sso_enabled = ?, metadata = ?, updated_at = GETDATE()
         WHERE id = ?`,
        [nextName, nextDomain, nextEnabled, nextMetadata, id]
      );

      await logAuditEvent({
        eventType: 'SSO_APPLICATION_UPDATED',
        success: true,
        userId: req.user?.id,
        metadata: {
          action: 'update',
          id,
          previous: { name: current.name, domain: current.domain, ssoEnabled: Boolean(current.sso_enabled) },
          next: { name: nextName, domain: nextDomain, ssoEnabled: Boolean(nextEnabled) }
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to update SSO application', error);
      res.status(500).json({ error: 'Failed to update SSO application' });
    } finally {
      db.release?.();
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const db = await getConnection();
    try {
      const result = await db.query('DELETE FROM sso_applications WHERE id = ?', [id]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'SSO application not found' });
        return;
      }

      await logAuditEvent({
        eventType: 'SSO_APPLICATION_UPDATED',
        success: true,
        userId: req.user?.id,
        metadata: { action: 'delete', id }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete SSO application', error);
      res.status(500).json({ error: 'Failed to delete SSO application' });
    } finally {
      db.release?.();
    }
  }
}

export const ssoApplicationsController = new SsoApplicationsController();
