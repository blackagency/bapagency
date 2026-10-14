import { Hono } from 'hono';
import type { Env } from './env';
import { authRoutes } from './routes/auth';
import { statementRoutes } from './routes/statements';

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  const length = Number(c.req.header('content-length') || 0);
  if (length > 100_000) return c.json({ error: 'Dữ liệu quá lớn' }, 413);
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Cache-Control', 'no-store');
});

app.get('/api/health', (c) => c.json({ ok: true, service: 'bap-agency' }));
app.route('/api/auth', authRoutes);
app.route('/api/statements', statementRoutes);

app.notFound(async (c) => {
  if (c.req.path.startsWith('/api')) return c.json({ error: 'Không tìm thấy' }, 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
