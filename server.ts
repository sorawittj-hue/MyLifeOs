import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4567;

// Allow external popups for Firebase OAuth (Cross-Origin-Opener-Policy)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
app.use(express.json());

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/callback`
);

// Google Fit Scopes
const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

// API Routes
app.get("/api/auth/google/url", (req, res) => {
  console.log('[Server] Google Fit auth URL requested');
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('[Server] MISSING_SECRETS: Google OAuth credentials not configured');
    return res.status(400).json({
      error: "MISSING_SECRETS",
      message: "กรุณาตั้งค่า GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ใน Settings > Secrets ของ AI Studio ก่อนครับ"
    });
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  console.log('[Server] Generated OAuth URL successfully');
  res.json({ url });
});

app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  console.log('[Server] OAuth callback received, code:', code ? 'present' : 'missing');

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    console.log('[Server] OAuth token exchange successful');

    // In a real app, we'd store these in a database linked to the user.
    // For this demo, we'll send them back to the client to store in IndexedDB.
    // Note: In production, NEVER send refresh tokens to the client.

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_FIT_AUTH_SUCCESS',
                tokens: ${JSON.stringify(tokens)}
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("[Server] Error exchanging code for tokens:", error);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_FIT_AUTH_ERROR',
                error: '${error instanceof Error ? error.message : 'Unknown error'}'
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication failed. This window should close automatically.</p>
        </body>
      </html>
    `);
  }
});

// Proxy endpoint to refresh tokens or fetch data if needed server-side
app.post("/api/auth/google/refresh", async (req, res) => {
  const { refresh_token } = req.body;
  console.log('[Server] Token refresh requested');

  if (!refresh_token) {
    console.error('[Server] Missing refresh token');
    return res.status(400).json({ error: "Missing refresh token" });
  }

  try {
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials({ refresh_token });
    const { credentials } = await client.refreshAccessToken();
    console.log('[Server] Token refresh successful');
    res.json(credentials);
  } catch (error) {
    console.error('[Server] Failed to refresh token:', error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
