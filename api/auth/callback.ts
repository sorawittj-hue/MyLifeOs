import { OAuth2Client } from "google-auth-library";

export default async function handler(req, res) {
  const { code, state } = req.query;

  try {
    const fallbackProtocol = req.headers["x-forwarded-proto"] || "https";
    const fallbackHost = req.headers["x-forwarded-host"] || req.headers.host;
    
    let appUrl = process.env.APP_URL || `${fallbackProtocol}://${fallbackHost}`;
    
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        if (decodedState.origin) {
          appUrl = decodedState.origin;
        }
      } catch (e) {
        console.error("Failed to parse state:", e);
      }
    }
    
    const cleanAppUrl = appUrl.replace(/\/$/, "");

    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${cleanAppUrl}/auth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);

    res.setHeader('Content-Type', 'text/html');
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_FIT_AUTH_SUCCESS',
                tokens: ${JSON.stringify(tokens)}
              }, '*');
            }
            
            // Backup: save to localStorage for the main window to pick up
            localStorage.setItem('google_fit_auth_temp', JSON.stringify({
              timestamp: Date.now(),
              tokens: ${JSON.stringify(tokens)}
            }));
            
            setTimeout(() => {
              window.close();
            }, 500);
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_FIT_AUTH_ERROR',
                error: '${error.message || 'Unknown error'}'
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
}
