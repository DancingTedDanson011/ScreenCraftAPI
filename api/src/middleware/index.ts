// Middleware - Barrel Export

export {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  type AuthMiddlewareOptions,
} from './auth.middleware.js';

export {
  sessionMiddleware,
  optionalSessionMiddleware,
  requireTier,
  requireCredits,
} from './session.middleware.js';

export {
  createRapidApiMiddleware,
  createOptionalRapidApiMiddleware,
  isRapidApiRequest,
  type RapidApiMiddlewareOptions,
} from './rapidapi.middleware.js';

export {
  createRateLimitMiddleware,
  createIpRateLimitMiddleware,
  RateLimitMiddleware,
  type RateLimitMiddlewareOptions,
} from './rate-limit.middleware.js';
