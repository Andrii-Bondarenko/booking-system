import * as dynamoose from 'dynamoose';
import { config } from '../lib/config';

export interface Student {
  studentId: string; // partition key
  email: string;
  name: string;
  phone: string;
}

const schema = new dynamoose.Schema({
  studentId: { type: String, hashKey: true },
  email: String,
  name: String,
  phone: String,
});

export const StudentModel = dynamoose.model('Student', schema);
new dynamoose.Table(config.studentsTable, [StudentModel], { create: false, waitForActive: false });
