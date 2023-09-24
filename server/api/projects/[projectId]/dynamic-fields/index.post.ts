import Prisma, { FieldOperator, FieldType } from '@prisma/client'
const { PrismaClient } = Prisma
import * as yup from 'yup';
import { safeResponseHandler } from '../../../../utils/safeResponseHandler';
import { requireUser } from '../../../../utils/authorize';

const prisma = new PrismaClient();
const fieldOperators = Object.values(FieldOperator);

export const NewDynamicFieldSchema = yup.object({
  field0Id: yup.number().required(),
  field1Id: yup.number().required(),
  label: yup.string().required(),
  operator: yup.mixed<typeof fieldOperators[number]>().required().oneOf(
    Object.values(FieldOperator)
  ).required(),
}).required();

export const dynamicFieldsConfig: DynamicFieldsConfig = {
  [FieldOperator.DIFF]: {
    pairs: [
      [FieldType.DATE, FieldType.DATE],
      [FieldType.DATETIME, FieldType.DATETIME],
      [FieldType.DATETIME, FieldType.DATE],
      [FieldType.INT, FieldType.INT],
      [FieldType.FLOAT, FieldType.FLOAT],
      [FieldType.FLOAT, FieldType.INT],
    ]
  },
  [FieldOperator.SUM]: {
    pairs: [
      [FieldType.INT, FieldType.INT],
      [FieldType.FLOAT, FieldType.FLOAT],
      [FieldType.FLOAT, FieldType.INT],
    ]
  }
}

// TODO: prettify code
export default safeResponseHandler(async (event) => {
  requireUser(event);
  await ensureURLResourceAccess(event, event.context.user);
  const body = await readBody(event);
  const field = await NewDynamicFieldSchema.validate(body)
  const projectId = parseIntParam(event.context.params?.projectId);

  // ensure same setup (fields and operation) is not present in project
  // NOTE: the reason it is project specific, is because projecFieldsIds are not shared
  const existing = await prisma.dynamicProjectField.findFirst({
    where: {
      field0Id: field.field0Id,
      field1Id: field.field1Id,
      operator: field.operator,
    }
  });
  if (existing) {
    // TODO: report error
    throw createError({
      statusCode: 400,
      statusMessage: 'An identical dynamic field already exists',
    });
  }

  // ensure submitted fieldIds are NOT identical
  if (field.field0Id === field.field1Id) {
    // TODO: report error
    throw createError({
      statusCode: 400,
      statusMessage: 'Dynamic field cannot operate on two identical static fields',
    });
  }

  
  // get field types
  const fieldTypes = await prisma.projectField.findMany({
    select: {
      id: true,
      label: true,
      type: true,
    },
    where: {
      AND: [
        {
          id: {
            in: [field.field0Id, field.field1Id]
          },
        },
        {
          projectId: projectId,
        }
      ]
    }
  });

  // ensure both fields exists and is in project
  if (fieldTypes.length !== 2) {
    // TODO: report error
    throw createError({
      statusCode: 400,
      statusMessage: 'One or both provided static fields could not be found',
    });
  }

  // get dynamic field match from config
  const targetFieldTypes = fieldTypes.map(f => f.type);
  const allowedPairs = dynamicFieldsConfig[field.operator].pairs;
  const allowedMatch = allowedPairs.find((pair) => pair.every(t => targetFieldTypes.includes(t)));

  // ensure there is a matching dynamic field config
  if (!allowedMatch) {
    // TODO: report error
    const fieldNames = fieldTypes.map(f => `'${f.label}'`);
    throw createError({
      statusCode: 400,
      statusMessage: `The fields ${fieldNames.join(' and ')} does not support the provided operation`,
    });
  }

  // create dynamic field
  const createdField = await prisma.dynamicProjectField.create({
    data: {
      field0Id: field.field0Id,
      field1Id: field.field1Id,
      label: field.label,
      operator: field.operator,
      projectId: projectId,
    }
  });

  // return 201 Created
  setResponseStatus(event, 201);
  return createdField;
});