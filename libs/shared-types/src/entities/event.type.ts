import { Status } from "../enums/status.enum";
import { Entity } from "./entity.type";

export interface Event extends Entity {
  name: string;
  address: string;
  ubication: string;
  date_start: Date;
  date_end: Date;
  typeEvent: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}