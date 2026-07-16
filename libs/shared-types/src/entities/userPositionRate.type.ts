import { Status } from "../enums/status.enum";
import { Position } from "./position.type";
import { Rate } from "./rate.type";
import { User } from "./user.type";

export interface UserPositionRate {
  id: number;
  user_id: User['id'];
  rate_id: Rate['id'];
  position_id: Position['id'];
  status: Status;
  createdAt: Date;
  deletedAt: Date | null;
}