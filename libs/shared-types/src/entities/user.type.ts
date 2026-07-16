import { Gender } from "../enums/gender.enum";
import { Language } from "../enums/lenguage.enum";
import { Status } from "../enums/status.enum";

export interface User {
  id: number;
  fullname: string;
  gender: Gender;
  phone: string;
  telegram: string | null;
  whatsapp: string | null;
  lenguajes: Language[];
  birthdate: Date;
  is_admin: boolean;
  hiredate: Date;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}