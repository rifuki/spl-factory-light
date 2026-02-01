import { useState, useCallback } from 'react';

export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  type: 'spl' | 'light';
  network: 'devnet' | 'mainnet-beta' | 'localnet';
  creator: string;
  createdAt: string;
  initialSupply?: number;
  uri?: string;
  signature: string;
}

const STORAGE_KEY = 'spl-factory-tokens';

export function useTokenRegistry() {
  const [tokens, setTokens] = useState<TokenMetadata[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const addToken = useCallback((token: TokenMetadata) => {
    setTokens(prev => {
      const updated = [...prev, token];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getTokensByType = useCallback((type: 'spl' | 'light') => {
    return tokens.filter(t => t.type === type);
  }, [tokens]);

  const getTokensByNetwork = useCallback((network: string) => {
    return tokens.filter(t => t.network === network);
  }, [tokens]);

  const clearTokens = useCallback(() => {
    setTokens([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    tokens,
    addToken,
    getTokensByType,
    getTokensByNetwork,
    clearTokens,
  };
}
