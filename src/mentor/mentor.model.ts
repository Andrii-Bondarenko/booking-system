import * as dynamoose from 'dynamoose';
import { config } from '../lib/config';

export interface Mentor {
  mentorId: string; // partition key
  name: string;
  email: string;
  skills: string[];
  experience: number;
  active: boolean;
}

const schema = new dynamoose.Schema({
  mentorId: { type: String, hashKey: true },
  name: String,
  email: String,
  skills: { type: Array, schema: [String] },
  experience: Number,
  active: Boolean,
});

export const MentorModel = dynamoose.model('Mentor', schema);
new dynamoose.Table(config.mentorsTable, [MentorModel], { create: false, waitForActive: false });
