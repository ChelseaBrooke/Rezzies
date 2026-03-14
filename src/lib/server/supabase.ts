import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only Supabase client with service role (full access). Use for Storage uploads/deletes.
 * Ensure the "uploads" bucket is set to Public in Supabase Dashboard (Storage → uploads → Public)
 * so image/file URLs work in the app.
 */
export const supabaseAdmin =
	url && serviceRoleKey
		? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
		: null;

export const UPLOAD_BUCKET = 'uploads';
