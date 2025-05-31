import { Test, TestingModule } from '@nestjs/testing';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { CreatePreferencesDto } from './dto/create-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

describe('PreferencesController', () => {
  let controller: PreferencesController;
  let service: PreferencesService;

  const mockUser = { id: 'user-123' };
  const mockPreferences = {
    id: 1,
    user: mockUser,
    application: true,
    reviews: false,
    posts: true,
    tasks: false,
  };

  const mockPreferencesService = {
    create: jest.fn().mockResolvedValue(mockPreferences),
    update: jest.fn().mockResolvedValue({ ...mockPreferences, application: false }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreferencesController],
      providers: [
        { provide: PreferencesService, useValue: mockPreferencesService },
      ],
    }).compile();

    controller = module.get<PreferencesController>(PreferencesController);
    service = module.get<PreferencesService>(PreferencesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPreferences', () => {
    it('should create preferences and return result', async () => {
      const dto: CreatePreferencesDto = {
        application: true,
        reviews: false,
        posts: true,
        tasks: false,
      };
      const req = { user: mockUser };
      const result = await controller.createPreferences(req, dto);
      expect(service.create).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual({
        message: 'Preferences created',
        preferences: mockPreferences,
      });
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences and return result', async () => {
      const dto: UpdatePreferencesDto = { application: false };
      const req = { user: mockUser };
      const result = await controller.updatePreferences(req, dto);
      expect(service.update).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual({
        message: 'Preferences updated',
        preferences: { ...mockPreferences, application: false },
      });
    });
  });
});