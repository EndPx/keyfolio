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
import { ACCESS_CONTRACT } from '../testnet';

interface WalletCtx {
  selector: WalletSelector | null;
  accountId: string | null;
  connecting: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<WalletCtx>({
  selector: null,
  accountId: null,
  connecting: true,
  signIn: () => {},
  signOut: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<{ show: () => void } | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const sel = await setupWalletSelector({
        network: 'testnet',
        modules: [setupMyNearWallet()],
      });
      const m = setupModal(sel, { contractId: ACCESS_CONTRACT });
      if (disposed) return;
      setSelector(sel);
      setModal(m);
      const apply = (s: { accounts: AccountState[] }) => {
        const active = s.accounts.find((a: AccountState) => a.active);
        setAccountId(active?.accountId ?? null);
      };
      apply(sel.store.getState());
      sel.store.observable.subscribe(apply);
      setConnecting(false);
    })().catch(() => {
      if (!disposed) setConnecting(false);
    });
    return () => {
      disposed = true;
    };
  }, []);

  const signIn = useCallback(() => {
    modal?.show();
  }, [modal]);

  const signOut = useCallback(async () => {
    const wallet = await selector?.wallet();
    await wallet?.signOut();
    setAccountId(null);
  }, [selector]);

  const value = useMemo(
    () => ({ selector, accountId, connecting, signIn, signOut }),
    [selector, accountId, connecting, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  return useContext(Ctx);
}
