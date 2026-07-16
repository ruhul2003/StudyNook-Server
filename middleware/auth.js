const { getAuth } = require('../lib/auth');

const authMiddleware = async (req, res, next) => {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return res.status(401).json({ message: 'Unauthorized. No active session.' });
    }

    req.user = { id: session.user.id };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ message: 'Unauthorized. Session verification failed.' });
  }
};

module.exports = authMiddleware;
