import { useEffect, useState } from "react";
import { MONITORED_WALLETS, SOL_MINT, type WalletConfig } from "../config";
import {
  fetchSol,
  fetchSplTokens,
  fetchJupiterPrices,
  type SolAccountResp,
  type TokenAccountResp,
} from "../api";

/* ------------------------------------------------------------------------- */
/*                       Types that WalletCard expects                       */
/* ------------------------------------------------------------------------- */

export interface LPDetails {
  poolAddress: string;
  token1: { symbol: string; amount: number; usdValue: number };
  token2: { symbol: string; amount: number; usdValue: number };
  priceRange: { min: number; max: number };
  totalUsdValue: number;
}

export interface WalletBalance {
  token_symbol: string;
  token_name: string;
  balance: number;
  usd_value: number;
  token_address?: string;
  is_lp_token: boolean;
  platform: string;
  lp_details?: LPDetails;
}

export interface WalletData {
  wallet_id: string;
  name: string;
  address: string;
  blockchain: string;
  balances: WalletBalance[];
  totalUsdValue: number;
}

/* ------------------------------------------------------------------------- */
/*                                 The hook                                  */
/* ------------------------------------------------------------------------- */

export function useWallets() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        /* -------- 1️⃣  Pull raw balances for every wallet in parallel ---- */
        const raw = await Promise.all(
          MONITORED_WALLETS.map(async (w) => {
            const [sol, tokens] = await Promise.all([
              fetchSol(w.address),
              fetchSplTokens(w.address),
            ]);
            return { cfg: w, sol, tokens };
          }),
        );
        if (cancelled) return;

        /* -------- 2️⃣  Fetch prices once for ALL unique mints ------------ */
        const mints = new Set<string>([SOL_MINT]);
        raw.forEach(({ tokens }) =>
          tokens.forEach((t) => mints.add(t.tokenAddress)),
        );
        const prices = await fetchJupiterPrices([...mints]);
        if (cancelled) return;

        /* -------- 3️⃣  Map into *WalletCard-compatible* objects ---------- */
        const mapped: WalletData[] = raw.map(({ cfg, sol, tokens }) => {
          /* SOL row */
          const solBal = sol.lamports / 1e9;
          const solUsd = solBal * (prices[SOL_MINT]?.price ?? 0);

          const balances: WalletBalance[] = [
            {
              token_symbol: "SOL",
              token_name: "Solana",
              balance: solBal,
              usd_value: solUsd,
              token_address: SOL_MINT,
              is_lp_token: false,
              platform: "native",
            },
            /* SPL tokens */
            ...tokens.map<WalletBalance>((t) => {
              const p = prices[t.tokenAddress]?.price ?? 0;
              return {
                token_symbol: t.tokenSymbol ?? t.tokenName ?? t.tokenAddress,
                token_name: t.tokenName ?? t.tokenSymbol ?? t.tokenAddress,
                balance: t.tokenAmount.uiAmount,
                usd_value: t.tokenAmount.uiAmount * p,
                token_address: t.tokenAddress,
                is_lp_token: false,            // 🔸 call your LP-detection here
                platform: "spl",
              };
            }),
          ];

          const total = balances.reduce((sum, b) => sum + b.usd_value, 0);

          return {
            wallet_id: cfg.address,
            name: cfg.name,
            address: cfg.address,
            blockchain: "Solana",
            balances,
            totalUsdValue: total,
          };
        });

        setWallets(mapped);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { wallets, loading, error };
}

