import { Status } from "../enums/status.enum";
import { Entity } from "./entity.type";

export interface Client extends Entity {
  name: string;
  nro_doc: string;
  address: string;
  ubication: string;
  email: string;
  web: string | null;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}