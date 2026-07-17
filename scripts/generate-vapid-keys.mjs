import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1"
});
const publicJwk = publicKey.export({ format: "jwk" });
const privateJwk = privateKey.export({ format: "jwk" });

const x = Buffer.from(publicJwk.x, "base64url");
const y = Buffer.from(publicJwk.y, "base64url");
const uncompressedPublicKey = Buffer.concat([Buffer.from([4]), x, y]);

process.stdout.write(JSON.stringify({
  VAPID_PUBLIC_KEY: uncompressedPublicKey.toString("base64url"),
  VAPID_PRIVATE_KEY: privateJwk.d
}, null, 2));
process.stdout.write("\n");
