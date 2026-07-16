import { Status } from "../enums/status.enum";
import { Entity } from "./entity.type";

export interface Place extends Entity {
  name: string;
  address: string;
  ubication: string;
  email: string;
  phone: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}