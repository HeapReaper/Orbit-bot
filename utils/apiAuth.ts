import { Request, Response, NextFunction } from "express";

// You can store your API key in environment variables for security
const API_KEY = process.env.API_KEY;

// Middleware to check API key
export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"]; // Clients should send API key in header

  if (!apiKey) {
    return res.status(401).json({ error: "API key is missing" });
  }

  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next(); // API key is valid, continue to the route
}
