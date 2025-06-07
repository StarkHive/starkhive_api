export class CreateApplicationDto {
     jobId: string;
     name: string;
     description?: string;
     ownerId: string;
     createdAt?: Date;
     updatedAt?: Date;
}