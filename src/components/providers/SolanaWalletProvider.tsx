'use client'

import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'

// Import required Solana wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'

interface SolanaWalletProviderProps {
  children: React.ReactNode
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  // Configure Solana network - use mainnet-beta for production
  const network = WalletAdapterNetwork.Devnet // Change to Mainnet for production
  const endpoint = useMemo(() => {
    if (network === WalletAdapterNetwork.Devnet) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network)
    }
    return clusterApiUrl(network)
  }, [network])

  // Configure supported wallets
  // Note: Phantom and Solflare now auto-register as Standard Wallets
  // so we only include adapters that don't have standard wallet support yet
  const wallets = useMemo(
    () => [
      new CoinbaseWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
} 