import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, Coins, Zap, List } from 'lucide-react';
import type { TokenMetadata } from '@/hooks/useTokenRegistry';
import type { NetworkType } from '@/contexts/WalletProvider';

interface TokenListProps {
  tokens: TokenMetadata[];
  network: NetworkType;
}

const getExplorerUrl = (address: string, network: NetworkType, type: 'tx' | 'address' = 'address') => {
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  const baseUrl = 'https://explorer.solana.com';
  return type === 'tx' 
    ? `${baseUrl}/tx/${address}${cluster}`
    : `${baseUrl}/address/${address}${cluster}`;
};

const truncateAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

export const TokenList: FC<TokenListProps> = ({ tokens, network }) => {
  const filteredTokens = tokens.filter(t => t.network === network);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5" />
          Your Tokens
        </CardTitle>
        <CardDescription>
          Tokens you've created on {network}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filteredTokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tokens created yet</p>
            <p className="text-sm">Create your first token above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTokens.map((token) => (
              <div
                key={token.mint}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {token.type === 'spl' ? (
                      <Coins className="h-5 w-5 text-primary" />
                    ) : (
                      <Zap className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{token.name}</span>
                      <Badge variant="secondary">{token.symbol}</Badge>
                      <Badge variant={token.type === 'spl' ? 'default' : 'outline'}>
                        {token.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{truncateAddress(token.mint)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(token.mint)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right text-sm mr-4">
                    <div className="text-muted-foreground">Decimals: {token.decimals}</div>
                    {token.initialSupply && (
                      <div className="text-muted-foreground">
                        Supply: {token.initialSupply.toLocaleString()}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={getExplorerUrl(token.mint, network)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Explorer
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
