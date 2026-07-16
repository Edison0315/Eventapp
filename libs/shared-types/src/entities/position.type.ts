import { PositionName } from "../enums/position.enum";

export interface Position {
  id: number;
  name: PositionName;
  description: string;
}