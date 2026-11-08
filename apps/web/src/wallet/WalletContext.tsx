'use client';

/**
 * TESTNET wallet context (KF-08b.2): NEAR Wallet Selector standard
 * (MyNearWallet). User-controlled signing only — this code never holds or
 * sees keys. Used by Checkout (purchase), My Keys (license view) and Trader
 * Studio (withdrawal) in TESTNET mode.
 */

import {
  setupWalletSelector,
  type WalletSelector,
  type AccountState,
} from '@near-wallet-selector/core';
import { setupModal } from '@near-wallet-selector/modal-ui';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import '@near-wallet-selector/modal-ui/styles.css';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface WalletCtx {
  enabled: boolean;
  selector: WalletSelector | null;
  accountId: string | null;
  connecting: boolean;
  initError: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<WalletCtx>({
  enabled: false,
  selector: null,
  accountId: null,
  connecting: false,
  initError: null,
  signIn: () => {},
  signOut: async () => {},
});

/** enabled=false keeps the selector un-mounted in FIXTURE/LIVE modes. */
export function WalletProvider({ children, enabled = false }: { children: ReactNode; enabled?: boolean }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<{ show: () => void } | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(enabled);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let subscription: { unsubscribe: () => void } | null = null;
    (async () => {
      const sel = await setupWalletSelector({
        network: 'testnet',
        modules: [setupMyNearWallet()],
      });
      const m = setupModal(sel, { contractId: process.env.NEXT_PUBLIC_ACCESS_CONTRACT_ID ?? 'keyfolio-access.testnet' });
      if (disposed) return;
      setSelector(sel);
      setModal(m);
      const apply = (s: { accounts: AccountState[] }) => {
        const active = s.accounts.find((a: AccountState) => a.active);
        setAccountId(active?.accountId ?? null);
      };
      apply(sel.store.getState());
      subscription = sel.store.observable.subscribe(apply);
      setConnecting(false);
    })().catch((err) => {
      if (!disposed) {
        setInitError(String((err as Error).message ?? err).slice(0, 200));
        setConnecting(false);
      }
    });
    return () => {
      disposed = true;
      subscription?.unsubscribe();
    };
  }, [enabled]);

  const signIn = useCallback(() => {
    modal?.show();
  }, [modal]);

  const signOut = useCallback(async () => {
    const wallet = await selector?.wallet();
    await wallet?.signOut();
    setAccountId(null);
  }, [selector]);

  const value = useMemo(
    () => ({ enabled, selector, accountId, connecting, initError, signIn, signOut }),
    [enabled, selector, accountId, connecting, initError, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  return useContext(Ctx);
}
