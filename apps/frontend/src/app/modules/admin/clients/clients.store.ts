import { Injectable, computed, inject, signal } from '@angular/core';
import { Client } from '@miapp/shared-types';
import { ClientsService, CreateClientDto, UpdateClientDto } from 'app/modules/admin/clients/clients.service';

/**
 * Client list/CRUD state. Exposes only readonly signals; all mutation goes
 * through the methods below (load/create/update/remove).
 *
 * Error handling nuance: `load()` writes failures into `#error` (drives the
 * list-level error state / retry UI). `create`/`update`/`remove` do NOT
 * write into `#error` — they propagate the thrown error to the caller so
 * the component can surface it via snack-bar (`formatError`, Step 11).
 */
@Injectable({ providedIn: 'root' })
export class ClientsStore
{
    private readonly _clientsService = inject(ClientsService);

    private readonly _clients = signal<ReadonlyArray<Client>>([]);
    private readonly _loading = signal(false);
    private readonly _saving = signal(false);
    private readonly _error = signal<Error | null>(null);

    readonly clients = this._clients.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly saving = this._saving.asReadonly();
    readonly error = this._error.asReadonly();
    readonly byId = (id: number) => computed(() => this._clients().find(c => c.id === id));

    /**
     * Loads the full client list. Failures are captured in `#error` for the
     * list view's error/retry UI.
     */
    async load(): Promise<void>
    {
        this._loading.set(true);
        this._error.set(null);
        try
        {
            const list = await this._clientsService.list();
            this._clients.set(list);
        }
        catch (e)
        {
            this._error.set(e as Error);
        }
        finally
        {
            this._loading.set(false);
        }
    }

    /**
     * Creates a client. On success, appends it to `#clients` and returns it.
     * On failure, rethrows so the caller can display a snack-bar.
     */
    async create(dto: CreateClientDto): Promise<Client>
    {
        this._saving.set(true);
        try
        {
            const created = await this._clientsService.create(dto);
            this._clients.set([...this._clients(), created]);
            return created;
        }
        finally
        {
            this._saving.set(false);
        }
    }

    /**
     * Updates a client. On success, replaces the matching item in `#clients`
     * (immutable replace, new array reference). On failure, rethrows so the
     * caller can display a snack-bar.
     */
    async update(id: number, dto: UpdateClientDto): Promise<Client>
    {
        this._saving.set(true);
        try
        {
            const updated = await this._clientsService.update(id, dto);
            this._clients.set(this._clients().map(c => (c.id === id ? updated : c)));
            return updated;
        }
        finally
        {
            this._saving.set(false);
        }
    }

    /**
     * Removes a client. On success, drops it from `#clients`. On failure,
     * rethrows so the caller can display a snack-bar.
     */
    async remove(id: number): Promise<void>
    {
        this._saving.set(true);
        try
        {
            await this._clientsService.remove(id);
            this._clients.set(this._clients().filter(c => c.id !== id));
        }
        finally
        {
            this._saving.set(false);
        }
    }
}
