declare global {
  namespace Express {
    interface Request {
      validated: unknown;
      prototypeUserId?: string;
    }
  }
}

export {};
