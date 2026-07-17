import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Client } from '@miapp/shared-types';
import { FuseAlertComponent } from '@fuse/components/alert';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { formatError } from 'app/modules/admin/clients/clients-error.util';
import { ClientsStore } from 'app/modules/admin/clients/clients.store';

/**
 * List + search table for clients. Row actions (edit/create) are emitted up
 * to the parent `ClientsComponent`, which owns the drawer that hosts
 * `clients-form` (Step 10). Delete is handled inline here since the
 * confirmation dialog is a transient UI concern tied directly to the
 * delete trigger (spec decisions section).
 */
@Component({
    selector: 'app-clients-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSortModule,
        MatTableModule,
        FuseAlertComponent,
        FuseLoadingBarComponent,
    ],
    templateUrl: './clients-list.component.html',
})
export class ClientsListComponent
{
    private readonly _confirmationService = inject(FuseConfirmationService);
    private readonly _snackBar = inject(MatSnackBar);

    readonly store = inject(ClientsStore);

    /**
     * Single output covering both "open create form" and "open edit form for
     * this client" — the parent decides drawer mode from the emitted value
     * (`'create'` vs a `Client`). Chosen over two separate outputs
     * (`createRequested` / `edit`) to keep the drawer-opening call site in
     * the parent as one branch instead of two listener bindings.
     */
    readonly action = output<'create' | Client>();

    readonly displayedColumns = ['name', 'nro_doc', 'email', 'ubication', 'status', 'actions'];

    // Bound to the search text input via a manual (input) handler rather than
    // `model()`: there is no need for two-way binding out to a parent, this
    // signal is purely local UI state feeding the `visibleClients` computed.
    readonly search = signal('');

    /**
     * Client-side filter, per spec lines 130-140. Pure computed over the
     * store's `clients()` signal — no HTTP call is triggered by typing.
     */
    readonly visibleClients = computed(() =>
    {
        const q = this.search().trim().toLowerCase();
        const list = this.store.clients();
        if (!q)
        {
            return list;
        }
        return list.filter(c =>
            c.name.toLowerCase().includes(q)
            || c.nro_doc.toLowerCase().includes(q)
            || c.email.toLowerCase().includes(q),
        );
    });

    readonly dataSource = new MatTableDataSource<Client>([]);

    readonly sort = viewChild(MatSort);

    constructor()
    {
        // View-sync side effects only (not data fetching): keep the Material
        // table's data source aligned with the filtered signal, and wire the
        // MatSort instance once the view is ready. `MatTableDataSource` is an
        // imperative Fuse/Material API with no signal-based equivalent yet,
        // hence the effect bridge here instead of a template binding.
        effect(() =>
        {
            this.dataSource.data = [...this.visibleClients()];
        });

        effect(() =>
        {
            const sort = this.sort();
            if (sort)
            {
                this.dataSource.sort = sort;
            }
        });
    }

    onSearchInput(value: string): void
    {
        this.search.set(value);
    }

    createClient(): void
    {
        this.action.emit('create');
    }

    editClient(client: Client): void
    {
        this.action.emit(client);
    }

    deleteClient(client: Client): void
    {
        const dialogRef = this._confirmationService.open({
            title: 'Delete client',
            message: `Are you sure you want to delete "${client.name}"? This action cannot be undone.`,
            actions: {
                confirm: {
                    show: true,
                    label: 'Delete',
                    color: 'warn',
                },
                cancel: {
                    show: true,
                    label: 'Cancel',
                },
            },
        });

        dialogRef.afterClosed().subscribe(async (result) =>
        {
            if (result !== 'confirmed')
            {
                return;
            }

            try
            {
                await this.store.remove(client.id);
                this._snackBar.open('Client deleted', 'Close', { duration: 3000 });
            }
            catch (err)
            {
                this._snackBar.open(formatError(err as HttpErrorResponse), 'Close', { duration: 3000 });
            }
        });
    }

    retry(): void
    {
        this.store.load();
    }
}
