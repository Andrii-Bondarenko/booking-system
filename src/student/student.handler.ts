import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { created, parseJson } from '../lib/http';
import { studentRepository } from './student.repository';
import type { Student } from './student.model';

/** POST /students — body: { studentId, email, name, phone } */
export async function createStudent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJson<Partial<Student>>(event);
  const student: Student = {
    studentId: body.studentId ?? '',
    email: body.email ?? '',
    name: body.name ?? '',
    phone: body.phone ?? '',
  };
  await studentRepository.put(student);
  return created({ student });
}
