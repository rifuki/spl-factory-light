import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

export type NetworkType = 'devnet' | 'mainnet-beta' | 'localnet';

interface WalletProviderProps {
  children: ReactNode;
  network: NetworkType;
}

export const WalletProvider: FC<WalletProviderProps> = ({ children, network }) => {
  const endpoint = useMemo(() => {
    switch (network) {
      case 'localnet':
        return 'http://127.0.0.1:8899';
      case 'devnet': {
        // Use Helius RPC for Light Protocol (ZK Compression) support
        const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;
        if (heliusApiKey && heliusApiKey !== 'your-api-key-here') {
          return `https://devnet.helius-rpc.com?api-key=${heliusApiKey}`;
        }
        // Fallback to standard devnet if no Helius API key
        console.warn(
          'No Helius API key found. Light Protocol tokens require Helius RPC. ' +
          'Get a free API key at https://www.helius.dev/ and add it to .env as VITE_HELIUS_API_KEY'
        );
        return clusterApiUrl('devnet');
      }
      case 'mainnet-beta':
        return clusterApiUrl('mainnet-beta');
      default:
        return clusterApiUrl('devnet');
    }
  }, [network]);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
