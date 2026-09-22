import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'super-secret-elearning-key';

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: No token provided' }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verify(token, SECRET);
    c.set('jwtPayload' as never, payload);
    await next();
  } catch (err) {
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }
};

export const roleMiddleware = (allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const payload = c.get('jwtPayload' as never) as any;
    if (!payload || !payload.role) {
      return c.json({ error: 'Forbidden: No role found' }, 403);
    }
    
    if (!allowedRoles.includes(payload.role)) {
      return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
    }
    
    await next();
  };
};
