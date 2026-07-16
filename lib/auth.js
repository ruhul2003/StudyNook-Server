const mongoose = require('mongoose');

let authInstance = null;
let nodeHandler = null;

const getAuth = async () => {
  if (authInstance) return authInstance;

  const { betterAuth } = await import('better-auth');
  const { mongodbAdapter } = await import('better-auth/adapters/mongodb');

  authInstance = betterAuth({
    database: mongodbAdapter(mongoose.connection.db),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'supersecretbetterauthkey12345',
    trustedOrigins: [
      process.env.CLIENT_URL || 'http://localhost:3000'
    ]
  });

  return authInstance;
};

const handleAuthRequest = async (req, res) => {
  const auth = await getAuth();
  if (!nodeHandler) {
    const { toNodeHandler } = await import('better-auth/node');
    nodeHandler = toNodeHandler(auth);
  }
  return nodeHandler(req, res);
};

module.exports = { getAuth, handleAuthRequest };
