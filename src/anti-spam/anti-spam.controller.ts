import { Controller, Get } from '@nestjs/common';
import { AntiSpamService } from './anti-spam.service';

@Controller('anti-spam')
export class AntiSpamController {
  constructor(private readonly antiSpamService: AntiSpamService) {}

  @Get('flags')
  getAllFlags() {
    return this.antiSpamService.findAllFlags();
  }
}
