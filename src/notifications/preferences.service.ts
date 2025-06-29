import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Preferences } from './entities/preferences.entity';
import { Repository } from 'typeorm';
import { CreatePreferencesDto } from './dto/create-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { User } from '../auth/entities/user.entity';
import { ApplicationStatus } from 'src/applications/entities/application.entity';

@Injectable()
export class NotificationService {
  notifyStatusChange(applicationId: string, status: ApplicationStatus) {
    
    console.log(`Notify: Application ${applicationId} changed to ${status}`);
  }
}

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(Preferences)
    private preferencesRepository: Repository<Preferences>,
  ) {}

  async findByUser(user: User): Promise<Preferences | null> {
    return this.preferencesRepository.findOne({
      where: { user: { id: user.id } },
    });
  }

  async create(user: User, dto: CreatePreferencesDto): Promise<Preferences> {
    const existing = await this.findByUser(user);
    if (existing) {
      throw new BadRequestException('Preferences already exist for this user.');
    }
    const preferences = this.preferencesRepository.create({ user, ...dto });
    return this.preferencesRepository.save(preferences);
  }

  async update(user: User, dto: UpdatePreferencesDto): Promise<Preferences> {
    const preferences = await this.findByUser(user);
    if (!preferences) {
      throw new NotFoundException('Preferences not found for this user.');
    }
    Object.assign(preferences, dto);
    return this.preferencesRepository.save(preferences);
  }
}
