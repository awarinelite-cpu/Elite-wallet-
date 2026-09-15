-- ============================================================================
-- Elite Wallet — Supabase schema (sandbox / mock-money build)
--
-- Run this whole file once in Supabase SQL Editor (or `supabase db push`
-- against a migration built from it) on a fresh project.
--
-- Design:
--   - Every wallet-affecting action is a SECURITY DEFINER RPC function
--     (fund_wallet, withdraw_wallet, transfer_to_bank, transfer_to_wallet,
--     pay_airtime, pay_data, pay_bill). The client never writes balances
--     or transaction rows directly — it calls these functions, which
--     update the wallet and insert the ledger row atomically.
--   - This means swapping the mock money engine for a real BaaS/VTU
--     provider later is a change to the SQL function bodies (call the
--     provider's API, then record the result) — the client code and
--     RLS model don't need to change.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.wallets (
	user_id uuid primary key references auth.users (id) on delete cascade,
	balance numeric(14, 2) not null default 0 check (balance >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	type text not null check (
		type in (
			'fund', 'withdraw', 'transfer_bank', 'transfer_wallet',
			'airtime', 'data', 'bill_electricity', 'bill_cable',
			'bill_internet', 'bill_other'
		)
	),
	amount numeric(14, 2) not null check (amount > 0),
	fee numeric(14, 2) not null default 0 check (fee >= 0),
	status text not null default 'successful' check (
		status in ('pending', 'successful', 'failed', 'reversed')
	),
	reference text not null unique,
	description text,
	counterparty text, -- recipient / provider shown on the receipt
	created_at timestamptz not null default now()
);

create index if not exists transactions_user_created_idx
	on public.transactions (user_id, created_at desc);

create table if not exists public.beneficiaries (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	type text not null default 'bank' check (type in ('bank', 'wallet')),
	bank_name text,
	bank_code text,
	account_number text,
	account_name text,
	wallet_tag text,
	created_at timestamptz not null default now()
);

alter table public.beneficiaries add column if not exists bank_code text;

create table if not exists public.spend_records (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	category text not null,
	amount numeric(14, 2) not null check (amount > 0),
	note text,
	created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.spend_records enable row level security;

-- Wallets: users may only ever read their own balance. Writes happen
-- exclusively through the SECURITY DEFINER functions below.
drop policy if exists "Users can view their own wallet" on public.wallets;
create policy "Users can view their own wallet"
	on public.wallets for select
	using (auth.uid() = user_id);

-- Transactions: read-only for the owner. All inserts go through RPCs.
drop policy if exists "Users can view their own transactions" on public.transactions;
create policy "Users can view their own transactions"
	on public.transactions for select
	using (auth.uid() = user_id);

-- Beneficiaries: fully managed by the owner directly from the client.
drop policy if exists "Users can view their own beneficiaries" on public.beneficiaries;
create policy "Users can view their own beneficiaries"
	on public.beneficiaries for select
	using (auth.uid() = user_id);
drop policy if exists "Users can add their own beneficiaries" on public.beneficiaries;
create policy "Users can add their own beneficiaries"
	on public.beneficiaries for insert
	with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own beneficiaries" on public.beneficiaries;
create policy "Users can delete their own beneficiaries"
	on public.beneficiaries for delete
	using (auth.uid() = user_id);

-- Spend records: fully managed by the owner directly from the client.
drop policy if exists "Users can view their own spend records" on public.spend_records;
create policy "Users can view their own spend records"
	on public.spend_records for select
	using (auth.uid() = user_id);
drop policy if exists "Users can add their own spend records" on public.spend_records;
create policy "Users can add their own spend records"
	on public.spend_records for insert
	with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own spend records" on public.spend_records;
create policy "Users can delete their own spend records"
	on public.spend_records for delete
	using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- New user setup — every signup gets a zero-balance wallet automatically
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.wallets (user_id, balance) values (new.id, 0);
	return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

-- Backfill: any auth.users row created before this trigger existed (or from
-- a run of this file that predates it) has no matching public.wallets row.
-- Every wallet RPC above does `where user_id = v_user`, which silently
-- matches zero rows for a user like that instead of erroring — so funding
-- looked "successful" (the transaction row still got inserted) while the
-- balance never moved. Safe to re-run: only inserts rows that don't exist.
insert into public.wallets (user_id, balance)
select u.id, 0
from auth.users u
left join public.wallets w on w.user_id = u.id
where w.user_id is null;

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

create or replace function public.generate_reference()
returns text
language sql
as $$
	select 'EW' || to_char(now(), 'YYMMDDHH24MISS') ||
		upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

-- ----------------------------------------------------------------------------
-- Wallet RPCs
-- Each one: (1) confirms the caller, (2) validates the amount/balance,
-- (3) updates public.wallets, (4) inserts the matching ledger row —
-- all inside one transaction, so balance and ledger can never drift apart.
-- ----------------------------------------------------------------------------

create or replace function public.fund_wallet(p_amount numeric)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;

	update public.wallets
		set balance = balance + p_amount, updated_at = now()
		where user_id = v_user;

	if not found then
		raise exception 'Wallet not found for this user.';
	end if;

	insert into public.transactions (user_id, type, amount, status, reference, description)
	values (v_user, 'fund', p_amount, 'successful', public.generate_reference(), 'Wallet Funding')
	returning * into v_tx;

	return v_tx;
end;
$$;

-- ----------------------------------------------------------------------------
-- Paystack funding
-- provider_reference ties a wallet credit to a specific Paystack
-- transaction. The unique constraint is what makes crediting idempotent —
-- if the same reference is verified twice (user refresh, retry, etc.),
-- the second attempt cannot create a second credit.
-- ----------------------------------------------------------------------------

alter table public.transactions
	add column if not exists provider_reference text unique;

create or replace function public.fund_wallet_paystack(p_amount numeric, p_provider_reference text)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;
	if p_provider_reference is null or length(trim(p_provider_reference)) = 0 then
		raise exception 'Missing provider reference';
	end if;

	begin
		update public.wallets
			set balance = balance + p_amount, updated_at = now()
			where user_id = v_user;

		if not found then
			raise exception 'Wallet not found for this user.';
		end if;

		insert into public.transactions
			(user_id, type, amount, status, reference, provider_reference, description)
		values (
			v_user, 'fund', p_amount, 'successful', public.generate_reference(),
			p_provider_reference, 'Wallet Funding · Paystack'
		)
		returning * into v_tx;

		return v_tx;
	exception when unique_violation then
		-- Already credited for this reference — return the original
		-- transaction instead of crediting a second time.
		select * into v_tx from public.transactions where provider_reference = p_provider_reference;
		return v_tx;
	end;
end;
$$;

create or replace function public.withdraw_wallet(p_amount numeric, p_description text default null)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_balance numeric;
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;

	select balance into v_balance from public.wallets where user_id = v_user for update;
	if not found then
		raise exception 'Wallet not found for this user.';
	end if;
	if v_balance < p_amount then
		raise exception 'Insufficient wallet balance';
	end if;

	update public.wallets
		set balance = balance - p_amount, updated_at = now()
		where user_id = v_user;

	insert into public.transactions (user_id, type, amount, status, reference, description, counterparty)
	values (
		v_user, 'withdraw', p_amount, 'successful', public.generate_reference(),
		'Withdrawal to Bank', coalesce(p_description, 'Linked bank account')
	)
	returning * into v_tx;

	return v_tx;
end;
$$;

create or replace function public.transfer_to_bank(
	p_amount numeric,
	p_bank_name text,
	p_account_number text,
	p_account_name text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_balance numeric;
	v_fee numeric := 25.00;
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;

	select balance into v_balance from public.wallets where user_id = v_user for update;
	if not found then
		raise exception 'Wallet not found for this user.';
	end if;
	if v_balance < p_amount then
		raise exception 'Insufficient wallet balance';
	end if;

	update public.wallets
		set balance = balance - p_amount, updated_at = now()
		where user_id = v_user;

	insert into public.transactions (user_id, type, amount, fee, status, reference, description, counterparty)
	values (
		v_user, 'transfer_bank', p_amount, v_fee, 'successful', public.generate_reference(),
		'Transfer to ' || p_bank_name, p_account_name || ' · ' || p_bank_name || ' (••' || right(p_account_number, 4) || ')'
	)
	returning * into v_tx;

	return v_tx;
end;
$$;

create or replace function public.transfer_to_wallet(p_amount numeric, p_recipient_tag text)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_balance numeric;
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;
	if p_recipient_tag is null or length(trim(p_recipient_tag)) = 0 then
		raise exception 'Recipient is required';
	end if;

	select balance into v_balance from public.wallets where user_id = v_user for update;
	if not found then
		raise exception 'Wallet not found for this user.';
	end if;
	if v_balance < p_amount then
		raise exception 'Insufficient wallet balance';
	end if;

	update public.wallets
		set balance = balance - p_amount, updated_at = now()
		where user_id = v_user;

	-- Sandbox note: this build has no directory of other users' wallet
	-- tags, so it only records the debit side. In production this
	-- function would also resolve p_recipient_tag to a user_id and
	-- credit their wallet in the same transaction.
	insert into public.transactions (user_id, type, amount, status, reference, description, counterparty)
	values (
		v_user, 'transfer_wallet', p_amount, 'successful', public.generate_reference(),
		'Wallet Transfer', p_recipient_tag
	)
	returning * into v_tx;

	return v_tx;
end;
$$;

create or replace function public.pay_airtime(p_amount numeric, p_network text, p_phone text)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_balance numeric;
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;

	select balance into v_balance from public.wallets where user_id = v_user for update;
	if not found then
		raise exception 'Wallet not found for this user.';
	end if;
	if v_balance < p_amount then
		raise exception 'Insufficient wallet balance';
	end if;

	update public.wallets
		set balance = balance - p_amount, updated_at = now()
		where user_id = v_user;

	insert into public.transactions (user_id, type, amount, status, reference, description, counterparty)
	values (
		v_user, 'airtime', p_amount, 'successful', public.generate_reference(),
		p_network || ' Airtime', p_phone
	)
	returning * into v_tx;

	return v_tx;
end;
$$;

create or replace function public.pay_data(
	p_amount numeric,
	p_network text,
	p_phone text,
	p_bundle_label text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_balance numeric;
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;

	select balance into v_balance from public.wallets where user_id = v_user for update;
	if not found then
		raise exception 'Wallet not found for this user.';
	end if;
	if v_balance < p_amount then
		raise exception 'Insufficient wallet balance';
	end if;

	update public.wallets
		set balance = balance - p_amount, updated_at = now()
		where user_id = v_user;

	insert into public.transactions (user_id, type, amount, status, reference, description, counterparty)
	values (
		v_user, 'data', p_amount, 'successful', public.generate_reference(),
		p_network || ' Data — ' || p_bundle_label, p_phone
	)
	returning * into v_tx;

	return v_tx;
end;
$$;

create or replace function public.pay_bill(
	p_amount numeric,
	p_bill_type text,
	p_provider text,
	p_customer_ref text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_balance numeric;
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;
	if p_bill_type not in ('bill_electricity', 'bill_cable', 'bill_internet', 'bill_other') then
		raise exception 'Unknown bill type';
	end if;

	select balance into v_balance from public.wallets where user_id = v_user for update;
	if not found then
		raise exception 'Wallet not found for this user.';
	end if;
	if v_balance < p_amount then
		raise exception 'Insufficient wallet balance';
	end if;

	update public.wallets
		set balance = balance - p_amount, updated_at = now()
		where user_id = v_user;

	insert into public.transactions (user_id, type, amount, status, reference, description, counterparty)
	values (
		v_user, p_bill_type, p_amount, 'successful', public.generate_reference(),
		p_provider, p_customer_ref
	)
	returning * into v_tx;

	return v_tx;
end;
$$;

-- ----------------------------------------------------------------------------
-- Paystack payouts (bank withdrawals)
-- The debit happens immediately (status 'pending') so the balance can't be
-- double-spent while the transfer is in flight at Paystack. Resolution
-- (success/failure) comes back later — either synchronously in the same
-- request if Paystack rejects it immediately, or via resolve_transfer_webhook
-- once Paystack's webhook confirms the outcome.
-- ----------------------------------------------------------------------------

create or replace function public.debit_wallet_for_transfer(
	p_amount numeric,
	p_bank_name text,
	p_account_number text,
	p_account_name text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_balance numeric;
	v_fee numeric := 25.00;
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;
	if p_amount is null or p_amount <= 0 then
		raise exception 'Amount must be greater than zero';
	end if;

	select balance into v_balance from public.wallets where user_id = v_user for update;
	if not found then
		raise exception 'Wallet not found for this user.';
	end if;
	if v_balance < p_amount then
		raise exception 'Insufficient wallet balance';
	end if;

	update public.wallets
		set balance = balance - p_amount, updated_at = now()
		where user_id = v_user;

	insert into public.transactions (user_id, type, amount, fee, status, reference, description, counterparty)
	values (
		v_user, 'transfer_bank', p_amount, v_fee, 'pending', public.generate_reference(),
		'Transfer to ' || p_bank_name,
		p_account_name || ' · ' || p_bank_name || ' (••' || right(p_account_number, 4) || ')'
	)
	returning * into v_tx;

	return v_tx;
end;
$$;

-- Self-service reversal — used only synchronously, in the same request that
-- did the debit, when Paystack rejects the transfer outright (bad recipient,
-- etc). Scoped to auth.uid() = user_id, so it can only ever undo the
-- caller's own pending debit — safe to leave callable by any authenticated
-- user.
create or replace function public.reverse_wallet_debit(p_reference text)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;

	select * into v_tx from public.transactions
		where reference = p_reference and user_id = v_user and status = 'pending'
		for update;
	if not found then
		raise exception 'No matching pending transaction';
	end if;

	update public.transactions set status = 'failed' where id = v_tx.id returning * into v_tx;
	update public.wallets set balance = balance + v_tx.amount, updated_at = now() where user_id = v_user;

	return v_tx;
end;
$$;

-- Webhook resolver — deliberately does NOT check auth.uid(), because
-- Paystack's webhook call has no user session at all. That's exactly why
-- it must never be reachable by a normal user: the grants below restrict
-- it to the service_role, which only the webhook server route holds.
create or replace function public.resolve_transfer_webhook(p_reference text, p_status text)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_tx public.transactions;
begin
	select * into v_tx from public.transactions
		where reference = p_reference and type = 'transfer_bank'
		for update;
	if not found then
		raise exception 'Unknown transfer reference: %', p_reference;
	end if;

	-- Already resolved (duplicate webhook delivery) — no-op.
	if v_tx.status <> 'pending' then
		return v_tx;
	end if;

	if p_status = 'successful' then
		update public.transactions set status = 'successful' where id = v_tx.id returning * into v_tx;
	else
		update public.transactions set status = p_status where id = v_tx.id;
		update public.wallets
			set balance = balance + v_tx.amount, updated_at = now()
			where user_id = v_tx.user_id;
		select * into v_tx from public.transactions where id = v_tx.id;
	end if;

	return v_tx;
end;
$$;

revoke all on function public.resolve_transfer_webhook(text, text) from public;
revoke all on function public.resolve_transfer_webhook(text, text) from anon, authenticated;
grant execute on function public.resolve_transfer_webhook(text, text) to service_role;

-- Same-request success resolver — for the rare case Paystack returns a
-- final 'success' status immediately instead of async via webhook. Scoped
-- to auth.uid() = user_id like reverse_wallet_debit, so it's safe to grant
-- to authenticated users generally: it can only mark the caller's own
-- pending transfer as successful, never touch anyone else's.
create or replace function public.resolve_own_transfer_success(p_reference text)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user uuid := auth.uid();
	v_tx public.transactions;
begin
	if v_user is null then
		raise exception 'Not authenticated';
	end if;

	select * into v_tx from public.transactions
		where reference = p_reference and user_id = v_user and status = 'pending'
		for update;
	if not found then
		select * into v_tx from public.transactions where reference = p_reference and user_id = v_user;
		return v_tx; -- already resolved, e.g. webhook beat us to it
	end if;

	update public.transactions set status = 'successful' where id = v_tx.id returning * into v_tx;
	return v_tx;
end;
$$;
