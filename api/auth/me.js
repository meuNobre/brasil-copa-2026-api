const prisma = require('../../lib/db');
const { requireAuth } = require('../../lib/middleware');

function setCors(req, res) {
  const origin = req.headers.origin;

  const allowed =
    origin === 'https://brasil-copa-2026-five.vercel.app' ||
    (origin?.includes('brasil-copa-2026') &&
     origin?.endsWith('.vercel.app'));

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-cron-secret'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}
module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') return res.status(405).end();

  const payload = requireAuth(req, res);
  if (!payload) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, email: true, createdAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
};
