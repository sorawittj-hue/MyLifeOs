import { OAuth2Client } from "google-auth-library";

export default async function handler(req, res) {
  const { refresh_token } = req.body || {};

  if (!refresh_token) {
    return res.status(400).json({ error: "Missing refresh token" });
  }

  try {
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials({ refresh_token });
    const { credentials } = await client.refreshAccessToken();
    return res.json(credentials);
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return res.status(500).json({ error: "Failed to refresh token" });
  }
}
