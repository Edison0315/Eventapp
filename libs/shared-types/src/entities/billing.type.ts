import { BillingStatus } from "../enums/billingStatus.enum";
import { Entity } from "./entity.type";
import { UserPositionRate } from "./userPositionRate.type";

export interface Billing {
  id: number;
  user_position_rate_id: UserPositionRate['id'];
  entity_id: Entity['id'];
  date_start: Date;
  date_end: Date;
  amount_hours: number;
  status: BillingStatus;
}