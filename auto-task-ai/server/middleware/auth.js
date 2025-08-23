const firebaseAdmin = require('../services/firebaseAdmin');

// Middleware to verify Firebase ID token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'MISSING_TOKEN' 
      });
    }

    const result = await firebaseAdmin.verifyIdToken(token);
        
    if (!result.success) {
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN' 
      });
    }

    // Add user information to request with custom claims
    req.user = {
      uid: result.user.uid,
      email: result.user.email,
      name: result.user.name,
      emailVerified: result.user.email_verified,
      customClaims: result.user.customClaims || {}
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(403).json({ 
      error: 'Token verification failed',
      code: 'VERIFICATION_FAILED' 
    });
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
          emailVerified: result.user.email_verified,
          customClaims: result.user.customClaims || {}
        };
      } else {
        // Token exists but is invalid - you might want to clear it
        req.invalidToken = true;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // Continue without authentication but log the error
    req.authError = error.message;
    next();
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NOT_AUTHENTICATED' 
    });
  }

  // Check if user has admin role
  if (!req.user.customClaims?.admin && !req.user.customClaims?.role?.includes('admin')) {
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'INSUFFICIENT_PERMISSIONS' 
    });
  }

  next();
};

// Middleware to check specific roles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED' 
      });
    }

    const userRoles = req.user.customClaims?.roles || [];
    const userRole = req.user.customClaims?.role;
    
    // Check if user has any of the required roles
    const hasRole = Array.isArray(roles) 
      ? roles.some(role => userRoles.includes(role) || userRole === role)
      : userRoles.includes(roles) || userRole === roles;

    if (!hasRole) {
      return res.status(403).json({ 
        error: `Access denied. Required role(s): ${Array.isArray(roles) ? roles.join(', ') : roles}`,
        code: 'INSUFFICIENT_PERMISSIONS' 
      });
    }

    next();
  };
};

// Middleware to check email verification
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NOT_AUTHENTICATED' 
    });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED' 
    });
  }

  next();
};

// Middleware to check if user owns resource
const requireOwnership = (resourceIdField = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED' 
      });
    }

    // Get resource ID from params, body, or query
    const resourceId = req.params[resourceIdField] || 
                      req.body[resourceIdField] || 
                      req.query[resourceIdField];

    // Check if user owns the resource or is admin
    if (resourceId !== req.user.uid && !req.user.customClaims?.admin) {
      return res.status(403).json({ 
        error: 'Access denied. You can only access your own resources.',
        code: 'OWNERSHIP_REQUIRED' 
      });
    }

    next();
  };
};

// Rate limiting middleware (basic implementation)
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requestCounts = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated users
    }

    const userId = req.user.uid;
    const now = Date.now();
    const userRequests = requestCounts.get(userId) || { count: 0, resetTime: now + windowMs };

    if (now > userRequests.resetTime) {
      userRequests.count = 0;
      userRequests.resetTime = now + windowMs;
    }

    userRequests.count++;
    requestCounts.set(userId, userRequests);

    if (userRequests.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        resetTime: userRequests.resetTime
      });
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - userRequests.count),
      'X-RateLimit-Reset': new Date(userRequests.resetTime).toISOString()
    });

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireRole,
  requireEmailVerification,
  requireOwnership,
  rateLimitByUser
};