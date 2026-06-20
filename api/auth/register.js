const prisma = require('../../lib/db');
const { hashPassword, generateToken } = require('../../lib/auth');

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
  setCors(req,res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { email, username, password } = req.body || {};

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Preencha email, username e senha' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = String(username).trim();

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: normalizedUsername }
        ]
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Email ou nome de usuário já cadastrado' });
    }

    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashed
      }
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
};
