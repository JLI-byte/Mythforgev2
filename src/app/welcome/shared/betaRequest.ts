import { createClient } from '@/lib/supabase/client';

export interface BetaRequestFields {
    name: string;
    email: string;
    reason: string;
}

export type BetaRequestResult = 'done' | 'duplicate' | 'error';

/**
 * Inserts a beta access request into public.beta_requests.
 * 23505 (unique_violation) means this email already requested access.
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
    return error.code === '23505' ? 'duplicate' : 'error';
}
