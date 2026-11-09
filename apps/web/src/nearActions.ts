// Shared NEAR Wallet Selector action builders (KF-08b). One small module used
// by purchase (Checkout) and withdraw (Studio). Returns the ACTUAL
// `transactions.functionCall` Action instances from the same `near-api-js`
// dependency the selector types expect — no `as never` cast, so a real
// shape/type mismatch fails the build instead of being silently coerced.

import { transactions } from 'near-api-js';

/** The exact Action type the Wallet Selector `actions: Array<Action>` expects. */
export type NearAction = ReturnType<typeof transactions.functionCall>;

export const YOCTO_PER_NEAR = 10n ** 24n;

/** 250 Tgas covers ft_transfer_call -> contract ft_on_transfer + callbacks. */
export const GAS_FT_TRANSFER_CALL = 250n * 10n ** 12n;
/** 250 Tgas covers ft_withdraw -> contract reservation + payout callback. */
export const GAS_FT_WITHDRAW = 250n * 10n ** 12n;

export interface PurchaseCallArgs {
  /** The ACCESS contract (receiver of the FT transfer). */
  accessContract: string;
  /** Canonical atomic price string (exact; rejected on the chain otherwise). */
  amountAtomic: string;
  /** Serialized `{ action: 'purchase', trader_id, plan_version, purchase_id }`. */
  msg: string;
}

/**
 * NEP-141 ft_transfer_call for a purchase. Requires exactly 1 yoctoNEAR
 * attached (standard `assert_one_yocto`); the FT is the receiver here, not
 * ACCESS. The `msg` is parsed by the contract as `PurchaseAction`.
 */
export function buildPurchaseActions(args: PurchaseCallArgs): NearAction[] {
  return [
    transactions.functionCall(
      'ft_transfer_call',
      {
        receiver_id: args.accessContract,
        amount: args.amountAtomic,
        memo: 'keyfolio access purchase',
        msg: args.msg,
      },
      GAS_FT_TRANSFER_CALL,
      1n,
    ),
  ];
}

/**
 * ACCESS ft_withdraw (seller console). Contract enforces exactly 1 yoctoNEAR
 * attached (ONE_YOCTO). `amount: null` withdraws the full vested claimable.
 */
export function buildWithdrawActions(): NearAction[] {
  return [transactions.functionCall('ft_withdraw', { amount: null }, GAS_FT_WITHDRAW, 1n)];
}

/** Serialize a purchase message to the exact contract `action` tag shape. */
export function purchaseMessage(args: {
  traderId: string;
  planVersion: number;
  purchaseId: string;
}): string {
  return JSON.stringify({
    action: 'purchase',
    trader_id: args.traderId,
    plan_version: args.planVersion,
    purchase_id: args.purchaseId,
  });
}