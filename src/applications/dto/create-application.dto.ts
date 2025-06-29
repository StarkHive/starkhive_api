export class CreateApplicationDto {
  jobId: number;
  name: string;
  description?: string;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
