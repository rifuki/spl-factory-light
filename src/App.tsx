import { useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { WalletProvider } from '@/contexts/WalletProvider';
import type { NetworkType } from '@/contexts/WalletProvider';
import { CreateTokenForm } from '@/components/CreateTokenForm';
import { TokenList } from '@/components/TokenList';
import { NetworkSelector } from '@/components/NetworkSelector';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import type { TokenMetadata } from '@/hooks/useTokenRegistry';
import { Toaster, toast } from 'sonner';
import { Coins, Github, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

function AppContent() {
  const [network, setNetwork] = useState<NetworkType>('devnet');
  const { tokens, addToken } = useTokenRegistry();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const handleTokenCreated = (token: TokenMetadata) => {
    addToken(token);
    const tokenType = token.type === 'spl' ? 'SPL Token' : 'Light Protocol Token';
    toast.success(`🎉 ${tokenType} Created!`, {
      description: `${token.name} (${token.symbol}) has been minted to your wallet. Your wallet will auto-detect it within 1-2 minutes.`,
      duration: 10000,
      action: {
        label: 'View on Explorer',
        onClick: () => {
          const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
          window.open(`https://explorer.solana.com/address/${token.mint}${cluster}`, '_blank');
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">SPL Factory</span>
          </div>

          <div className="flex items-center gap-4">
            <NetworkSelector network={network} onNetworkChange={setNetwork} />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-5 w-5" />
            </a>

            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4 py-8">
            <h1 className="text-4xl font-bold tracking-tight">
              Create Solana Tokens
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Launch SPL tokens or Light Protocol compressed tokens with ease.
              No coding required.
            </p>
          </div>

          {/* Create Token Form */}
          <CreateTokenForm network={network} onTokenCreated={handleTokenCreated} />

          {/* Token List */}
          <TokenList tokens={tokens} network={network} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>SPL Factory — Create tokens on Solana blockchain</p>
        </div>
      </footer>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}

function App() {
  const [network] = useState<NetworkType>('devnet');

  return (
    <WalletProvider network={network}>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
