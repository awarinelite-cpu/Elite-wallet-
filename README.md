# Elite Wallet

A SvelteKit + Supabase sandbox build of a personal real-money wallet and
everyday payment hub: fund/withdraw, bank & wallet transfers, airtime,
data, bills, a spend tracker, and a full transaction ledger with receipts.

**This build uses mock money.** Every wallet action runs through a Postgres
function that updates a balance in your own Supabase project — no real bank,
card, or telco is involved. See "Going to real money" below for what
changes when you're ready to connect one.

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and open
**SQL Editor**. Paste in the entire contents of `supabase/schema.sql` and
run it. This creates:

- `wallets`, `transactions`, `beneficiaries`, `spend_records` tables
- Row Level Security so each user can only ever see their own data
- A trigger that gives every new signup a ₦0 wallet automatically
- The RPC functions the app calls for every money-moving action
  (`fund_wallet`, `withdraw_wallet`, `transfer_to_bank`,
  `transfer_to_wallet`, `pay_airtime`, `pay_data`, `pay_bill`)

Then go to **Authentication → Providers** and make sure **Email** is
enabled (it is by default). If you want to skip email confirmation while
testing, turn off "Confirm email" under **Authentication → Settings**.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from
**Project Settings → API** in your Supabase dashboard.

## 3. Install and run

```bash
npm install
npm run dev
```

Open the printed local URL, create an account, and you'll land on a wallet
with a ₦0 balance. Use **Wallet → Fund Wallet** to add mock money, then try
transfers, airtime, data, and bills.

## Project structure

```
src/
  lib/
    supabaseClient.js     Browser Supabase client
    walletActions.js      Thin wrappers around the wallet RPCs
    format.js              Currency/date/status formatting helpers
    components/            BottomNav, TransactionRow, PinConfirm
  routes/
    +layout.svelte          App shell, bottom nav, session gate
    +page.svelte             Home
    wallet/                  Fund, withdraw, statement
    transfer/                Bank transfer, wallet transfer, beneficiaries, receipt
    airtime/                 MTN / Airtel / Glo / 9mobile airtime
    data/                    Data bundles
    bills/                   Electricity, cable, internet, other
    spend/                   Personal expense tracker
    transactions/            Ledger list + [id] receipt view
    login/, signup/          Auth
supabase/
  schema.sql                 Tables, RLS, triggers, wallet RPC functions
```

## Going to real money

The client code never writes a balance or inserts a transaction directly —
it always calls a Postgres RPC (see `src/lib/walletActions.js`). That's the
seam. To connect real money:

1. **Wallet balances & KYC** — partner with a Nigerian BaaS/PSP provider
   (e.g. Anchor, Bloc, Mono, Nomba) for BVN/NIN verification and a
   dedicated virtual account per user. Update `fund_wallet` and
   `withdraw_wallet` to call their API and reconcile via webhook instead
   of just incrementing `balance` directly.
2. **Bank transfers** — same provider, or Paystack/Flutterwave Transfers.
   Update `transfer_to_bank` the same way.
3. **Airtime, data, bills** — a VTU aggregator (VTpass, Baxi, Flutterwave
   Bills). Update `pay_airtime`, `pay_data`, `pay_bill` to call their API
   and only mark the transaction `successful` once the provider confirms.
4. Transactions should move from being written as `successful` immediately
   to being inserted as `pending`, with a webhook handler (a Supabase Edge
   Function) flipping them to `successful`/`failed` when the provider
   responds.

Nothing in the Svelte routes or components needs to change for this —
they already render `pending` / `failed` / `reversed` states.
