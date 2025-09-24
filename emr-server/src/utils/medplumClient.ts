const baseUrl = process.env.MEDPLUM_BASE_URL || "https://api.medplum.com";
const clientId = process.env.MEDPLUM_CLIENT_ID!;
const clientSecret = process.env.MEDPLUM_CLIENT_SECRET!;

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * Get or refresh an OAuth2 client_credentials token for Medplum.
 */
async function getToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  const response = await fetch(`${baseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid profile user/*.* patient/*.*"
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get Medplum token: ${response.status} ${await response.text()}`
    );
  }

  const json = await response.json();
  cachedToken = json.access_token;
  tokenExpiry = now + (json.expires_in ? json.expires_in * 1000 : 3600 * 1000);

  return cachedToken!;
}

/**
 * Sends a FHIR Bundle to Medplum.
 */
export async function sendToMedplum(bundle: any): Promise<any> {
  const token = await getToken();
  const response = await fetch(`${baseUrl}/fhir/R4`, {
    method: "POST",
    headers: {
      "Content-Type": "application/fhir+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bundle),
  });

  if (!response.ok) {
    throw new Error(
      `Medplum error: ${response.status} ${await response.text()}`
    );
  }

  return response.json();
}
