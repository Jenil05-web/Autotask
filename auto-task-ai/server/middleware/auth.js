const firebaseAdmin = require('../services/firebaseAdmin');

// Middleware to verify Firebase ID token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const result = await firebaseAdmin.verifyIdToken(token);
    
    if (!result.success) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Add user information to request
    req.user = {
      uid: result.user.uid,
      email: result.user.email,
      name: result.user.name,
      emailVerified: result.user.email_verified
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(403).json({ error: 'Token verification failed' });
  }
};

// Optional authentication - doesn't fail if no token provided
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const result = await firebaseAdmin.verifyIdToken(token);
      
      if (result.success) {
        req.user = {
          uid: result.user.uid,
          email: result.user.email,
          name: result.user.name,
          emailVerified: result.user.email_verified
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user has admin role (you can customize this logic)
  if (!req.user.customClaims?.admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Middleware to check email verification
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({ error: 'Email verification required' });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireEmailVerification
};