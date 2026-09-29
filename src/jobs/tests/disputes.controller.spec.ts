import { Test, TestingModule } from '@nestjs/testing';
import { DisputesController } from '../disputes.controller';
import { DisputesService } from '../disputes.service';
import { AdminGuard } from '../../auth/admin.guard';
import { DisputeCategory, DisputeResolution } from '../entities/dispute.entity';
import { UserRole } from '../../auth/enums/userRole.enum';

/** Reads the guards Nest attached to a controller method. */
function getGuards(method: string): unknown[] {
  const handler = (
    DisputesController.prototype as unknown as Record<string, unknown>
  )[method] as object;
  return (Reflect.getMetadata('__guards__', handler) as unknown[]) ?? [];
}

describe('DisputesController', () => {
  let controller: DisputesController;
  let service: jest.Mocked<DisputesService>;

  const req = { user: { id: 'user-1', role: UserRole.FREELANCER } };

  beforeEach(async () => {
    const mock = {
      fileDispute: jest.fn(),
      findMine: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      submitEvidence: jest.fn(),
      assignToAdmin: jest.fn(),
      resolve: jest.fn(),
      cancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputesController],
      providers: [{ provide: DisputesService, useValue: mock }],
    }).compile();

    controller = module.get<DisputesController>(DisputesController);
    service = module.get(DisputesService);
  });

  it('resolves through the DI container', () => {
    expect(controller).toBeDefined();
  });

  it('passes the authenticated user through when filing', () => {
    const dto = {
      escrowId: 'escrow-1',
      category: DisputeCategory.PAYMENT,
      description:
        'Work delivered and approved but the escrow was never released.',
    };

    void controller.fileDispute(dto, req);

    // The actor comes from the token, never from the request body.
    expect(service.fileDispute).toHaveBeenCalledWith(req.user, dto);
  });

  it('scopes the "mine" listing to the caller', () => {
    void controller.findMine({}, req);
    expect(service.findMine).toHaveBeenCalledWith(req.user, {});
  });

  it('does not pass the caller to the admin queue', () => {
    void controller.findAll({ page: 2 });
    expect(service.findAll).toHaveBeenCalledWith({ page: 2 });
  });

  it('delegates evidence submission with the dispute id and actor', () => {
    const dto = { fileUrl: 'https://s.example/a.pdf', fileName: 'a.pdf' };
    void controller.submitEvidence('dispute-1', dto, req);
    expect(service.submitEvidence).toHaveBeenCalledWith(
      'dispute-1',
      req.user,
      dto,
    );
  });

  it('delegates resolution with the acting admin', () => {
    const dto = {
      resolution: DisputeResolution.DISMISSED,
      resolutionNotes: 'No merit found in the submitted evidence.',
    };
    void controller.resolve('dispute-1', dto, req);
    expect(service.resolve).toHaveBeenCalledWith('dispute-1', req.user, dto);
  });

  it('delegates assignment and cancellation', () => {
    void controller.assign('dispute-1', req);
    void controller.cancel('dispute-1', req);
    expect(service.assignToAdmin).toHaveBeenCalledWith('dispute-1', req.user);
    expect(service.cancel).toHaveBeenCalledWith('dispute-1', req.user);
  });

  describe('admin-only routes', () => {
    // Guard metadata is the only thing standing between a freelancer and the
    // whole dispute queue, so assert it is actually attached.
    it.each(['findAll', 'assign', 'resolve'])(
      'puts AdminGuard on %s',
      (method) => {
        const guards = getGuards(method);
        expect(guards).toContain(AdminGuard);
      },
    );

    it.each(['fileDispute', 'findMine', 'findOne', 'submitEvidence', 'cancel'])(
      'leaves %s open to any authenticated user',
      (method) => {
        const guards = getGuards(method);
        expect(guards).not.toContain(AdminGuard);
      },
    );
  });
});
