const { verifyToken } = require('./auth');

/**
 * Valida o header Authorization: Bearer <token>.
 * Em caso de falha, já escreve a resposta de erro e retorna null.
 * Em caso de sucesso, retorna o payload decodificado do usuário.
 */
function requireAuth(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    return verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return null;
  }
}

/**
 * Aplica CORS básico em todas as rotas.
 */
function applyCors(req, res) {
  const origin = req.headers.origin;

  const allowed =
    origin === 'https://brasil-copa-2026-five.vercel.app' ||
    (origin?.includes('brasil-copa-2026') &&
      origin?.endsWith('.vercel.app'));

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-cron-secret'
  );
}

module.exports = { requireAuth, applyCors };
