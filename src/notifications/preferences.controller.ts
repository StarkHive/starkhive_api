import { Controller, Post, Put, Body, UseGuards, Request } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { CreatePreferencesDto } from './dto/create-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('notifications/preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Post()
  async createPreferences(
    @Request() req,
    @Body() dto: CreatePreferencesDto,
  ) {
    const user = req.user;
    const created = await this.preferencesService.create(user, dto);
    return { message: 'Preferences created', preferences: created };
  }

  @Put()
  async updatePreferences(
    @Request() req,
    @Body() dto: UpdatePreferencesDto,
  ) {
    const user = req.user;
    const updated = await this.preferencesService.update(user, dto);
    return { message: 'Preferences updated', preferences: updated };
  }
}