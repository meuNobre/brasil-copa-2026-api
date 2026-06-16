const { OAuth2Client } = require('google-auth-library');
const prisma = require('../../lib/db');
const { generateToken } = require('../../lib/auth');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = ['https://brasil-copa-2026-five.vercel.app'];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential, username } = req.body || {};

  if (!credential) {
    return res.status(400).json({ error: 'Token do Google não fornecido' });
  }

  // 1. Verificar o JWT do Google
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('Erro ao verificar token Google:', err);
    return res.status(401).json({ error: 'Token do Google inválido' });
  }

  const { sub: googleId, email, name } = payload;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 2. Verificar se já existe um usuário com esse googleId
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (user) {
      // Já cadastrado com Google -> login direto
      const token = generateToken(user);
      return res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    }

    // 3. Verificar se existe conta com o mesmo email (cadastro por email/senha)
    const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingByEmail) {
      // Vincula o googleId à conta existente e faz login
      user = await prisma.user.update({
        where: { email: normalizedEmail },
        data: { googleId },
      });
      const token = generateToken(user);
      return res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    }

    // 4. Usuário novo via Google — precisa de username
    if (!username) {
      // Sugerimos um username baseado no nome do Google (frontend pode pré-preencher)
      const suggestion = (name || email.split('@')[0])
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);

      return res.status(202).json({
        needsUsername: true,
        suggestion,
        // Devolvemos o credential de volta para o frontend reenviar junto com o username
        credential,
      });
    }

    // 5. Criar conta nova com username escolhido
    const normalizedUsername = String(username).trim();

    if (normalizedUsername.length < 3) {
      return res.status(400).json({ error: 'Username deve ter no mínimo 3 caracteres' });
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (existingUsername) {
      return res.status(409).json({ error: 'Nome de usuário já existe, escolha outro' });
    }

    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        googleId,
        // password fica null - conta criada só com Google
      },
    });

    const token = generateToken(user);
    return res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email } });

  } catch (err) {
    console.error('Erro no login Google:', err);
    return res.status(500).json({ error: 'Erro interno ao processar login com Google' });
  }
};