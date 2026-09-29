import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DisputesService, DisputeActor } from '../disputes.service';
import {
  Dispute,
  DisputeCategory,
  DisputeResolution,
  DisputeStatus,
} from '../entities/dispute.entity';
import { DisputeEvidence } from '../entities/dispute-evidence.entity';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { UserRole } from '../../auth/enums/userRole.enum';

const RECRUITER: DisputeActor = { id: 'recruiter-1', role: UserRole.RECRUITER };
const FREELANCER: DisputeActor = {
  id: 'freelancer-1',
  role: UserRole.FREELANCER,
};
const STRANGER: DisputeActor = { id: 'stranger-1', role: UserRole.FREELANCER };
const ADMIN: DisputeActor = { id: 'admin-1', role: UserRole.ADMIN };

function makeEscrow(overrides: Partial<Escrow> = {}): Escrow {
  return {
    id: 'escrow-1',
    jobId: 'job-1',
    recruiterId: RECRUITER.id,
    freelancerId: FREELANCER.id,
    amount: 100,
    currency: 'USDC',
    status: EscrowStatus.LOCKED,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    id: 'dispute-1',
    escrowId: 'escrow-1',
    jobId: 'job-1',
    filedById: FREELANCER.id,
    respondentId: RECRUITER.id,
    category: DisputeCategory.PAYMENT,
    description:
      'Work delivered and approved but the escrow was never released.',
    status: DisputeStatus.OPEN,
    assignedAdminId: null,
    resolution: null,
    resolutionNotes: null,
    awardedAmount: null,
    resolvedById: null,
    resolvedAt: null,
    evidence: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface MockDisputeRepo {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
}

interface MockEvidenceRepo {
  create: jest.Mock;
  save: jest.Mock;
}

interface MockEscrowRepo {
  findOne: jest.Mock;
  save: jest.Mock;
}

interface MockDataSource {
  transaction: jest.Mock;
}

interface MockQueryBuilder {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
}

describe('DisputesService', () => {
  let service: DisputesService;
  let disputeRepo: MockDisputeRepo;
  let evidenceRepo: MockEvidenceRepo;
  let escrowRepo: MockEscrowRepo;
  let dataSource: MockDataSource;
  let transactionManager: { save: jest.Mock };

  beforeEach(async () => {
    transactionManager = {
      save: jest
        .fn()
        .mockImplementation((_entity: unknown, value: unknown) => value),
    };

    disputeRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((v: Partial<Dispute>) => ({
        id: 'dispute-new',
        ...v,
      })),
      save: jest.fn().mockImplementation((v: Dispute) => Promise.resolve(v)),
      createQueryBuilder: jest.fn(),
    };
    evidenceRepo = {
      create: jest.fn().mockImplementation((v: Partial<DisputeEvidence>) => ({
        id: 'evidence-new',
        ...v,
      })),
      save: jest
        .fn()
        .mockImplementation((v: DisputeEvidence) => Promise.resolve(v)),
    };
    escrowRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((v: Escrow) => Promise.resolve(v)),
    };
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          (cb: (m: typeof transactionManager) => Promise<unknown>) =>
            cb(transactionManager),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: getRepositoryToken(Dispute), useValue: disputeRepo },
        {
          provide: getRepositoryToken(DisputeEvidence),
          useValue: evidenceRepo,
        },
        { provide: getRepositoryToken(Escrow), useValue: escrowRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);
  });

  const validFiling = {
    escrowId: 'escrow-1',
    category: DisputeCategory.PAYMENT,
    description:
      'Work delivered and approved but the escrow was never released.',
  };

  describe('fileDispute', () => {
    it('lets the freelancer file and names the recruiter as respondent', async () => {
      escrowRepo.findOne.mockResolvedValue(makeEscrow());
      disputeRepo.findOne.mockResolvedValue(null);

      const dispute = await service.fileDispute(FREELANCER, validFiling);

      expect(dispute.filedById).toBe(FREELANCER.id);
      expect(dispute.respondentId).toBe(RECRUITER.id);
      expect(dispute.status).toBe(DisputeStatus.OPEN);
      expect(dispute.jobId).toBe('job-1');
    });

    it('flips the respondent when the recruiter is the one filing', async () => {
      escrowRepo.findOne.mockResolvedValue(makeEscrow());
      disputeRepo.findOne.mockResolvedValue(null);

      const dispute = await service.fileDispute(RECRUITER, validFiling);

      expect(dispute.filedById).toBe(RECRUITER.id);
      expect(dispute.respondentId).toBe(FREELANCER.id);
    });

    it('marks the escrow as disputed', async () => {
      const escrow = makeEscrow();
      escrowRepo.findOne.mockResolvedValue(escrow);
      disputeRepo.findOne.mockResolvedValue(null);

      await service.fileDispute(FREELANCER, validFiling);

      expect(escrowRepo.save).toHaveBeenCalled();
      expect(escrow.status).toBe(EscrowStatus.DISPUTED);
    });

    it('refuses someone with no stake in the escrow', async () => {
      escrowRepo.findOne.mockResolvedValue(makeEscrow());

      await expect(service.fileDispute(STRANGER, validFiling)).rejects.toThrow(
        ForbiddenException,
      );
      expect(disputeRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a missing escrow', async () => {
      escrowRepo.findOne.mockResolvedValue(null);

      await expect(
        service.fileDispute(FREELANCER, validFiling),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([EscrowStatus.RELEASED, EscrowStatus.REFUNDED])(
      'refuses an escrow already %s',
      async (status) => {
        escrowRepo.findOne.mockResolvedValue(makeEscrow({ status }));

        await expect(
          service.fileDispute(FREELANCER, validFiling),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('refuses a second dispute while one is still active', async () => {
      escrowRepo.findOne.mockResolvedValue(makeEscrow());
      disputeRepo.findOne.mockResolvedValue(makeDispute());

      await expect(
        service.fileDispute(FREELANCER, validFiling),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne access control', () => {
    it.each([
      ['the filer', FREELANCER],
      ['the respondent', RECRUITER],
      ['an admin', ADMIN],
    ])('lets %s read the dispute', async (_label, actor) => {
      disputeRepo.findOne.mockResolvedValue(makeDispute());

      await expect(service.findOne('dispute-1', actor)).resolves.toBeDefined();
    });

    it('hides the dispute from an unrelated user as a 404, not a 403', async () => {
      disputeRepo.findOne.mockResolvedValue(makeDispute());

      // A 403 would confirm the dispute exists, leaking that two particular
      // users are in conflict over a job.
      await expect(service.findOne('dispute-1', STRANGER)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('submitEvidence', () => {
    const evidence = {
      fileUrl: 'https://storage.example/invoice.pdf',
      fileName: 'invoice.pdf',
    };

    it('records evidence from a party', async () => {
      disputeRepo.findOne.mockResolvedValue(makeDispute());

      const saved = await service.submitEvidence(
        'dispute-1',
        FREELANCER,
        evidence,
      );

      expect(saved.disputeId).toBe('dispute-1');
      expect(saved.submittedById).toBe(FREELANCER.id);
      expect(saved.mimeType).toBeNull();
      expect(saved.note).toBeNull();
    });

    it('accepts evidence while under review', async () => {
      disputeRepo.findOne.mockResolvedValue(
        makeDispute({ status: DisputeStatus.UNDER_REVIEW }),
      );

      await expect(
        service.submitEvidence('dispute-1', RECRUITER, evidence),
      ).resolves.toBeDefined();
    });

    it.each([DisputeStatus.RESOLVED, DisputeStatus.CANCELLED])(
      'refuses evidence on a %s dispute',
      async (status) => {
        disputeRepo.findOne.mockResolvedValue(makeDispute({ status }));

        await expect(
          service.submitEvidence('dispute-1', FREELANCER, evidence),
        ).rejects.toThrow(BadRequestException);
        expect(evidenceRepo.save).not.toHaveBeenCalled();
      },
    );

    it('refuses evidence from an unrelated user', async () => {
      disputeRepo.findOne.mockResolvedValue(makeDispute());

      await expect(
        service.submitEvidence('dispute-1', STRANGER, evidence),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignToAdmin', () => {
    it('moves an open dispute to under review and records the admin', async () => {
      disputeRepo.findOne.mockResolvedValue(makeDispute());

      const dispute = await service.assignToAdmin('dispute-1', ADMIN);

      expect(dispute.status).toBe(DisputeStatus.UNDER_REVIEW);
      expect(dispute.assignedAdminId).toBe(ADMIN.id);
    });

    it('refuses to re-take a dispute already under review', async () => {
      disputeRepo.findOne.mockResolvedValue(
        makeDispute({ status: DisputeStatus.UNDER_REVIEW }),
      );

      await expect(service.assignToAdmin('dispute-1', ADMIN)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resolve', () => {
    function arrange(
      disputeOverrides: Partial<Dispute> = {},
      escrowOverrides: Partial<Escrow> = {},
    ) {
      const escrow = makeEscrow(escrowOverrides);
      disputeRepo.findOne.mockResolvedValue(makeDispute(disputeOverrides));
      escrowRepo.findOne.mockResolvedValue(escrow);
      return escrow;
    }

    it.each([
      [DisputeResolution.RELEASE_TO_FREELANCER, EscrowStatus.RELEASED],
      [DisputeResolution.REFUND_TO_RECRUITER, EscrowStatus.REFUNDED],
      [DisputeResolution.DISMISSED, EscrowStatus.LOCKED],
    ])('enforces %s against the escrow as %s', async (resolution, expected) => {
      const escrow = arrange();

      const dispute = await service.resolve('dispute-1', ADMIN, {
        resolution,
        resolutionNotes: 'Decision recorded after reviewing the evidence.',
      });

      expect(dispute.status).toBe(DisputeStatus.RESOLVED);
      expect(dispute.resolution).toBe(resolution);
      expect(dispute.resolvedById).toBe(ADMIN.id);
      expect(dispute.resolvedAt).toBeInstanceOf(Date);
      expect(escrow.status).toBe(expected);
    });

    it('writes the dispute and the escrow in one transaction', async () => {
      arrange();

      await service.resolve('dispute-1', ADMIN, {
        resolution: DisputeResolution.RELEASE_TO_FREELANCER,
        resolutionNotes: 'Work was delivered as briefed.',
      });

      // Leaving the escrow in `disputed` while the dispute reads `resolved`
      // would strand the funds with nothing left in the queue to flag it.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(transactionManager.save).toHaveBeenCalledTimes(2);
      expect(disputeRepo.save).not.toHaveBeenCalled();
      expect(escrowRepo.save).not.toHaveBeenCalled();
    });

    it('records a partial award for a split', async () => {
      const escrow = arrange();

      const dispute = await service.resolve('dispute-1', ADMIN, {
        resolution: DisputeResolution.SPLIT,
        resolutionNotes: 'Partial delivery confirmed against the brief.',
        awardedAmount: 60,
      });

      expect(dispute.awardedAmount).toBe(60);
      expect(escrow.status).toBe(EscrowStatus.RELEASED);
    });

    it('rejects a split with no amount', async () => {
      arrange();

      await expect(
        service.resolve('dispute-1', ADMIN, {
          resolution: DisputeResolution.SPLIT,
          resolutionNotes: 'Partial delivery confirmed against the brief.',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a split at or above the escrow amount', async () => {
      arrange();

      await expect(
        service.resolve('dispute-1', ADMIN, {
          resolution: DisputeResolution.SPLIT,
          resolutionNotes: 'Partial delivery confirmed against the brief.',
          awardedAmount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    describe('when postgres returns the escrow amount as a decimal string', () => {
      // `decimal` columns come back as strings, so the bound is checked
      // against '100.00000000' rather than 100.
      const asString = { amount: '100.00000000' as unknown as number };

      it('still accepts an award below the amount', async () => {
        arrange({}, asString);

        const dispute = await service.resolve('dispute-1', ADMIN, {
          resolution: DisputeResolution.SPLIT,
          resolutionNotes: 'Partial delivery confirmed against the brief.',
          awardedAmount: 60,
        });

        expect(dispute.awardedAmount).toBe(60);
      });

      it('still rejects an award above the amount', async () => {
        arrange({}, asString);

        await expect(
          service.resolve('dispute-1', ADMIN, {
            resolution: DisputeResolution.SPLIT,
            resolutionNotes: 'Partial delivery confirmed against the brief.',
            awardedAmount: 150,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('reports the bound as a number, not the raw column string', async () => {
        arrange({}, asString);

        await expect(
          service.resolve('dispute-1', ADMIN, {
            resolution: DisputeResolution.SPLIT,
            resolutionNotes: 'Partial delivery confirmed against the brief.',
            awardedAmount: 150,
          }),
        ).rejects.toThrow('escrow amount (100)');
      });
    });

    it('rejects an award attached to a non-split outcome', async () => {
      arrange();

      await expect(
        service.resolve('dispute-1', ADMIN, {
          resolution: DisputeResolution.REFUND_TO_RECRUITER,
          resolutionNotes: 'No delivery was made against the brief.',
          awardedAmount: 60,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to resolve an already-resolved dispute', async () => {
      arrange({ status: DisputeStatus.RESOLVED });

      await expect(
        service.resolve('dispute-1', ADMIN, {
          resolution: DisputeResolution.DISMISSED,
          resolutionNotes: 'Attempting a second decision on the same dispute.',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('refuses when the escrow has vanished', async () => {
      disputeRepo.findOne.mockResolvedValue(makeDispute());
      escrowRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resolve('dispute-1', ADMIN, {
          resolution: DisputeResolution.DISMISSED,
          resolutionNotes: 'Escrow no longer exists for this dispute.',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('lets the filer withdraw an open dispute and unlocks the escrow', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.DISPUTED });
      disputeRepo.findOne.mockResolvedValue(makeDispute());
      escrowRepo.findOne.mockResolvedValue(escrow);

      const dispute = await service.cancel('dispute-1', FREELANCER);

      expect(dispute.status).toBe(DisputeStatus.CANCELLED);
      expect(escrow.status).toBe(EscrowStatus.LOCKED);
    });

    it('leaves an escrow alone if it is no longer marked disputed', async () => {
      const escrow = makeEscrow({ status: EscrowStatus.RELEASED });
      disputeRepo.findOne.mockResolvedValue(makeDispute());
      escrowRepo.findOne.mockResolvedValue(escrow);

      await service.cancel('dispute-1', FREELANCER);

      expect(escrow.status).toBe(EscrowStatus.RELEASED);
    });

    it('refuses to let the respondent withdraw', async () => {
      disputeRepo.findOne.mockResolvedValue(makeDispute());

      await expect(service.cancel('dispute-1', RECRUITER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses once an admin has taken the case', async () => {
      disputeRepo.findOne.mockResolvedValue(
        makeDispute({ status: DisputeStatus.UNDER_REVIEW }),
      );

      await expect(service.cancel('dispute-1', FREELANCER)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listing', () => {
    function mockQueryBuilder(rows: Dispute[]): MockQueryBuilder {
      const qb: MockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
      };
      disputeRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('scopes findMine to disputes the caller is a party to', async () => {
      const qb = mockQueryBuilder([makeDispute()]);

      const result = await service.findMine(FREELANCER, {});

      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('filedById'),
        { actorId: FREELANCER.id },
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('does not scope the admin queue by caller', async () => {
      const qb = mockQueryBuilder([makeDispute()]);

      await service.findAll({});

      expect(qb.where).not.toHaveBeenCalled();
    });

    it('applies status, category and job filters', async () => {
      const qb = mockQueryBuilder([]);

      await service.findAll({
        status: DisputeStatus.OPEN,
        category: DisputeCategory.PAYMENT,
        jobId: 'job-1',
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });

    it('paginates from the requested page', async () => {
      const qb = mockQueryBuilder([]);

      await service.findAll({ page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });
});
