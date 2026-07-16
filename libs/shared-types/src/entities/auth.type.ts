import { User } from "./user.type";

export interface Auth {
  id: number;
  user_id: User['id'];
  email: string;
  password: string;
}