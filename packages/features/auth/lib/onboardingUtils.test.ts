import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindById = vi.fn();
const mockCheckIfFeatureIsEnabledGlobally = vi.fn();

vi.mock("@calcom/features/flags/features.repository", () => {
  return {
    FeaturesRepository: class {
      checkIfFeatureIsEnabledGlobally = mockCheckIfFeatureIsEnabledGlobally;
    },
  };
});

vi.mock("@calcom/features/membership/repositories/MembershipRepository", () => ({
  MembershipRepository: {
    hasAnyTeamMembershipByUserId: vi.fn(),
    hasAcceptedOwnerTeamMembership: vi.fn(),
  },
}));

vi.mock("@calcom/features/profile/repositories/ProfileRepository", () => ({
  ProfileRepository: {
    findFirstForUserId: vi.fn(),
  },
}));

vi.mock("@calcom/features/users/repositories/UserRepository", () => {
  return {
    UserRepository: class {
      findById = mockFindById;
    },
  };
});

vi.mock("@calcom/prisma", () => ({
  prisma: {},
}));

import { MembershipRepository } from "@calcom/features/membership/repositories/MembershipRepository";

import { checkOnboardingRedirect } from "./onboardingUtils";

function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    completedOnboarding: false,
    createdDate: new Date("2024-01-01"),
    emailVerified: new Date(),
    identityProvider: "CAL",
    ...overrides,
  };
}

describe("checkOnboardingRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user is not found", async () => {
    mockFindById.mockResolvedValue(null);

    const result = await checkOnboardingRedirect(1);
    expect(result).toBeNull();
  });

  it("returns null when user has completedOnboarding=true", async () => {
    mockFindById.mockResolvedValue(createMockUser({ completedOnboarding: true }));

    const result = await checkOnboardingRedirect(1, { organizationId: null });
    expect(result).toBeNull();
  });

  it("returns null when user belongs to an organization", async () => {
    mockFindById.mockResolvedValue(createMockUser());

    const result = await checkOnboardingRedirect(1, { organizationId: 100 });
    expect(result).toBeNull();
  });

  it("redirects invited member (non-owner) to personal settings when onboarding-v3 is enabled", async () => {
    mockFindById.mockResolvedValue(createMockUser());
    mockCheckIfFeatureIsEnabledGlobally.mockResolvedValue(true);
    vi.mocked(MembershipRepository.hasAnyTeamMembershipByUserId).mockResolvedValue(true);
    vi.mocked(MembershipRepository.hasAcceptedOwnerTeamMembership).mockResolvedValue(false);

    const result = await checkOnboardingRedirect(1, { organizationId: null });
    expect(result).toBe("/onboarding/personal/settings");
  });

  it("returns null for team OWNER even when completedOnboarding is false", async () => {
    mockFindById.mockResolvedValue(createMockUser());
    mockCheckIfFeatureIsEnabledGlobally.mockResolvedValue(true);
    vi.mocked(MembershipRepository.hasAnyTeamMembershipByUserId).mockResolvedValue(true);
    vi.mocked(MembershipRepository.hasAcceptedOwnerTeamMembership).mockResolvedValue(true);

    const result = await checkOnboardingRedirect(1, { organizationId: null });
    expect(result).toBeNull();
  });

  it("redirects to getting-started when no team membership and onboarding-v3 enabled", async () => {
    mockFindById.mockResolvedValue(createMockUser());
    mockCheckIfFeatureIsEnabledGlobally.mockResolvedValue(true);
    vi.mocked(MembershipRepository.hasAnyTeamMembershipByUserId).mockResolvedValue(false);

    const result = await checkOnboardingRedirect(1, { organizationId: null });
    expect(result).toBe("/onboarding/getting-started");
  });

  it("redirects to getting-started (legacy) when onboarding-v3 is disabled", async () => {
    mockFindById.mockResolvedValue(createMockUser());
    mockCheckIfFeatureIsEnabledGlobally.mockResolvedValue(false);
    vi.mocked(MembershipRepository.hasAnyTeamMembershipByUserId).mockResolvedValue(false);

    const result = await checkOnboardingRedirect(1, { organizationId: null });
    expect(result).toBe("/getting-started");
  });

  it("does not check owner membership when user has no team membership", async () => {
    mockFindById.mockResolvedValue(createMockUser());
    mockCheckIfFeatureIsEnabledGlobally.mockResolvedValue(true);
    vi.mocked(MembershipRepository.hasAnyTeamMembershipByUserId).mockResolvedValue(false);

    await checkOnboardingRedirect(1, { organizationId: null });
    expect(MembershipRepository.hasAcceptedOwnerTeamMembership).not.toHaveBeenCalled();
  });
});
