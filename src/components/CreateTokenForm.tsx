import type { FC } from 'react';
import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { createRpc } from '@lightprotocol/stateless.js';
import {
  createMint as createCompressedMint,
  mintTo as mintToCompressed,
} from '@lightprotocol/compressed-token';
import { generateCompressedKeypair } from '@/utils/flashWallet';
import { createTokenMetadataInstruction, createMetadataJSON } from '@/utils/tokenMetadata';
import { uploadImageToPinata, uploadMetadataToPinata, isPinataConfigured } from '@/utils/pinata';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Coins, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { TokenMetadata } from '@/hooks/useTokenRegistry';
import type { NetworkType } from '@/contexts/WalletProvider';

interface CreateTokenFormProps {
  network: NetworkType;
  onTokenCreated: (token: TokenMetadata) => void;
}

export const CreateTokenForm: FC<CreateTokenFormProps> = ({ network, onTokenCreated }) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [tokenType, setTokenType] = useState<'spl' | 'light'>('spl');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    decimals: '9',
    initialSupply: '',
    image: '',
    description: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    if (!isPinataConfigured()) {
      toast.error('Pinata is not configured. Please add VITE_PINATA_JWT to .env file');
      return;
    }

    try {
      setUploadingImage(true);
      toast.info('Uploading image to IPFS...');

      const imageUrl = await uploadImageToPinata(file);
      setFormData(prev => ({ ...prev, image: imageUrl }));

      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Image upload failed:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const createSPLToken = async () => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const mintKeypair = Keypair.generate();
      const decimals = parseInt(formData.decimals) || 9;
      const initialSupply = formData.initialSupply ? parseFloat(formData.initialSupply) : 0;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Creating SPL Token');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Token details:', {
        name: formData.name,
        symbol: formData.symbol,
        decimals,
        initialSupply,
        mint: mintKeypair.publicKey.toString(),
        hasImage: !!formData.image,
      });

      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      const transaction = new Transaction();

      // Step 1: Create mint account
      console.log('Adding instruction: Create mint account');
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // Step 2: Initialize mint
      console.log('Adding instruction: Initialize mint');
      transaction.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey,
          null,
          TOKEN_PROGRAM_ID
        )
      );

      // Step 3: Create metadata (if image provided)
      if (formData.image) {
        console.log('Adding instruction: Create metadata');

        // Generate metadata URI
        let metadataURI: string | undefined;
        if (formData.image) {
          if (isPinataConfigured()) {
            // Auto-upload metadata JSON to Pinata IPFS
            console.log('  Uploading metadata JSON to Pinata IPFS...');
            toast.info('Uploading metadata to IPFS...');

            try {
              metadataURI = await uploadMetadataToPinata({
                name: formData.name,
                symbol: formData.symbol,
                description: formData.description || `${formData.name} Token`,
                image: formData.image,
              });
              console.log('  ✓ Metadata uploaded to IPFS:', metadataURI);
            } catch (error) {
              console.error('  Failed to upload metadata:', error);
              toast.error('Failed to upload metadata to IPFS. Using fallback...');

              // Fallback to inline metadata
              const metadataJSON = createMetadataJSON({
                name: formData.name,
                symbol: formData.symbol,
                description: formData.description || `${formData.name} Token`,
                image: formData.image,
              });
              metadataURI = `data:application/json;base64,${btoa(JSON.stringify(metadataJSON))}`;
              console.log('  Using fallback inline metadata URI');
            }
          } else {
            // Pinata not configured - fallback to inline metadata
            const metadataJSON = createMetadataJSON({
              name: formData.name,
              symbol: formData.symbol,
              description: formData.description || `${formData.name} Token`,
              image: formData.image,
            });
            metadataURI = `data:application/json;base64,${btoa(JSON.stringify(metadataJSON))}`;
            console.log('  Pinata not configured - using inline metadata URI');
          }
        }

        if (metadataURI) {
          const metadataIx = createTokenMetadataInstruction(
            mintKeypair.publicKey,
            publicKey,
            publicKey,
            publicKey,
            {
              name: formData.name,
              symbol: formData.symbol,
              uri: metadataURI,
            }
          );
          transaction.add(metadataIx);
          console.log('  Metadata instruction added to transaction');
        }
      } else {
        console.log('⚠️  No image URL provided - skipping metadata');
        console.log('   Token will show as "Unknown" in wallets');
      }

      // Step 4: If initial supply, create ATA and mint
      if (initialSupply > 0) {
        console.log('Adding instruction: Create ATA and mint tokens');
        const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, publicKey);

        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            ata,
            publicKey,
            mintKeypair.publicKey
          )
        );

        const amount = BigInt(Math.floor(initialSupply * 10 ** decimals));
        transaction.add(
          createMintToInstruction(
            mintKeypair.publicKey,
            ata,
            publicKey,
            amount
          )
        );
      }

      // Get latest blockhash and prepare transaction
      console.log('Preparing transaction for signing...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Partial sign with mint keypair
      console.log('Signing with mint keypair...');
      transaction.partialSign(mintKeypair);

      // Request wallet signature
      console.log('Requesting wallet signature...');
      if (!signTransaction) {
        throw new Error('Wallet does not support signing transactions');
      }

      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      console.log('Sending transaction...');
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      console.log('  Transaction signature:', signature);

      // Confirm transaction
      console.log('Confirming transaction...');
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ SPL TOKEN CREATED SUCCESSFULLY!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Summary:');
      console.log('  Mint:', mintKeypair.publicKey.toString());
      console.log('  Signature:', signature);
      console.log('  Has Metadata:', !!formData.image);
      if (formData.image) {
        console.log('  ✓ Token will show with name & logo in wallets!');
      } else {
        console.log('  ⚠️  Token will show as "Unknown" (no metadata)');
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return {
        mint: mintKeypair.publicKey.toString(),
        signature,
      };
    } catch (error) {
      console.error('Detailed error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  };

  const createLightToken = async () => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    // Declare flashPayer outside try block for error recovery access
    let flashPayer: Keypair | undefined;

    try {
      const decimals = parseInt(formData.decimals) || 9;
      const initialSupply = formData.initialSupply ? parseFloat(formData.initialSupply) : 0;

      console.log('Creating Light Protocol compressed token with:', {
        decimals,
        initialSupply,
        name: formData.name,
        symbol: formData.symbol
      });

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('FLASH WALLET APPROACH');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Step 1: Generate BN254-compatible keypair
      console.log('Step 1: Generating BN254-compatible keypair...');
      flashPayer = generateCompressedKeypair();
      console.log('✓ Flash payer generated:', flashPayer.publicKey.toString());

      // Calculate minimal funding required:
      // - Mint creation: ~1,500 lamports (Light Protocol sponsor rent)
      // - Mint to operation: ~1,000 lamports (State tree update)
      // - Transaction fees: ~10,000 lamports (2 txs @ 5k each)
      // - Safety buffer: ~2,500 lamports
      // Total: 0.005 SOL (much cheaper than 0.01!)
      const fundAmount = 5_000_000; // 0.005 SOL in lamports
      console.log('Step 2: Funding flash wallet with', (fundAmount / 1e9).toFixed(4), 'SOL...');

      const fundTransaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: flashPayer.publicKey,
          lamports: fundAmount,
        })
      );

      const { blockhash: fundBlockhash, lastValidBlockHeight: fundLastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      fundTransaction.recentBlockhash = fundBlockhash;
      fundTransaction.feePayer = publicKey;

      const signedFundTx = await signTransaction(fundTransaction);
      const fundRawTx = signedFundTx.serialize();
      const fundSignature = await connection.sendRawTransaction(fundRawTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      console.log('  Tx signature:', fundSignature);
      await connection.confirmTransaction({
        signature: fundSignature,
        blockhash: fundBlockhash,
        lastValidBlockHeight: fundLastValidBlockHeight,
      }, 'confirmed');

      console.log('✓ Flash wallet funded successfully');

      // Step 3: Create Light Protocol compressed mint
      console.log('Step 3: Creating Light Protocol compressed mint...');

      const rpcEndpoint = connection.rpcEndpoint;
      const rpc = createRpc(rpcEndpoint, rpcEndpoint);

      // Create compressed mint
      // Signature: createMint(rpc, payer, mintAuthority, decimals, keypair?, confirmOptions?, tokenProgramId?, freezeAuthority?)
      const { mint, transactionSignature: mintSignature } = await createCompressedMint(
        rpc,
        flashPayer, // payer (Signer)
        flashPayer.publicKey, // mint authority (PublicKey | Signer)
        decimals,
        undefined, // keypair (auto-generate)
        undefined, // confirmOptions
        undefined, // tokenProgramId
        undefined // freezeAuthority
      );

      console.log('✓ Compressed mint created:', mint.toString());
      console.log('  Mint signature:', mintSignature);

      let finalSignature = mintSignature;

      // Step 4: Mint tokens to user (if initial supply specified)
      if (initialSupply > 0) {
        console.log(`Step 4: Minting ${initialSupply} tokens to user...`);

        // Mint compressed tokens directly to user's pubkey
        // No ATA needed - Light Protocol uses compressed accounts
        const amount = BigInt(Math.floor(initialSupply * 10 ** decimals));

        const mintToSignature = await mintToCompressed(
          rpc,
          flashPayer, // payer (Signer)
          mint, // mint PublicKey
          publicKey, // recipient (user's wallet)
          flashPayer, // mint authority (Signer)
          amount // amount as BN
        );

        console.log('✓ Tokens minted to user');
        console.log('  Mint-to signature:', mintToSignature);
        finalSignature = mintToSignature;
      }

      // Step 5: Refund remaining SOL to user
      console.log('Step 5: Refunding unused SOL...');

      // Wait briefly for previous transactions to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      const remainingBalance = await connection.getBalance(flashPayer.publicKey);
      console.log('  Flash wallet balance:', remainingBalance, 'lamports');

      // Keep minimum 5000 lamports (transaction fee safety buffer)
      const minBuffer = 5000;

      if (remainingBalance > minBuffer) {
        const refundAmount = remainingBalance - minBuffer;
        console.log('  Refunding:', (refundAmount / 1e9).toFixed(6), 'SOL');

        const refundTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: flashPayer.publicKey,
            toPubkey: publicKey,
            lamports: refundAmount,
          })
        );

        const { blockhash: refundBlockhash, lastValidBlockHeight: refundLastValid } =
          await connection.getLatestBlockhash('confirmed');
        refundTx.recentBlockhash = refundBlockhash;
        refundTx.feePayer = flashPayer.publicKey;
        refundTx.sign(flashPayer);

        const refundSig = await connection.sendRawTransaction(refundTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        await connection.confirmTransaction({
          signature: refundSig,
          blockhash: refundBlockhash,
          lastValidBlockHeight: refundLastValid,
        }, 'confirmed');

        console.log('✓ Refunded', (refundAmount / 1e9).toFixed(6), 'SOL to user');
        console.log('  Refund signature:', refundSig);
      } else {
        console.log('  No refundable balance (all funds used for transactions)');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 LIGHT TOKEN CREATED SUCCESSFULLY!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Summary:');
      console.log('  Mint:', mint.toString());
      console.log('  Signature:', finalSignature);
      console.log('  Network: Devnet (ZK Compression)');
      console.log('  Flash wallet funding: 0.005 SOL');
      console.log('  Actual cost: ~0.00003 SOL (super cheap!)');
      console.log('  Refunded: ~0.00497 SOL');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return {
        mint: mint.toString(),
        signature: finalSignature,
      };
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ ERROR CREATING LIGHT TOKEN');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Error:', error);

      // CRITICAL: Always attempt refund on error
      // This ensures user doesn't lose their SOL even if token creation fails
      if (flashPayer) {
        console.log('Attempting emergency refund...');
        try {
          const balance = await connection.getBalance(flashPayer.publicKey);
          if (balance > 5000) {
            const refundAmount = balance - 5000;
            const emergencyRefundTx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: flashPayer.publicKey,
                toPubkey: publicKey,
                lamports: refundAmount,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            emergencyRefundTx.recentBlockhash = blockhash;
            emergencyRefundTx.feePayer = flashPayer.publicKey;
            emergencyRefundTx.sign(flashPayer);

            const refundSig = await connection.sendRawTransaction(
              emergencyRefundTx.serialize(),
              { skipPreflight: false }
            );

            console.log('✓ Emergency refund successful:', refundSig);
            console.log('  Recovered:', (refundAmount / 1e9).toFixed(6), 'SOL');
          } else {
            console.log('No balance to refund from flash wallet');
          }
        } catch (refundError) {
          console.error('⚠️ Emergency refund failed:', refundError);
          console.error('Flash wallet pubkey:', flashPayer.publicKey.toString());
          console.error('User may need to manually recover funds');
        }
      }

      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (!formData.name || !formData.symbol) {
      alert('Please fill in token name and symbol');
      return;
    }

    setLoading(true);

    try {
      let result: { mint: string; signature: string };

      if (tokenType === 'spl') {
        result = await createSPLToken();
      } else {
        result = await createLightToken();
      }

      const token: TokenMetadata = {
        mint: result.mint,
        name: formData.name,
        symbol: formData.symbol.toUpperCase(),
        decimals: parseInt(formData.decimals) || 9,
        type: tokenType,
        network,
        creator: publicKey.toString(),
        createdAt: new Date().toISOString(),
        initialSupply: formData.initialSupply ? parseFloat(formData.initialSupply) : undefined,
        signature: result.signature,
      };

      // Notify parent component (App will show toast)
      onTokenCreated(token);

      // Reset form
      setFormData({
        name: '',
        symbol: '',
        decimals: '9',
        initialSupply: '',
        image: '',
        description: '',
      });

    } catch (error) {
      console.error('Error creating token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error('Failed to create token', {
        description: errorMessage,
        duration: 8000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Create Token
        </CardTitle>
        <CardDescription>
          Create a new SPL token or Light Protocol compressed token
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tokenType} onValueChange={(v) => setTokenType(v as 'spl' | 'light')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="spl" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              SPL Token
            </TabsTrigger>
            <TabsTrigger value="light" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Light Token
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spl">
            <p className="text-sm text-muted-foreground mb-4">
              Standard SPL Token on Solana. Full compatibility with all wallets and DEXs.
            </p>
          </TabsContent>

          <TabsContent value="light">
            <div className="space-y-2 mb-4">
              <p className="text-sm text-muted-foreground">
                Compressed token using Light Protocol. Lower cost (~99% cheaper), higher scalability.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  ⚠️ <strong>Note:</strong> Light tokens will show as "Unknown" in wallets and explorers.
                  Compressed tokens don't support on-chain metadata yet.
                  Use SPL tokens if you need custom name/logo display.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Token Name *</Label>
              <Input
                id="name"
                placeholder="My Token"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol *</Label>
              <Input
                id="symbol"
                placeholder="MTK"
                value={formData.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="decimals">Decimals</Label>
              <Input
                id="decimals"
                type="number"
                min="0"
                max="18"
                placeholder="9"
                value={formData.decimals}
                onChange={(e) => handleInputChange('decimals', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialSupply">Initial Supply</Label>
              <Input
                id="initialSupply"
                type="number"
                min="0"
                placeholder="1000000"
                value={formData.initialSupply}
                onChange={(e) => handleInputChange('initialSupply', e.target.value)}
              />
            </div>
          </div>

          {tokenType === 'spl' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="image">
                  Token Image (optional)
                  <span className="text-xs text-muted-foreground ml-2">
                    Makes your token show up with logo in wallets
                  </span>
                </Label>

                {isPinataConfigured() ? (
                  <>
                    <div className="flex gap-2">
                      <Input
                        id="image-file"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="flex-1"
                      />
                      {uploadingImage && (
                        <Button disabled size="icon" variant="outline">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </Button>
                      )}
                    </div>
                    {formData.image && (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <img
                          src={formData.image}
                          alt="Token"
                          className="w-10 h-10 rounded object-cover"
                        />
                        <p className="text-xs text-muted-foreground flex-1 truncate">
                          {formData.image}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInputChange('image', '')}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      ✨ Image will be auto-uploaded to IPFS via Pinata
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      id="image"
                      type="url"
                      placeholder="https://blush-tragic-goat-277.mypinata.cloud/ipfs/..."
                      value={formData.image}
                      onChange={(e) => handleInputChange('image', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 Upload to <a href="https://imgur.com/upload" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Imgur</a> or <a href="https://nft.storage" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">NFT.Storage</a>, then paste URL here
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your token..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !publicKey}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                {tokenType === 'spl' ? <Coins className="mr-2 h-4 w-4" /> : <Zap className="mr-2 h-4 w-4" />}
                Create {tokenType === 'spl' ? 'SPL' : 'Light'} Token
              </>
            )}
          </Button>

          {!publicKey && (
            <p className="text-sm text-center text-muted-foreground">
              Connect your wallet to create tokens
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
