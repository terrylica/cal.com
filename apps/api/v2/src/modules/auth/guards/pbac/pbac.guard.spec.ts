import { PrismaFeaturesRepository } from "@/lib/repositories/prisma-features.repository";
import { PermissionCheckService } from "@/lib/services/permission-check.service";
import { RedisService } from "@/modules/redis/redis.service";
import { createMock } from "@golevelup/ts-jest";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { PermissionString } from "@calcom/platform-libraries/pbac";

import { PbacGuard, REDIS_PBAC_CACHE_KEY, REDIS_REQUIRED_PERMISSIONS_CACHE_KEY } from "./pbac.guard";

describe("PbacGuard", () => {
  let guard: PbacGuard;
  let reflector: Reflector;
  let featuresRepository: jest.Mocked<PrismaFeaturesRepository>;
  let permissionCheckService: jest.Mocked<PermissionCheckService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    reflector = new Reflector();
    featuresRepository = createMock<PrismaFeaturesRepository>();
    permissionCheckService = createMock<PermissionCheckService>();
    redisService = createMock<RedisService>();

    guard = new PbacGuard(reflector, featuresRepository, permissionCheckService, redisService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should throw UnauthorizedException when user is not provided", async () => {
      const request = { user: undefined, params: { orgId: "1" } };
      const mockContext = createMockExecutionContext(request);
      jest.spyOn(reflector, "get").mockReturnValue(["role.read"] as PermissionString[]);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "PbacGuard - the request does not have an authorized user provided"
      );
    });

    it("should throw BadRequestException when neither teamId nor orgId is provided", async () => {
      const request = { user: { id: 1 }, params: {} };
      const mockContext = createMockExecutionContext(request);
      jest.spyOn(reflector, "get").mockReturnValue(["role.read"] as PermissionString[]);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "PbacGuard - can't check pbac because no teamId or orgId provided within the request url"
      );
    });

    it("should return true and set pbacAuthorizedRequest to false when no required permissions", async () => {
      const request: Record<string, unknown> = { user: { id: 1 }, params: { orgId: "1" } };
      const mockContext = createMockExecutionContext(request);
      jest.spyOn(reflector, "get").mockReturnValue(undefined);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(request.pbacAuthorizedRequest).toBe(false);
    });

    it("should return true and set pbacAuthorizedRequest to false when required permissions is empty array", async () => {
      const request: Record<string, unknown> = { user: { id: 1 }, params: { orgId: "1" } };
      const mockContext = createMockExecutionContext(request);
      jest.spyOn(reflector, "get").mockReturnValue([]);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(request.pbacAuthorizedRequest).toBe(false);
    });

    it("should return true and set pbacAuthorizedRequest to false when PBAC is not enabled for team", async () => {
      const request: Record<string, unknown> = { user: { id: 1 }, params: { orgId: "1" } };
      const mockContext = createMockExecutionContext(request);
      jest.spyOn(reflector, "get").mockReturnValue(["role.read"] as PermissionString[]);
      redisService.get.mockResolvedValue(null);
      featuresRepository.checkIfTeamHasFeature.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(request.pbacAuthorizedRequest).toBe(false);
      expect(featuresRepository.checkIfTeamHasFeature).toHaveBeenCalledWith(1, "pbac");
    });

    it("should return true and set pbacAuthorizedRequest to true when user has required permissions", async () => {
      const request: Record<string, unknown> = { user: { id: 1 }, params: { orgId: "1" } };
      const mockContext = createMockExecutionContext(request);
      const requiredPermissions = ["role.read"] as PermissionString[];
      jest.spyOn(reflector, "get").mockReturnValue(requiredPermissions);
      redisService.get.mockResolvedValue(null);
      featuresRepository.checkIfTeamHasFeature.mockResolvedValue(true);
      permissionCheckService.checkPermissions.mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(request.pbacAuthorizedRequest).toBe(true);
      expect(permissionCheckService.checkPermissions).toHaveBeenCalledWith({
        userId: 1,
        teamId: 1,
        permissions: requiredPermissions,
        fallbackRoles: [],
      });
    });

    it("should return true and set pbacAuthorizedRequest to false when user lacks required permissions", async () => {
      const request: Record<string, unknown> = { user: { id: 1 }, params: { orgId: "1" } };
      const mockContext = createMockExecutionContext(request);
      const requiredPermissions = ["role.read"] as PermissionString[];
      jest.spyOn(reflector, "get").mockReturnValue(requiredPermissions);
      redisService.get.mockResolvedValue(null);
      featuresRepository.checkIfTeamHasFeature.mockResolvedValue(true);
      permissionCheckService.checkPermissions.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(request.pbacAuthorizedRequest).toBe(false);
    });

    it("should use teamId when orgId is not provided", async () => {
      const request: Record<string, unknown> = { user: { id: 1 }, params: { teamId: "2" } };
      const mockContext = createMockExecutionContext(request);
      jest.spyOn(reflector, "get").mockReturnValue(["role.read"] as PermissionString[]);
      redisService.get.mockResolvedValue(null);
      featuresRepository.checkIfTeamHasFeature.mockResolvedValue(false);

      await guard.canActivate(mockContext);

      expect(featuresRepository.checkIfTeamHasFeature).toHaveBeenCalledWith(2, "pbac");
    });
  });

  describe("hasPbacEnabled", () => {
    it("should return cached value when available", async () => {
      redisService.get.mockResolvedValue(true);

      const result = await guard.hasPbacEnabled(1);

      expect(result).toBe(true);
      expect(featuresRepository.checkIfTeamHasFeature).not.toHaveBeenCalled();
    });

    it("should check feature repository and cache result when not cached", async () => {
      redisService.get.mockResolvedValue(null);
      featuresRepository.checkIfTeamHasFeature.mockResolvedValue(true);

      const result = await guard.hasPbacEnabled(1);

      expect(result).toBe(true);
      expect(featuresRepository.checkIfTeamHasFeature).toHaveBeenCalledWith(1, "pbac");
      expect(redisService.set).toHaveBeenCalledWith(REDIS_PBAC_CACHE_KEY(1), true, { ttl: 300_000 });
    });

    it("should not cache when PBAC is not enabled", async () => {
      redisService.get.mockResolvedValue(null);
      featuresRepository.checkIfTeamHasFeature.mockResolvedValue(false);

      const result = await guard.hasPbacEnabled(1);

      expect(result).toBe(false);
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe("checkUserHasRequiredPermissions", () => {
    it("should return cached value when available", async () => {
      const permissions = ["role.read"] as PermissionString[];
      redisService.get.mockResolvedValue(true);

      const result = await guard.checkUserHasRequiredPermissions(1, 1, permissions);

      expect(result).toBe(true);
      expect(permissionCheckService.checkPermissions).not.toHaveBeenCalled();
    });

    it("should check permissions and cache result when not cached", async () => {
      const permissions = ["role.read"] as PermissionString[];
      redisService.get.mockResolvedValue(null);
      permissionCheckService.checkPermissions.mockResolvedValue(true);

      const result = await guard.checkUserHasRequiredPermissions(1, 1, permissions);

      expect(result).toBe(true);
      expect(permissionCheckService.checkPermissions).toHaveBeenCalledWith({
        userId: 1,
        teamId: 1,
        permissions,
        fallbackRoles: [],
      });
      expect(redisService.set).toHaveBeenCalledWith(
        REDIS_REQUIRED_PERMISSIONS_CACHE_KEY(1, 1, permissions),
        true,
        { ttl: 300_000 }
      );
    });

    it("should not cache when user lacks permissions", async () => {
      const permissions = ["role.read"] as PermissionString[];
      redisService.get.mockResolvedValue(null);
      permissionCheckService.checkPermissions.mockResolvedValue(false);

      const result = await guard.checkUserHasRequiredPermissions(1, 1, permissions);

      expect(result).toBe(false);
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe("throwForbiddenError", () => {
    it("should throw ForbiddenException with teamId in message", () => {
      const permissions = ["role.read", "role.write"] as PermissionString[];

      expect(() => guard.throwForbiddenError(1, "2", "", permissions)).toThrow(
        "PbacGuard - user with id=1 does not have the minimum required permissions=role.read,role.write within team with id=2."
      );
    });

    it("should throw ForbiddenException with orgId in message", () => {
      const permissions = ["role.read"] as PermissionString[];

      expect(() => guard.throwForbiddenError(1, "", "3", permissions)).toThrow(
        "PbacGuard - user with id=1 does not have the minimum required permissions=role.read within organization with id=3."
      );
    });
  });

  function createMockExecutionContext(request: Record<string, unknown>): ExecutionContext {
    return createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
    });
  }
});
