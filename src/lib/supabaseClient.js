import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Browser-side Supabase client. Safe to import into any component —
 * uses the public anon key, and Row Level Security on every table
 * (see supabase/schema.sql) makes sure a user can only ever see or
 * touch their own wallet, transactions, and beneficiaries.
 */
export const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
