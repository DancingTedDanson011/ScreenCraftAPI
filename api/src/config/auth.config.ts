// OAuth and Session Configuration

export const authConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/google/callback',
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/github/callback',
  },
  session: {
    secret: process.env.SESSION_SECRET!,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    cookieName: 'screencraft_session',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4321',
} as const;

export type AuthConfig = typeof authConfig;
