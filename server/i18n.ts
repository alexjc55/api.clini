import { Request, Response, NextFunction } from "express";

export const SUPPORTED_LANGUAGES = ["he", "ru", "ar", "en"] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";
export const RTL_LANGUAGES: SupportedLanguage[] = ["he", "ar"];

declare global {
  namespace Express {
    interface Request {
      lang: SupportedLanguage;
    }
  }
}

export function parseAcceptLanguage(header: string | undefined): SupportedLanguage {
  if (!header) return DEFAULT_LANGUAGE;
  
  const languages = header
    .split(",")
    .map(part => {
      const [lang, priority] = part.trim().split(";q=");
      return {
        lang: lang.split("-")[0].toLowerCase(),
        priority: priority ? parseFloat(priority) : 1
      };
    })
    .sort((a, b) => b.priority - a.priority);
  
  for (const { lang } of languages) {
    if (SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
      return lang as SupportedLanguage;
    }
  }
  
  return DEFAULT_LANGUAGE;
}

export function i18nMiddleware(req: Request, res: Response, next: NextFunction) {
  req.lang = parseAcceptLanguage(req.headers["accept-language"]);
  res.setHeader("Content-Language", req.lang);
  next();
}

export interface LocalizedMessage {
  key: string;
  params?: Record<string, unknown>;
}

export interface LocalizedError {
  error: LocalizedMessage;
}

export interface LocalizedSuccess<T = unknown> {
  status: "success";
  message?: LocalizedMessage;
  data?: T;
}

export function createError(key: string, params?: Record<string, unknown>): LocalizedMessage {
  return { key, params };
}

export function createSuccess<T>(data?: T, messageKey?: string, params?: Record<string, unknown>): LocalizedSuccess<T> {
  const response: LocalizedSuccess<T> = { status: "success" };
  if (messageKey) {
    response.message = { key: messageKey, params };
  }
  if (data !== undefined) {
    response.data = data;
  }
  return response;
}

export function sendLocalizedError(res: Response, statusCode: number, key: string, params?: Record<string, unknown>) {
  res.status(statusCode).json({ error: createError(key, params) });
}

export function sendLocalizedSuccess<T>(res: Response, data?: T, messageKey?: string, params?: Record<string, unknown>) {
  res.json(createSuccess(data, messageKey, params));
}
