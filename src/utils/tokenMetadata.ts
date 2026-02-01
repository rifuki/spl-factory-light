import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';

// Metaplex Token Metadata Program ID
export const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Instruction discriminator for CreateMetadataAccountV3
const CREATE_METADATA_V3_DISCRIMINATOR = Buffer.from([33]);

/**
 * Derives the metadata PDA for a given mint
 */
export function getMetadataPDA(mint: PublicKey): PublicKey {
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return metadataPDA;
}

export interface TokenMetadataInput {
  name: string;
  symbol: string;
  uri: string; // URL to off-chain metadata JSON
  sellerFeeBasisPoints?: number; // Royalty percentage (0-10000, where 100 = 1%)
  creators?: Array<{
    address: PublicKey;
    verified: boolean;
    share: number; // Percentage (0-100)
  }>;
}

/**
 * Serialize metadata data for CreateMetadataAccountV3
 */
function serializeMetadataData(metadata: TokenMetadataInput): Buffer {
  const buffers: Buffer[] = [];

  // Discriminator for CreateMetadataAccountV3
  buffers.push(CREATE_METADATA_V3_DISCRIMINATOR);

  // DataV2 struct
  // Name (string with u32 length prefix)
  const nameBuffer = Buffer.from(metadata.name.slice(0, 32));
  const nameLengthBuffer = Buffer.alloc(4);
  nameLengthBuffer.writeUInt32LE(nameBuffer.length, 0);
  buffers.push(nameLengthBuffer, nameBuffer);

  // Symbol (string with u32 length prefix)
  const symbolBuffer = Buffer.from(metadata.symbol.slice(0, 10));
  const symbolLengthBuffer = Buffer.alloc(4);
  symbolLengthBuffer.writeUInt32LE(symbolBuffer.length, 0);
  buffers.push(symbolLengthBuffer, symbolBuffer);

  // URI (string with u32 length prefix)
  const uriBuffer = Buffer.from(metadata.uri.slice(0, 200));
  const uriLengthBuffer = Buffer.alloc(4);
  uriLengthBuffer.writeUInt32LE(uriBuffer.length, 0);
  buffers.push(uriLengthBuffer, uriBuffer);

  // Seller fee basis points (u16)
  const sellerFeeBuffer = Buffer.alloc(2);
  sellerFeeBuffer.writeUInt16LE(metadata.sellerFeeBasisPoints || 0, 0);
  buffers.push(sellerFeeBuffer);

  // Creators (Option<Vec<Creator>>) - None (0)
  buffers.push(Buffer.from([0]));

  // Collection (Option<Collection>) - None (0)
  buffers.push(Buffer.from([0]));

  // Uses (Option<Uses>) - None (0)
  buffers.push(Buffer.from([0]));

  // isMutable (bool) - true (1)
  buffers.push(Buffer.from([1]));

  // collectionDetails (Option<CollectionDetails>) - None (0)
  buffers.push(Buffer.from([0]));

  return Buffer.concat(buffers);
}

/**
 * Create Metaplex metadata account instruction for wallet signing
 * This makes the token show up properly in wallets and explorers
 *
 * @param mint - The token mint address
 * @param mintAuthority - The mint authority public key
 * @param payer - Who pays for the account
 * @param updateAuthority - Who can update metadata later
 * @param metadata - Token metadata (name, symbol, URI)
 * @returns Transaction instruction
 */
export function createTokenMetadataInstruction(
  mint: PublicKey,
  mintAuthority: PublicKey,
  payer: PublicKey,
  updateAuthority: PublicKey,
  metadata: TokenMetadataInput
): TransactionInstruction {
  const metadataPDA = getMetadataPDA(mint);

  console.log('Creating metadata instruction...');
  console.log('  Mint:', mint.toString());
  console.log('  Metadata PDA:', metadataPDA.toString());
  console.log('  Name:', metadata.name);
  console.log('  Symbol:', metadata.symbol);

  // Serialize instruction data
  const data = serializeMetadataData(metadata);

  // Build instruction
  const keys = [
    { pubkey: metadataPDA, isSigner: false, isWritable: true }, // Metadata account
    { pubkey: mint, isSigner: false, isWritable: false }, // Mint
    { pubkey: mintAuthority, isSigner: true, isWritable: false }, // Mint authority
    { pubkey: payer, isSigner: true, isWritable: true }, // Payer
    { pubkey: updateAuthority, isSigner: false, isWritable: false }, // Update authority
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar
  ];

  return new TransactionInstruction({
    keys,
    programId: METADATA_PROGRAM_ID,
    data,
  });
}

// Note: Legacy function removed. Use createTokenMetadataInstruction() instead
// for wallet-compatible metadata creation.

/**
 * Create a simple metadata JSON that can be hosted
 * This is what the URI should point to
 *
 * @example
 * const json = createMetadataJSON({
 *   name: "My Token",
 *   symbol: "MTK",
 *   description: "A cool token",
 *   image: "https://arweave.net/...",
 * });
 * // Upload this JSON to IPFS/Arweave/Cloudinary
 * // Use the URL as the URI in createTokenMetadata
 */
export function createMetadataJSON(params: {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  externalUrl?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}) {
  return {
    name: params.name,
    symbol: params.symbol,
    description: params.description || '',
    image: params.image || '',
    external_url: params.externalUrl || '',
    attributes: params.attributes || [],
    properties: {
      files: params.image
        ? [
            {
              uri: params.image,
              type: 'image/png',
            },
          ]
        : [],
      category: 'fungible',
    },
  };
}
