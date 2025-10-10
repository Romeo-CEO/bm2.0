import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

const ONE_HOUR_SECONDS = 60 * 60;

const loginIpLimiter = new RateLimiterMemory({
  points: 10,
  duration: ONE_HOUR_SECONDS,
});

const loginEmailLimiter = new RateLimiterMemory({
  points: 5,
  duration: ONE_HOUR_SECONDS,
});

const forgotPasswordIpLimiter = new RateLimiterMemory({
  points: 3,
  duration: ONE_HOUR_SECONDS,
});

const setRateLimitHeaders = (res: Response, limit: number, remaining: number, msBeforeNext: number) => {
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  if (msBeforeNext) {
    const resetSeconds = Math.ceil(msBeforeNext / 1000);
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());
    res.setHeader('Retry-After', resetSeconds.toString());
  }
};

const handleRateLimitRejection = (res: Response, limiterRes: RateLimiterRes, limit: number) => {
  setRateLimitHeaders(res, limit, 0, limiterRes.msBeforeNext);
  res.status(429).json({ success: false, error: 'Too many attempts. Please try again later.' });
};

export const loginRateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const email: string | undefined = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;

  if (!email) {
    res.status(400).json({ success: false, error: 'Email is required.' });
    return;
  }

  try {
    const ipKey = req.ip || req.connection.remoteAddress || 'unknown';
    let ipConsume: RateLimiterRes;
    try {
      ipConsume = await loginIpLimiter.consume(ipKey);
    } catch (err) {
      const rejection = err as RateLimiterRes;
      handleRateLimitRejection(res, rejection, loginIpLimiter.points);
      return;
    }

    let emailConsume: RateLimiterRes;
    try {
      emailConsume = await loginEmailLimiter.consume(email);
    } catch (err) {
      await loginIpLimiter.reward(ipKey, 1);
      const rejection = err as RateLimiterRes;
      handleRateLimitRejection(res, rejection, loginEmailLimiter.points);
      return;
    }

    const combinedLimit = Math.min(loginIpLimiter.points, loginEmailLimiter.points);
    const combinedRemaining = Math.min(ipConsume.remainingPoints, emailConsume.remainingPoints);
    const msBeforeNext = Math.max(ipConsume.msBeforeNext, emailConsume.msBeforeNext);
    setRateLimitHeaders(res, combinedLimit, combinedRemaining, msBeforeNext);

    next();
  } catch (error: unknown) {
    console.error('Login rate limit error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const forgotPasswordRateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ipKey = req.ip || req.connection.remoteAddress || 'unknown';
    const result = await forgotPasswordIpLimiter.consume(ipKey);
    setRateLimitHeaders(res, forgotPasswordIpLimiter.points, result.remainingPoints, result.msBeforeNext);
    next();
  } catch (error) {
    if (error instanceof RateLimiterRes || (typeof error === 'object' && error !== null && 'msBeforeNext' in error)) {
      const limiterRes = error as RateLimiterRes;
      handleRateLimitRejection(res, limiterRes, forgotPasswordIpLimiter.points);
      return;
    }

    console.error('Forgot password rate limit error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
