'use strict';

// Deliberately closed until FinanceOS has real user authentication, a protected
// provider secret, and server-side rate limits. Never proxy paid AI access from
// an unauthenticated browser session.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  }
  return res.status(503).json({
    code: 'AI_BACKEND_NOT_CONFIGURED',
    message: 'FinanceOS AI is disabled until authenticated server-side provider access is configured.'
  });
};
