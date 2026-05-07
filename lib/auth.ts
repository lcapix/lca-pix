/**
 * Authentication Utilities
 * JWT token generation, verification, and password hashing
 */

import { hash, compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, queryOne } from './db-helpers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface UserPayload {
  id: number;
  email: string;
  account_type?: 'user' | 'admin';
}

export interface User {
  id: number;
  username: string;
  email: string;
  account_type: 'user' | 'admin';
  is_active: boolean;
  created_at: Date;
}

/**
 * Hash a plain text password
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

/**
 * Compare a plain text password with a hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(password, hashedPassword);
}

/**
 * Create a JWT token for a user
 */
export function createToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify a JWT token and return the payload
 */
export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify authentication and return user ID
 * Throws error if not authenticated
 */
export async function requireAuth(request: Request): Promise<number> {
  const token = extractToken(request);
  if (!token) {
    throw new Error('No authentication token provided');
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new Error('Invalid or expired token');
  }

  // Verify user still exists and is active
  const user = await queryOne<any>(
    'SELECT id, is_active FROM account WHERE id = ?',
    [payload.id]
  );

  if (!user || !user.is_active) {
    throw new Error('User account not found or inactive');
  }

  return payload.id;
}

/**
 * Get current user from request
 */
export async function getCurrentUser(request: Request): Promise<User | null> {
  try {
    const userId = await requireAuth(request);
    const user = await queryOne<any>(
      `SELECT id, username, email, account_type, is_active, created_at
       FROM account WHERE id = ?`,
      [userId]
    );
    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Check if user has admin privileges
 */
export async function requireAdmin(request: Request): Promise<number> {
  const userId = await requireAuth(request);
  const user = await queryOne<any>(
    'SELECT account_type FROM account WHERE id = ?',
    [userId]
  );

  if (!user || user.account_type !== 'admin') {
    throw new Error('Admin privileges required');
  }

  return userId;
}

/**
 * Check if user has permission to access a project
 */
export async function checkProjectAccess(
  userId: number,
  projectId: number,
  requiredPermission?: 'owner' | 'admin' | 'editor' | 'viewer'
): Promise<boolean> {
  // First check if user is the project owner (direct ownership via owner_id)
  const project = await queryOne<any>(
    `SELECT owner_id FROM project WHERE project_id = ?`,
    [projectId]
  );

  if (project && project.owner_id === userId) {
    // Project owner always has full access
    return true;
  }

  // If not the owner, check project_members table for delegated permissions
  const result = await queryOne<any>(
    `SELECT p.permission_name
     FROM project_members pm
     JOIN permissions p ON pm.permission_id = p.permission_id
     WHERE pm.project_id = ? AND pm.user_id = ?`,
    [projectId, userId]
  );

  if (!result) {
    return false;
  }

  if (!requiredPermission) {
    return true;
  }

  // Permission hierarchy: owner > admin > editor > viewer
  const permissionLevel: Record<string, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    viewer: 1,
  };

  return permissionLevel[result.permission_name] >= permissionLevel[requiredPermission];
}

/**
 * Require project access with specific permission
 */
export async function requireProjectAccess(
  request: Request,
  projectId: number,
  requiredPermission?: 'owner' | 'admin' | 'editor' | 'viewer'
): Promise<number> {
  const userId = await requireAuth(request);
  const hasAccess = await checkProjectAccess(userId, projectId, requiredPermission);

  if (!hasAccess) {
    throw new Error('Insufficient permissions to access this project');
  }

  return userId;
}
