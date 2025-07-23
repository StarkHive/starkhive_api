import { IsUUID } from 'class-validator';

export class ReleaseEscrowDto {
  @IsUUID()
  escrowId: string;

  @IsUUID()
  releasedBy: string;
}
