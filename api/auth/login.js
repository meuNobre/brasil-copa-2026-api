const prisma = require('../../lib/db');
const { comparePassword, generateToken } = require('../../lib/auth');

function setCors(req, res) {
  const origin = req.headers.origin;

  const allowedOrigins = [
    'https://brasil-copa-2026-five.vercel.app'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha email e senha' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const valid = await comparePassword(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
};
