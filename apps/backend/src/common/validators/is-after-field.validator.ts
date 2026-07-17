import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isAfterField', async: false })
export class IsAfterFieldConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === null || value === undefined) return false;

    const [relatedPropertyName] = args.constraints as [string];
    const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];

    // Si el campo relacionado no vino (ambos opcionales, ej. ListEventsQueryDto
    // con `to` presente pero `from` ausente), no hay nada contra qué comparar:
    // no es una contradicción, así que no se rechaza aquí.
    if (relatedValue === null || relatedValue === undefined) return true;

    const date = new Date(value as string | number | Date);
    const relatedDate = new Date(relatedValue as string | number | Date);

    if (Number.isNaN(date.getTime()) || Number.isNaN(relatedDate.getTime())) {
      return false;
    }

    return date > relatedDate;
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints as [string];
    return `${args.property} must be after ${relatedPropertyName}`;
  }
}

export function IsAfterField(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsAfterFieldConstraint,
    });
  };
}
