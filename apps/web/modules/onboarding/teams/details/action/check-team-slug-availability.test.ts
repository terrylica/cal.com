import prismock from "@calcom/testing/lib/__mocks__/prisma";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { ProfileRepository } from "@calcom/features/profile/repositories/ProfileRepository";
import { MembershipRole } from "@calcom/prisma/enums";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import { checkTeamSlugAvailability } from "./check-team-slug-availability";

// Mock the dependencies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({})),
  headers: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@calcom/features/auth/lib/getServerSession", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@lib/buildLegacyCtx", () => ({
  buildLegacyRequest: vi.fn(() => ({})),
}));

vi.mock("@calcom/features/profile/repositories/ProfileRepository", () => ({
  ProfileRepository: {
    findByOrgIdAndUsername: vi.fn(),
  },
}));

const mockedGetServerSession = getServerSession as MockedFunction<typeof getServerSession>;
const mockedFindByOrgIdAndUsername = ProfileRepository.findByOrgIdAndUsername as MockedFunction<
  typeof ProfileRepository.findByOrgIdAndUsername
>;

describe("checkTeamSlugAvailability", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // @ts-expect-error reset is a method on Prismock
    await prismock.reset();
  });

  const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    expires: "2025-01-01",
    hasValidLicense: true,
    user: {
      id: 123,
      uuid: "test-uuid-123",
      email: "test@example.com",
      name: "Test User",
      profile: {
        id: 789,
        upId: "usr-123",
        username: "testuser",
        organizationId: null,
        organization: null,
      },
    },
    profileId: 789,
    upId: "usr-123",
    ...overrides,
  });

  const createOrgMockSession = (organizationId: number): Session =>
    createMockSession({
      user: {
        id: 123,
        uuid: "test-uuid-123",
        email: "test@example.com",
        name: "Test User",
        org: {
          id: organizationId,
          name: "Test Org",
          slug: "test-org",
          logoUrl: null,
          fullDomain: "test-org.cal.com",
          domainSuffix: "cal.com",
          role: MembershipRole.ADMIN,
        },
        profile: {
          id: 789,
          upId: "usr-123",
          username: "testuser",
          organizationId: organizationId,
          organization: {
            id: organizationId,
            name: "Test Org",
            slug: "test-org",
            calVideoLogo: null,
            bannerUrl: null,
            requestedSlug: null,
          },
        },
      },
    });

  describe("input validation", () => {
    it("should return unavailable for empty slug", async () => {
      const result = await checkTeamSlugAvailability("");

      expect(result).toEqual({
        available: false,
        message: "Slug is required",
      });
    });

    it("should return unavailable for whitespace-only slug", async () => {
      const result = await checkTeamSlugAvailability("   ");

      expect(result).toEqual({
        available: false,
        message: "Slug is required",
      });
    });
  });

  describe("authentication", () => {
    it("should return unauthorized when session is null", async () => {
      mockedGetServerSession.mockResolvedValue(null);

      const result = await checkTeamSlugAvailability("my-team");

      expect(result).toEqual({
        available: false,
        message: "Unauthorized",
      });
    });

    it("should return unauthorized when user has no id", async () => {
      const mockSession = createMockSession({
        user: {
          id: undefined as unknown as number,
          uuid: "test-uuid",
          email: "test@example.com",
          name: "Test",
        },
      });
      mockedGetServerSession.mockResolvedValue(mockSession);

      const result = await checkTeamSlugAvailability("my-team");

      expect(result).toEqual({
        available: false,
        message: "Unauthorized",
      });
    });
  });

  describe("non-organization users (parentId = null)", () => {
    it("should return available when slug does not exist at top level", async () => {
      const mockSession = createMockSession();
      mockedGetServerSession.mockResolvedValue(mockSession);

      const result = await checkTeamSlugAvailability("new-team");

      expect(result).toEqual({ available: true });
    });

    it("should return unavailable when slug exists at top level", async () => {
      const mockSession = createMockSession();
      mockedGetServerSession.mockResolvedValue(mockSession);

      // Create a top-level team with the same slug
      await prismock.team.create({
        data: {
          name: "Existing Team",
          slug: "existing-team",
          parentId: null,
        },
      });

      const result = await checkTeamSlugAvailability("existing-team");

      expect(result).toEqual({
        available: false,
        message: "This slug is already taken",
      });
    });

    it("should return available when slug exists in an organization but not at top level", async () => {
      const mockSession = createMockSession();
      mockedGetServerSession.mockResolvedValue(mockSession);

      // Create an organization
      const org = await prismock.team.create({
        data: {
          name: "Some Org",
          slug: "some-org",
          parentId: null,
          isOrganization: true,
        },
      });

      // Create a team inside the organization with the slug
      await prismock.team.create({
        data: {
          name: "Team In Org",
          slug: "team-slug",
          parentId: org.id,
        },
      });

      // Non-org user should be able to use the same slug at top level
      const result = await checkTeamSlugAvailability("team-slug");

      expect(result).toEqual({ available: true });
    });
  });

  describe("organization users (parentId = organizationId)", () => {
    it("should return available when slug does not exist within the organization", async () => {
      const organizationId = 456;
      const mockSession = createOrgMockSession(organizationId);
      mockedGetServerSession.mockResolvedValue(mockSession);
      mockedFindByOrgIdAndUsername.mockResolvedValue(null);

      // Create the organization
      await prismock.team.create({
        data: {
          id: organizationId,
          name: "Test Org",
          slug: "test-org",
          parentId: null,
          isOrganization: true,
        },
      });

      const result = await checkTeamSlugAvailability("new-team");

      expect(result).toEqual({ available: true });
    });

    it("should return unavailable when slug exists within the same organization", async () => {
      const organizationId = 456;
      const mockSession = createOrgMockSession(organizationId);
      mockedGetServerSession.mockResolvedValue(mockSession);

      // Create the organization
      await prismock.team.create({
        data: {
          id: organizationId,
          name: "Test Org",
          slug: "test-org",
          parentId: null,
          isOrganization: true,
        },
      });

      // Create a team inside this organization with the same slug
      await prismock.team.create({
        data: {
          name: "Existing Team",
          slug: "existing-team",
          parentId: organizationId,
        },
      });

      const result = await checkTeamSlugAvailability("existing-team");

      expect(result).toEqual({
        available: false,
        message: "This slug is already taken",
      });
    });

    it("should return available when slug exists in a DIFFERENT organization", async () => {
      const myOrgId = 456;
      const otherOrgId = 789;
      const mockSession = createOrgMockSession(myOrgId);
      mockedGetServerSession.mockResolvedValue(mockSession);
      mockedFindByOrgIdAndUsername.mockResolvedValue(null);

      // Create my organization
      await prismock.team.create({
        data: {
          id: myOrgId,
          name: "My Org",
          slug: "my-org",
          parentId: null,
          isOrganization: true,
        },
      });

      // Create another organization
      await prismock.team.create({
        data: {
          id: otherOrgId,
          name: "Other Org",
          slug: "other-org",
          parentId: null,
          isOrganization: true,
        },
      });

      // Create a team in the OTHER organization with the slug
      await prismock.team.create({
        data: {
          name: "Team In Other Org",
          slug: "shared-slug",
          parentId: otherOrgId,
        },
      });

      // Should be available because slug doesn't exist in MY organization
      const result = await checkTeamSlugAvailability("shared-slug");

      expect(result).toEqual({ available: true });
    });

    it("should return unavailable when slug conflicts with a username in the organization", async () => {
      const organizationId = 456;
      const mockSession = createOrgMockSession(organizationId);
      mockedGetServerSession.mockResolvedValue(mockSession);

      // Create the organization
      await prismock.team.create({
        data: {
          id: organizationId,
          name: "Test Org",
          slug: "test-org",
          parentId: null,
          isOrganization: true,
        },
      });

      // Mock that the slug matches a user's profile username in the org
      mockedFindByOrgIdAndUsername.mockResolvedValue({
        id: 999,
        uid: "uid-999",
        userId: 111,
        username: "john",
        organizationId: organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        movedFromUserId: null,
        organization: null,
        user: null,
      } as Awaited<ReturnType<typeof ProfileRepository.findByOrgIdAndUsername>>);

      const result = await checkTeamSlugAvailability("john");

      expect(mockedFindByOrgIdAndUsername).toHaveBeenCalledWith({
        organizationId: organizationId,
        username: "john",
      });
      expect(result).toEqual({
        available: false,
        message: "This slug is already taken by a user",
      });
    });

    it("should NOT check for username conflicts for non-org users", async () => {
      const mockSession = createMockSession(); // Non-org user
      mockedGetServerSession.mockResolvedValue(mockSession);

      const result = await checkTeamSlugAvailability("some-slug");

      // ProfileRepository should NOT be called for non-org users
      expect(mockedFindByOrgIdAndUsername).not.toHaveBeenCalled();
      expect(result).toEqual({ available: true });
    });
  });

  describe("edge cases", () => {
    it("should handle slug that exists at top level but user is in an org", async () => {
      const organizationId = 456;
      const mockSession = createOrgMockSession(organizationId);
      mockedGetServerSession.mockResolvedValue(mockSession);
      mockedFindByOrgIdAndUsername.mockResolvedValue(null);

      // Create the organization
      await prismock.team.create({
        data: {
          id: organizationId,
          name: "Test Org",
          slug: "test-org",
          parentId: null,
          isOrganization: true,
        },
      });

      // Create a top-level team with the slug
      await prismock.team.create({
        data: {
          name: "Top Level Team",
          slug: "top-level-slug",
          parentId: null,
        },
      });

      // Org user should be able to use this slug within their org
      const result = await checkTeamSlugAvailability("top-level-slug");

      expect(result).toEqual({ available: true });
    });
  });
});
