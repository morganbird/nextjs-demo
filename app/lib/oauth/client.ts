import { NodeOAuthClient, NodeSavedSession, NodeSavedState, NodeSavedSessionStore, NodeSavedStateStore } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { kv } from "@vercel/kv";

// Session store using Vercel KV
const sessionStore: NodeSavedSessionStore = {
  async get(key: string): Promise<NodeSavedSession | undefined> {
    const value = await kv.get<NodeSavedSession>(`oauth:session:${key}`);
    return value ?? undefined;
  },
  async set(key: string, value: NodeSavedSession) {
    // Sessions expire after 30 days
    await kv.set(`oauth:session:${key}`, value, { ex: 30 * 24 * 60 * 60 });
  },
  async del(key: string) {
    await kv.del(`oauth:session:${key}`);
  },
};

// State store for OAuth flow (short-lived)
const stateStore: NodeSavedStateStore = {
  async get(key: string): Promise<NodeSavedState | undefined> {
    const value = await kv.get<NodeSavedState>(`oauth:state:${key}`);
    return value ?? undefined;
  },
  async set(key: string, value: NodeSavedState) {
    // State expires after 10 minutes
    await kv.set(`oauth:state:${key}`, value, { ex: 600 });
  },
  async del(key: string) {
    await kv.del(`oauth:state:${key}`);
  },
};

let oauthClient: NodeOAuthClient | null = null;

export async function getOAuthClient(): Promise<NodeOAuthClient> {
  if (oauthClient) return oauthClient;

  const privateKeyJson = process.env.OAUTH_PRIVATE_KEY;
  if (!privateKeyJson) {
    throw new Error("OAUTH_PRIVATE_KEY environment variable is required");
  }

  const publicUrl = process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL;
  if (!publicUrl) {
    throw new Error("NEXT_PUBLIC_URL or VERCEL_URL environment variable is required");
  }

  const baseUrl = publicUrl.startsWith("http") ? publicUrl : `https://${publicUrl}`;
  const clientId = `${baseUrl}/api/oauth/client-metadata`;

  const privateKey = await JoseKey.fromJWK(JSON.parse(privateKeyJson));

  oauthClient = new NodeOAuthClient({
    clientMetadata: {
      client_id: clientId,
      client_name: "Bluesky Daily Digest",
      client_uri: baseUrl,
      redirect_uris: [`${baseUrl}/api/oauth/callback`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "atproto transition:generic",
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_signing_alg: "ES256",
      dpop_bound_access_tokens: true,
      jwks: {
        keys: [privateKey.publicJwk],
      },
    },
    keyset: [privateKey],
    stateStore,
    sessionStore,
  });

  return oauthClient;
}

// Helper to get the public key for client metadata
export function getPublicKeyJwk(): object | null {
  const privateKeyJson = process.env.OAUTH_PRIVATE_KEY;
  if (!privateKeyJson) return null;

  const privateKey = JSON.parse(privateKeyJson);
  // Remove private component to get public key
  const { d, ...publicKey } = privateKey;
  return publicKey;
}
