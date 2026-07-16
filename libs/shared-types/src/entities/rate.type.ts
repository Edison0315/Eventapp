import { RateType } from "../enums/rate.enum";
import { Status } from "../enums/status.enum";

export interface Rate {
  id: number;
  type: RateType;
  value: number;
  status: Status;
  createdAt: Date;
  deletedAt: Date | null;
}