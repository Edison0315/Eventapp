import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Client } from '@miapp/shared-types';
import { ClientsFormComponent } from 'app/modules/admin/clients/clients-form/clients-form.component';
import { ClientsListComponent } from 'app/modules/admin/clients/clients-list/clients-list.component';
import { ClientsStore } from 'app/modules/admin/clients/clients.store';

/**
 * List page container (Step 10). Owns the `MatDrawerContainer` that hosts
 * `clients-list` in the main pane and `clients-form` in the side drawer —
 * per spec Decisions (lines 230-232), this is a classic Fuse list + drawer
 * layout driven entirely by component events/signals, NOT by child routes.
 * `clients.routes.ts` mounts this component alone at the feature root; there
 * is no `new` / `:id` router-outlet wiring (fixed alongside this step, see
 * that file's comment for the reconciliation rationale).
 */
@Component({
    selector: 'app-clients',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatSidenavModule,
        ClientsListComponent,
        ClientsFormComponent,
    ],
    templateUrl: './clients.component.html',
})
export class ClientsComponent
{
    private readonly _snackBar = inject(MatSnackBar);

    readonly store = inject(ClientsStore);

    readonly drawer = viewChild.required(MatDrawer);

    // Drawer state — which client (if any) is being edited, or 'create' mode
    // with no target. Driven by `clients-list`'s `action` output.
    readonly mode = signal<'create' | 'edit'>('create');
    readonly clientId = signal<number | null>(null);

    constructor()
    {
        // Initial load, guarded per spec line 189/200: only fetch if the
        // store is empty, so navigating back to this route does not refetch
        // an already-populated cache. This also satisfies `clients-form`'s
        // Step 9 effect, which assumes `load()` has already been kicked off
        // (and `loading()` flipped to `true`) by the time it mounts.
        if (this.store.clients().length === 0)
        {
            this.store.load();
        }
    }

    /**
     * Handles `clients-list`'s combined `action` output: `'create'` opens an
     * empty form, a `Client` opens the form pre-filled for that row.
     */
    onAction(action: 'create' | Client): void
    {
        if (action === 'create')
        {
            this.mode.set('create');
            this.clientId.set(null);
        }
        else
        {
            this.mode.set('edit');
            this.clientId.set(action.id);
        }

        this.drawer().open();
    }

    /**
     * `clients-form` already resolved success against the store (Step 9);
     * this only owns the drawer lifecycle + the create-vs-update snack text,
     * per Step 10 (full 400/409 parsing remains Step 11).
     */
    onSaved(): void
    {
        this._snackBar.open(
            this.mode() === 'edit' ? 'Client updated' : 'Client created',
            'Close',
            { duration: 3000 },
        );
        this.drawer().close();
    }

    onCancelled(): void
    {
        this.drawer().close();
    }
}
