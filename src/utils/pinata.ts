/**
 * Pinata IPFS Integration
 * Utilities for uploading files and JSON metadata to Pinata IPFS
 */

import { PinataSDK, type UploadResponse } from 'pinata';

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.VITE_PINATA_JWT,
  pinataGateway: import.meta.env.VITE_PINATA_GATEWAY,
});

export type PinataUploadResponse = UploadResponse & {
  gatewayUrl: string;
};

export interface TokenMetadataJSON {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

type Metadata = {
  name?: string;
  keyvalues?: Record<string, string>;
};

class PinataService {
  /**
   * Generate unique filename to avoid collisions
   * Format: {timestamp}-{random}-{originalName}
   */
  private generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, '-');
    return `${timestamp}-${randomStr}-${sanitized}`;
  }

  /**
   * Upload file to Pinata IPFS
   * @param file - File to upload
   * @param metadata - Optional metadata (name, keyvalues)
   * @returns Upload response with gateway URL
   */
  async uploadFile(
    file: File,
    metadata?: Metadata
  ): Promise<PinataUploadResponse> {
    try {
      console.log('📤 Uploading file to Pinata IPFS...');
      console.log('  File:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);

      // Generate unique filename to avoid collisions
      const uniqueName = metadata?.name
        ? this.generateUniqueFilename(metadata.name)
        : this.generateUniqueFilename(file.name);

      let uploadBuilder = pinata.upload.public.file(file);
      uploadBuilder = uploadBuilder.name(uniqueName);
      if (metadata?.keyvalues) uploadBuilder = uploadBuilder.keyvalues(metadata.keyvalues);

      const uploadResponse = await uploadBuilder;
      console.log('  Upload response:', uploadResponse);

      // Convert CID to URL using gateway (CORRECT WAY!)
      const gatewayUrl = await pinata.gateways.public.convert(uploadResponse.cid);

      console.log('✅ File uploaded successfully!');
      console.log('  CID:', uploadResponse.cid);
      console.log('  Gateway URL:', gatewayUrl);

      return { ...uploadResponse, gatewayUrl };
    } catch (error: unknown) {
      console.error('❌ Error uploading file to Pinata:', error);
      throw new Error(
        `Failed to upload file to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload JSON to Pinata IPFS
   * @param json - JSON object to upload
   * @param metadata - Optional metadata (name, keyvalues)
   * @returns Upload response with gateway URL
   */
  async uploadJSON(
    json: object,
    metadata?: Metadata
  ): Promise<PinataUploadResponse> {
    try {
      console.log('📤 Uploading JSON to Pinata IPFS...');
      console.log('  JSON:', json);

      // Generate unique filename to avoid collisions
      const uniqueName = metadata?.name
        ? this.generateUniqueFilename(metadata.name)
        : this.generateUniqueFilename('metadata.json');

      let uploadBuilder = pinata.upload.public.json(json);
      uploadBuilder = uploadBuilder.name(uniqueName);
      if (metadata?.keyvalues) uploadBuilder = uploadBuilder.keyvalues(metadata.keyvalues);

      const uploadResponse = await uploadBuilder;
      console.log('  Upload response:', uploadResponse);

      // Convert CID to URL using gateway (CORRECT WAY!)
      const gatewayUrl = await pinata.gateways.public.convert(uploadResponse.cid);

      console.log('✅ JSON uploaded successfully!');
      console.log('  CID:', uploadResponse.cid);
      console.log('  Gateway URL:', gatewayUrl);

      return {
        ...uploadResponse,
        gatewayUrl,
      };
    } catch (error: unknown) {
      console.error('❌ Error uploading JSON to Pinata:', error);
      throw new Error(
        `Failed to upload JSON to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test Pinata authentication
   * @returns true if authenticated, false otherwise
   */
  async testAuthentication(): Promise<boolean> {
    try {
      await pinata.testAuthentication();
      console.log('✅ Pinata authentication successful');
      return true;
    } catch (error: unknown) {
      console.error('❌ Pinata authentication failed:', error);
      return false;
    }
  }
}

export const pinataService = new PinataService();

/**
 * Upload image to Pinata IPFS
 * @param file - Image file to upload
 * @returns Full upload response with CID and gateway URL
 */
export async function uploadImageToPinata(file: File): Promise<PinataUploadResponse> {
  const result = await pinataService.uploadFile(file, {
    name: file.name,
  });
  return result;
}

/**
 * Upload token metadata JSON to Pinata IPFS
 * @param metadata - Token metadata object
 * @returns IPFS URL to the uploaded metadata
 */
export async function uploadMetadataToPinata(
  metadata: TokenMetadataJSON
): Promise<string> {
  // Create metadata JSON following Metaplex standard
  const metadataJSON = {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description || `${metadata.name} Token`,
    image: metadata.image || '',
    external_url: metadata.external_url || '',
    attributes: metadata.attributes || [],
    properties: {
      files: metadata.image
        ? [
            {
              uri: metadata.image,
              type: 'image/png',
            },
          ]
        : [],
      category: 'fungible',
    },
  };

  const result = await pinataService.uploadJSON(metadataJSON, {
    name: `${metadata.symbol}-metadata.json`,
  });

  return result.gatewayUrl;
}

/**
 * Check if Pinata is configured
 */
export function isPinataConfigured(): boolean {
  return !!import.meta.env.VITE_PINATA_JWT;
}
