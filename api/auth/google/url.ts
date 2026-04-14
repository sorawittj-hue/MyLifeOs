import { OAuth2Client } from "google-auth-library";

export default function handler(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({
      error: "MISSING_SECRETS",
      message: "กรุณาตั้งค่า GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET"
    });
  }

  const fallbackProtocol = req.headers["x-forwarded-proto"] || "https";
  const fallbackHost = req.headers["x-forwarded-host"] || req.headers.host;
  
  // Use the origin from query if provided, otherwise fallback
  const appUrl = req.query.origin || process.env.APP_URL || `${fallbackProtocol}://${fallbackHost}`;
  
  // Clean any trailing slashes to be safe
  const cleanAppUrl = appUrl.replace(/\/$/, "");

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${cleanAppUrl}/auth/callback`
  );

  const SCOPES = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.blood_pressure.read",
    "https://www.googleapis.com/auth/fitness.oxygen_saturation.read",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: Buffer.from(JSON.stringify({ origin: cleanAppUrl })).toString('base64'),
  });

  return res.json({ url });
}
