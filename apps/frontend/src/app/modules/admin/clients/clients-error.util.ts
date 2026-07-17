import { HttpErrorResponse } from '@angular/common/http';

/**
 * Maps backend HTTP errors to a human-readable snack message (spec Step 11,
 * acceptance criteria lines 212-214). Shared between `clients-list` (delete
 * failures) and `clients-form` (create/update failures) so both call sites
 * present the same wording for the same backend error shape.
 */
export function formatError(err: HttpErrorResponse): string
{
    if (err.status === 409)
    {
        const message = String(err.error?.message ?? '');
        if (message.includes('nro_doc'))
        {
            return 'Duplicate nro_doc';
        }
        if (message.includes('email'))
        {
            return 'Duplicate email';
        }

        // Fallback per spec Risks table (line 264): field name couldn't be
        // parsed from the backend message — return a generic message and log
        // the raw payload for debugging instead of guessing.
        console.error('formatError: unrecognized 409 message shape', err.error);
        return 'Duplicate value';
    }

    if (err.status === 400)
    {
        const message = err.error?.message;
        if (Array.isArray(message))
        {
            // class-validator typically returns an array of per-field
            // validation strings — join into one readable summary.
            return message.join(', ');
        }
        if (typeof message === 'string' && message.length > 0)
        {
            return message;
        }
    }

    return 'Unexpected error, try again';
}
