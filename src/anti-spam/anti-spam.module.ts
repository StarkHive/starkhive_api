import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpamFlag } from './entities/spam-flag.entity';
import { AntiSpamService } from './anti-spam.service';
import { AntiSpamController } from './anti-spam.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SpamFlag])],
  providers: [AntiSpamService],
  controllers: [AntiSpamController],
  exports: [AntiSpamService],
})
export class AntiSpamModule {}
