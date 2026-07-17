import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Client } from '@miapp/shared-types';
import { formatError } from 'app/modules/admin/clients/clients-error.util';
import { CreateClientDto, UpdateClientDto } from 'app/modules/admin/clients/clients.service';
import { ClientsStore } from 'app/modules/admin/clients/clients.store';

/**
 * Reactive form used for both create and edit, hosted inside the parent
 * drawer (`ClientsComponent`, Step 10). This component owns no routing and
 * no drawer-open/close logic — it only reacts to `mode`/`clientId` inputs
 * and emits `saved` / `cancelled` for the parent to react to.
 */
@Component({
    selector: 'app-clients-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
    ],
    templateUrl: './clients-form.component.html',
})
export class ClientsFormComponent
{
    private readonly _fb = inject(FormBuilder);
    private readonly _snackBar = inject(MatSnackBar);

    readonly store = inject(ClientsStore);

    readonly mode = input<'create' | 'edit'>('create');
    readonly clientId = input<number | null>(null);

    /**
     * Emits the created/updated `Client` on successful save. Parent closes
     * the drawer and shows the success snack (`Client created` /
     * `Client updated`, Step 10/11) — this component does not know which
     * snack text applies since that depends on `mode()` from the parent's
     * perspective too, but showing it here would duplicate the "success"
     * concern the parent already owns for the drawer lifecycle. Errors,
     * however, are shown inline (see `submit()`) mirroring how
     * `clients-list` handles its own delete-flow snacks (Step 8) — kept
     * consistent rather than routed through an output.
     */
    readonly saved = output<Client>();

    /**
     * Emits when the user cancels, and also when a deep-linked edit target
     * turns out not to exist after the store finished loading (spec Risks
     * table: "Deep-link to /admin/clients/:id before store loaded"). The
     * parent reacts identically in both cases: close the drawer.
     */
    readonly cancelled = output<void>();

    readonly form = this._fb.nonNullable.group({
        name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
        nro_doc: ['', [Validators.required, Validators.maxLength(40)]],
        address: ['', [Validators.required, Validators.maxLength(200)]],
        ubication: ['', [Validators.required, Validators.maxLength(200)]],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
        web: ['', [Validators.pattern(/^https?:\/\/.+/), Validators.maxLength(200)]],
    });

    constructor()
    {
        // Edit-mode prefill (spec lines 179, Risks table). Only acts while
        // `mode()` is 'edit' and `clientId()` is set. Waits for
        // `store.loading()` to settle to `false` before deciding the client
        // is missing, since a deep-link to `/admin/clients/:id` can render
        // this form before `ClientsComponent`'s initial `store.load()`
        // resolves. In the current wiring (Step 10 calls `store.load()`
        // synchronously in the parent constructor, which flips `loading`
        // to `true` before this child is created) the first run of this
        // effect observes `loading() === true` and returns early, then
        // re-runs once loading flips back to `false` with the list
        // populated — avoiding a false "not found".
        effect(() =>
        {
            if (this.mode() !== 'edit')
            {
                return;
            }

            const id = this.clientId();
            if (id === null)
            {
                return;
            }

            if (this.store.loading())
            {
                return;
            }

            const client = this.store.byId(id)();
            if (client)
            {
                this.form.patchValue({
                    name: client.name,
                    nro_doc: client.nro_doc,
                    address: client.address,
                    ubication: client.ubication,
                    email: client.email,
                    web: client.web ?? '',
                });
                return;
            }

            // Not found after the store settled — close the drawer via the
            // same output used for explicit cancellation, and warn the user.
            this._snackBar.open('Client not found', 'Close', { duration: 3000 });
            this.cancelled.emit();
        });
    }

    async submit(): Promise<void>
    {
        if (this.form.invalid || this.store.saving())
        {
            return;
        }

        const raw = this.form.getRawValue();

        // `ClientsService` already normalizes `web: ''` -> `null` before the
        // HTTP call, but normalizing here too is cheap belt-and-suspenders:
        // it keeps the payload shape correct for any future caller that
        // bypasses the service, and matches the spec's explicit callout
        // ("empty `web` string is transformed to `null` before send").
        const payload = {
            ...raw,
            web: raw.web === '' ? null : raw.web,
        };

        try
        {
            const client = this.mode() === 'edit' && this.clientId() !== null
                ? await this.store.update(this.clientId() as number, payload as UpdateClientDto)
                : await this.store.create(payload as CreateClientDto);
            this.saved.emit(client);
        }
        catch (err)
        {
            this._snackBar.open(formatError(err as HttpErrorResponse), 'Close', { duration: 3000 });
        }
    }

    cancel(): void
    {
        this.cancelled.emit();
    }
}
