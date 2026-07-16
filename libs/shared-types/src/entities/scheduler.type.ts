import { Entity } from "./entity.type";
import { UserPositionRate } from "./userPositionRate.type";

export interface Scheduler {
  id: number;
  user_position_rate_id: UserPositionRate['id'];
  entity_id: Entity['id'];
  date_start: Date;
  date_end: Date;
  admin_approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}