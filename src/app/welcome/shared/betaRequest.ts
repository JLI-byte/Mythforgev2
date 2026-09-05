import { createClient } from '@/lib/supabase/client';

export interface BetaRequestFields {
    name: string;
    email: string;
    reason: string;
}

export type BetaRequestResult = 'done' | 'duplicate' | 'throttled' | 'error';

/**
 * Inserts a beta access request into public.beta_requests.
 * 23505 (unique_violation) means this email already requested access.
 * PT429 is raised by the beta_requests_throttle trigger. PostgREST maps a
 * PTnnn SQLSTATE onto the HTTP status, so a throttled insert really does come
 * back as a 429 rather than a generic failure.
 */
export async function submitBetaRequest(
    fields: BetaRequestFields,
): Promise<BetaRequestResult> {
    const supabase = createClient();
    const { error } = await supabase.from('beta_requests').insert({
        email: fields.email.trim().toLowerCase(),
        name: fields.name.trim() || null,
        reason: fields.reason.trim() || null,
    });
    if (!error) return 'done';
    if (error.code === '23505') return 'duplicate';
    if (error.code === 'PT429') return 'throttled';
    return 'error';
}
