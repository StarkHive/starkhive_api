import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { Dispute } from './entities/dispute.entity';
import { DisputeEvidence } from './entities/dispute-evidence.entity';
import { Escrow } from './entities/escrow.entity';

/**
 * Disputes are their own module rather than additions to JobModule: the
 * dispute lifecycle has no dependency on job CRUD, and keeping it separate
 * means the mediation workflow can be wired up and tested on its own.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Dispute, DisputeEvidence, Escrow])],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
