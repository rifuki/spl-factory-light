import { Keypair, PublicKey } from '@solana/web3.js';
import { isSmallerThanBn254FieldSizeBe } from '@lightprotocol/stateless.js';

/**
 * Generate a BN254-compatible keypair for Light Protocol
 * Light Protocol requires keypairs within BN254 field size for ZK proofs
 */
export function generateCompressedKeypair(): Keypair {
  let attempts = 0;
  const maxAttempts = 1000; // Safety limit

  while (attempts < maxAttempts) {
    attempts++;
    const keypair = Keypair.generate();

    // Check if public key fits within BN254 field size
    if (isSmallerThanBn254FieldSizeBe(keypair.publicKey.toBuffer())) {
      console.log(`✓ Generated BN254-compatible keypair after ${attempts} attempts`);
      console.log('  Pubkey:', keypair.publicKey.toBase58());
      return keypair;
    }
  }

  throw new Error(`Failed to generate BN254-compatible keypair after ${maxAttempts} attempts`);
}

/**
 * Check if a public key is BN254-compatible
 */
export function isValidCompressedPubkey(pubkey: PublicKey): boolean {
  return isSmallerThanBn254FieldSizeBe(pubkey.toBuffer());
}
