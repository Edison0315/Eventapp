import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Client } from '@miapp/shared-types';
import { environment } from 'environments/environment';

/**
 * Backend response envelope (see apps/backend/src/common/interfaces/service-response.interface.ts).
 * Not exported from `@miapp/shared-types` — defined locally since it is a
 * backend HTTP-transport concern, not a shared domain entity.
 */
interface ServiceResponse<T>
{
    statusCode: number;
    message: string;
    data: T[];
    metaData?: Record<string, unknown>;
}

/**
 * Payload shapes mirror backend `CreateClientDto` / `UpdateClientDto`
 * (apps/backend/src/modules/clients/dto/*). Not reusable from shared-types
 * or the backend app (backend DTOs are decorated with class-validator and
 * live in a separate Nx project) — defined locally, no `id`/timestamps/`status`.
 */
export interface CreateClientDto
{
    name: string;
    nro_doc: string;
    address: string;
    ubication: string;
    email: string;
    web?: string | null;
}

export type UpdateClientDto = Partial<CreateClientDto>;

// Skeleton only (Step 3). HTTP methods (list/get/create/update/remove)
// wiring `${environment.apiUrl}/clients` are added in Step 6.
@Injectable({ providedIn: 'root' })
export class ClientsService
{
    private readonly _httpClient = inject(HttpClient);
    private readonly _baseUrl = `${environment.apiUrl}/clients`;

    /**
     * Strips empty `web` string to `null` before sending to backend.
     */
    private _preparePayload<T extends { web?: string | null }>(dto: T): T
    {
        return {
            ...dto,
            web: dto.web === '' ? null : dto.web,
        };
    }

    /**
     * List all clients.
     */
    async list(): Promise<Client[]>
    {
        const res = await firstValueFrom(
            this._httpClient.get<ServiceResponse<Client>>(this._baseUrl),
        );
        return res.data;
    }

    /**
     * Get a single client by id.
     */
    async get(id: number): Promise<Client>
    {
        const res = await firstValueFrom(
            this._httpClient.get<ServiceResponse<Client>>(`${this._baseUrl}/${id}`),
        );
        return res.data[0];
    }

    /**
     * Create a new client.
     */
    async create(dto: CreateClientDto): Promise<Client>
    {
        const res = await firstValueFrom(
            this._httpClient.post<ServiceResponse<Client>>(this._baseUrl, this._preparePayload(dto)),
        );
        return res.data[0];
    }

    /**
     * Update an existing client.
     */
    async update(id: number, dto: UpdateClientDto): Promise<Client>
    {
        const res = await firstValueFrom(
            this._httpClient.patch<ServiceResponse<Client>>(`${this._baseUrl}/${id}`, this._preparePayload(dto)),
        );
        return res.data[0];
    }

    /**
     * Remove (soft-delete) a client.
     */
    async remove(id: number): Promise<Client>
    {
        const res = await firstValueFrom(
            this._httpClient.delete<ServiceResponse<Client>>(`${this._baseUrl}/${id}`),
        );
        return res.data[0];
    }
}
