import { generateKeyPair } from "../server/lib/invite.js";

const { publicKey, privateKey } = generateKeyPair();

console.log("=== Ed25519 Key Pair Generated ===\n");
console.log("Add the following to your .env file:\n");

const privateKeyOneLine = privateKey.trimEnd().replace(/\n/g, "\\n");
const publicKeyOneLine = publicKey.trimEnd().replace(/\n/g, "\\n");

console.log(`INVITE_PRIVATE_KEY=${privateKeyOneLine}`);
console.log();
console.log(`INVITE_PUBLIC_KEY=${publicKeyOneLine}`);
console.log();
console.log("NOTE: INVITE_PRIVATE_KEY is only needed on machines that generate invite codes.");
console.log("      INVITE_PUBLIC_KEY is needed on the server to verify invite codes.");
