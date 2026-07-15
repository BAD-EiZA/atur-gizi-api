export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appEnv: process.env.APP_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
  frontendAllowedOrigins: (process.env.FRONTEND_ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  auth: {
    devBypass: process.env.AUTH_DEV_BYPASS === 'true',
    devUserId: process.env.AUTH_DEV_USER_ID ?? 'dev-user-1',
    devEmail: process.env.AUTH_DEV_EMAIL ?? 'dev@atur-gizi.local',
    devName: process.env.AUTH_DEV_NAME ?? 'Dev User',
    issuerUrl: process.env.KINDE_ISSUER_URL ?? '',
    audience: process.env.KINDE_AUDIENCE ?? '',
    jwksUrl: process.env.KINDE_JWKS_URL ?? '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS ?? '20000', 10),
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES ?? '2', 10),
    dailyQuota: parseInt(process.env.AI_DAILY_QUOTA ?? '10', 10),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'ai-fitness/development',
    deliveryType: process.env.CLOUDINARY_DELIVERY_TYPE ?? 'authenticated',
  },
  minUserAge: parseInt(process.env.MIN_USER_AGE ?? '15', 10),
});
