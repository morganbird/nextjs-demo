import * as crypto from "crypto";

// Generate an ES256 keypair for OAuth client authentication
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

// Export as JWK
const privateJwk = privateKey.export({ format: "jwk" });
const publicJwk = publicKey.export({ format: "jwk" });

// Add required JWK fields
const kid = crypto.randomUUID();
const fullPrivateJwk = {
  ...privateJwk,
  kid,
  use: "sig",
  alg: "ES256",
};
const fullPublicJwk = {
  ...publicJwk,
  kid,
  use: "sig",
  alg: "ES256",
};

console.log("=== Private Key (store in OAUTH_PRIVATE_KEY env var) ===");
console.log(JSON.stringify(fullPrivateJwk));
console.log("\n=== Public Key (for client metadata) ===");
console.log(JSON.stringify(fullPublicJwk, null, 2));
console.log("\n=== Instructions ===");
console.log("1. Add the private key JSON as OAUTH_PRIVATE_KEY environment variable");
console.log("2. The public key will be served automatically from the client metadata endpoint");
