import { IsOrgGuard } from "@/modules/auth/guards/organizations/is-org.guard";
import { OrganizationsRepository } from "@/modules/organizations/index/organizations.repository";
import { RedisService } from "@/modules/redis/redis.service";
import { createMock } from "@golevelup/ts-jest";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";

describe("IsOrgGuard", () => {
  let guard: IsOrgGuard;
  let organizationsRepository: OrganizationsRepository;
  let redisService: RedisService;

  beforeEach(() => {
    organizationsRepository = createMock<OrganizationsRepository>();
    redisService = createMock<RedisService>({
      redis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(null),
      },
    });
    guard = new IsOrgGuard(organizationsRepository, redisService);
  });

  function createMockExecutionContext(orgId: string | undefined): ExecutionContext {
    return createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => ({
          params: { orgId },
          organization: undefined,
        }),
      }),
    });
  }

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("orgId validation", () => {
    it("should throw ForbiddenException when orgId is missing", async () => {
      const mockContext = createMockExecutionContext(undefined);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "IsOrgGuard - No organization id found in request params."
      );
    });

    it("should throw BadRequestException for non-numeric orgId", async () => {
      const mockContext = createMockExecutionContext("abc");

      await expect(guard.canActivate(mockContext)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "IsOrgGuard - Invalid organization id 'abc'. Organization id must be a positive integer."
      );
    });

    it("should throw BadRequestException for floating point orgId", async () => {
      const mockContext = createMockExecutionContext("1.5");

      await expect(guard.canActivate(mockContext)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "IsOrgGuard - Invalid organization id '1.5'. Organization id must be a positive integer."
      );
    });

    it("should throw BadRequestException for negative orgId", async () => {
      const mockContext = createMockExecutionContext("-1");

      await expect(guard.canActivate(mockContext)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "IsOrgGuard - Invalid organization id '-1'. Organization id must be a positive integer."
      );
    });

    it("should throw BadRequestException for zero orgId", async () => {
      const mockContext = createMockExecutionContext("0");

      await expect(guard.canActivate(mockContext)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "IsOrgGuard - Invalid organization id '0'. Organization id must be a positive integer."
      );
    });

    it("should throw BadRequestException for empty string orgId", async () => {
      const mockContext = createMockExecutionContext("");

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException for special characters in orgId", async () => {
      const mockContext = createMockExecutionContext("1; DROP TABLE;");

      await expect(guard.canActivate(mockContext)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        /Organization id must be a positive integer/
      );
    });

    it("should throw BadRequestException for NaN-producing orgId", async () => {
      const mockContext = createMockExecutionContext("NaN");

      await expect(guard.canActivate(mockContext)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "IsOrgGuard - Invalid organization id 'NaN'. Organization id must be a positive integer."
      );
    });

    it("should throw BadRequestException for Infinity orgId", async () => {
      const mockContext = createMockExecutionContext("Infinity");

      await expect(guard.canActivate(mockContext)).rejects.toThrow(BadRequestException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        /Organization id must be a positive integer/
      );
    });
  });

  describe("valid orgId handling", () => {
    it("should return true for valid organization", async () => {
      const mockContext = createMockExecutionContext("123");

      jest.spyOn(organizationsRepository, "findById").mockResolvedValue({
        id: 123,
        isOrganization: true,
      } as any);

      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    });

    it("should throw ForbiddenException for non-existent organization", async () => {
      const mockContext = createMockExecutionContext("999");

      jest.spyOn(organizationsRepository, "findById").mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "does not represent any existing organization"
      );
    });

    it("should throw ForbiddenException when team is not an organization", async () => {
      const mockContext = createMockExecutionContext("456");

      jest.spyOn(organizationsRepository, "findById").mockResolvedValue({
        id: 456,
        isOrganization: false,
      } as any);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it("should use cached value from Redis when available", async () => {
      const mockContext = createMockExecutionContext("789");
      const cachedOrg = { id: 789, isOrganization: true };

      jest.spyOn(redisService.redis, "get").mockResolvedValue(
        JSON.stringify({ org: cachedOrg, canAccess: true })
      );

      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
      expect(organizationsRepository.findById).not.toHaveBeenCalled();
    });
  });
});
