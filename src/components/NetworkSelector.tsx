import type { FC } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NetworkType } from '@/contexts/WalletProvider';

interface NetworkSelectorProps {
  network: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
}

export const NetworkSelector: FC<NetworkSelectorProps> = ({ network, onNetworkChange }) => {
  return (
    <Select value={network} onValueChange={(v) => onNetworkChange(v as NetworkType)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Select network" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="devnet">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Devnet
          </div>
        </SelectItem>
        <SelectItem value="mainnet-beta">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            Mainnet
          </div>
        </SelectItem>
        <SelectItem value="localnet">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            Localnet
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
