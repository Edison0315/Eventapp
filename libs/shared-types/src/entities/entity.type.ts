import { EntityType } from "../enums/entity.enum";

export interface Entity {
  id: number;
  type: EntityType;
}