import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined) return false;

    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) return false;

    // Tolera 1s de clock skew: en vez de comparar estrictamente contra
    // "ahora", se acepta cualquier fecha >= (ahora - 1s).
    return date >= new Date(Date.now() - 1000);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a future date`;
  }
}

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}
