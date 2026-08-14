import { StudentModel } from './student.model';
import type { Student } from './student.model';

export const studentRepository = {
  async get(studentId: string): Promise<Student | undefined> {
    const item = await StudentModel.get(studentId);
    return item as unknown as Student | undefined;
  },

  async put(student: Student): Promise<void> {
    await new StudentModel(student).save();
  },
};
