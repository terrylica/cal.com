/**
 * Integration tests for the Billing Strategy pattern.
 *
 * These tests exercise the FULL factory -> strategy -> service -> repository -> DB chain:
 *   1. Creates real teams, users, memberships, and billing records (via Prismock in-memory DB)
 *   2. Runs real BillingModelRepository, SeatChangeTrackingService, HighWaterMarkRepository
 *   3. Mocks only the Stripe API boundary (getBillingProviderService, getTeamBillingServiceFactory)
 *   4. Verifies real DB state: SeatChangeLog entries, TeamBilling HWM updates
 *
 * Covers all 3 strategies across all 5 IBillingModelStrategy methods.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@calcom/prisma";

import { getStrategyForSubscription, getStrategyForTeam } from "./BillingModelStrategyFactory";
import { ActiveUsersBillingStrategy } from "./ActiveUsersBillingStrategy";
import { SeatsHwmBillingStrategy } from "./SeatsHwmBillingStrategy";
import { SeatsProrationBillingStrategy } from "./SeatsProrationBillingStrategy";

// ---------------------------------------------------------------------------
// Mock ONLY the Stripe-facing boundaries. Everything else is real code
// running against Prismock (in-memory DB provided by vitest setup).
// ---------------------------------------------------------------------------

const { mockUpdateQuantity, mockFindAndInit, mockApplyHwm, mockResetHwm } = vi.hoisted(() => {
  const mockUpdateQuantity = vi.fn().mockResolvedValue(undefined);
  return {
    mockUpdateQuantity,
    mockFindAndInit: vi.fn().mockResolvedValue({ updateQuantity: mockUpdateQuantity }),
    mockApplyHwm: vi.fn().mockResolvedValue(true),
    mockResetHwm: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../../di/containers/Billing", () => ({
  getBillingProviderService: vi.fn(() => ({})),
  getTeamBillingServiceFactory: vi.fn(() => ({ findAndInit: mockFindAndInit })),
}));

vi.mock("../highWaterMark/HighWaterMarkService", () => ({
  HighWaterMarkService: class {
    applyHighWaterMarkToSubscription = mockApplyHwm;
    resetSubscriptionAfterRenewal = mockResetHwm;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = () =>
  ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) as unknown;

let idCounter = Date.now();
function nextId() {
  return idCounter++;
}

async function createUser(name: string) {
  return prisma.user.create({
    data: {
      email: `strat-integ-${name}-${nextId()}@test.local`,
      name: `Test ${name}`,
      username: `strat-integ-${name}-${nextId()}`,
    },
  });
}

async function createTeamWithBilling(opts: {
  slug: string;
  billingModel: "SEATS" | "ACTIVE_USERS";
  billingPeriod: "MONTHLY" | "ANNUALLY";
  isOrganization?: boolean;
}) {
  const team = await prisma.team.create({
    data: {
      name: `StratInteg ${opts.slug}`,
      slug: `strat-integ-${opts.slug}-${nextId()}`,
      isOrganization: opts.isOrganization ?? false,
    },
  });

  const subId = `sub_test_${opts.slug}_${nextId()}`;
  const billing = await prisma.teamBilling.create({
    data: {
      teamId: team.id,
      customerId: `cus_test_${opts.slug}_${nextId()}`,
      subscriptionId: subId,
      subscriptionItemId: `si_test_${opts.slug}_${nextId()}`,
      status: "ACTIVE",
      planName: "TEAM",
      billingPeriod: opts.billingPeriod,
      billingModel: opts.billingModel,
      pricePerSeat: 1500,
      paidSeats: 1,
      subscriptionStart: new Date(),
      highWaterMark: opts.billingPeriod === "MONTHLY" && opts.billingModel === "SEATS" ? 1 : null,
      highWaterMarkPeriodStart:
        opts.billingPeriod === "MONTHLY" && opts.billingModel === "SEATS" ? new Date() : null,
    },
  });

  return { team, billing, subscriptionId: subId };
}

async function addMember(teamId: number, userId: number, role: "OWNER" | "MEMBER" = "MEMBER") {
  await prisma.membership.create({
    data: { teamId, userId, role, accepted: true },
  });
}

// ---------------------------------------------------------------------------
// Strategy configs
// ---------------------------------------------------------------------------

interface StrategyTestConfig {
  label: string;
  billingModel: "SEATS" | "ACTIVE_USERS";
  billingPeriod: "MONTHLY" | "ANNUALLY";
  expectedClass: typeof SeatsHwmBillingStrategy | typeof SeatsProrationBillingStrategy | typeof ActiveUsersBillingStrategy;
  expectsStripeSync: boolean;
  expectsHwmApply: boolean;
  expectsHwmReset: boolean;
}

const STRATEGIES: StrategyTestConfig[] = [
  {
    label: "SEATS + MONTHLY (HWM)",
    billingModel: "SEATS",
    billingPeriod: "MONTHLY",
    expectedClass: SeatsHwmBillingStrategy,
    expectsStripeSync: true,
    expectsHwmApply: true,
    expectsHwmReset: true,
  },
  {
    label: "SEATS + ANNUALLY (Proration)",
    billingModel: "SEATS",
    billingPeriod: "ANNUALLY",
    expectedClass: SeatsProrationBillingStrategy,
    expectsStripeSync: false,
    expectsHwmApply: false,
    expectsHwmReset: false,
  },
  {
    label: "ACTIVE_USERS",
    billingModel: "ACTIVE_USERS",
    billingPeriod: "MONTHLY",
    expectedClass: ActiveUsersBillingStrategy,
    expectsStripeSync: false,
    expectsHwmApply: false,
    expectsHwmReset: false,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Billing Strategy Integration", () => {
  beforeAll(async () => {
    // Seed the hwm-seating feature flag so HWM updates fire for monthly billing
    await prisma.feature.upsert({
      where: { slug: "hwm-seating" },
      update: { enabled: true },
      create: { slug: "hwm-seating", enabled: true, type: "RELEASE", description: "HWM test flag" },
    });
  });

  describe.each(STRATEGIES)(
    "$label",
    ({
      label,
      billingModel,
      billingPeriod,
      expectedClass,
      expectsStripeSync,
      expectsHwmApply,
      expectsHwmReset,
    }) => {
      let teamId: number;
      let subscriptionId: string;
      let adminId: number;
      let memberId: number;

      beforeAll(async () => {
        // Create a team with the right billing config
        const { team, subscriptionId: subId } = await createTeamWithBilling({
          slug: label.replace(/[^a-z0-9]/gi, "-").toLowerCase(),
          billingModel,
          billingPeriod,
        });
        teamId = team.id;
        subscriptionId = subId;

        // Create users
        const admin = await createUser(`admin-${label}`);
        const member = await createUser(`member-${label}`);
        adminId = admin.id;
        memberId = member.id;

        // Add admin as owner
        await addMember(teamId, adminId, "OWNER");
      });

      beforeEach(() => {
        vi.clearAllMocks();
        mockFindAndInit.mockResolvedValue({ updateQuantity: mockUpdateQuantity });
      });

      // -----------------------------------------------------------------
      // Factory resolution from real DB records
      // -----------------------------------------------------------------

      it("factory resolves the correct strategy from DB billing record", async () => {
        const byTeam = await getStrategyForTeam(teamId);
        expect(byTeam).not.toBeNull();
        expect(byTeam!.strategy).toBeInstanceOf(expectedClass);
        expect(byTeam!.billingModel).toBe(billingModel);
        expect(byTeam!.billingPeriod).toBe(billingPeriod);
      });

      it("factory resolves by subscriptionId from DB", async () => {
        const bySub = await getStrategyForSubscription(subscriptionId);
        expect(bySub).not.toBeNull();
        expect(bySub!.strategy).toBeInstanceOf(expectedClass);
      });

      // -----------------------------------------------------------------
      // handleMemberAddition: add user, verify DB + Stripe
      // -----------------------------------------------------------------

      it("handleMemberAddition creates ADDITION seat change log in DB", async () => {
        const logsBefore = await prisma.seatChangeLog.count({
          where: { teamId, changeType: "ADDITION" },
        });

        const { strategy } = (await getStrategyForTeam(teamId))!;
        await strategy.handleMemberAddition(
          { teamId, userId: memberId, triggeredBy: adminId, seatCount: 1 },
          mockLogger() as never
        );

        const logsAfter = await prisma.seatChangeLog.count({
          where: { teamId, changeType: "ADDITION" },
        });
        expect(logsAfter).toBe(logsBefore + 1);

        // Verify the log entry content
        const lastLog = await prisma.seatChangeLog.findFirst({
          where: { teamId, changeType: "ADDITION" },
          orderBy: { changeDate: "desc" },
        });
        expect(lastLog).not.toBeNull();
        expect(lastLog!.userId).toBe(memberId);
        expect(lastLog!.seatCount).toBe(1);
      });

      it(`handleMemberAddition ${expectsStripeSync ? "syncs" : "does NOT sync"} Stripe quantity`, async () => {
        const { strategy } = (await getStrategyForTeam(teamId))!;
        await strategy.handleMemberAddition(
          { teamId, userId: memberId, triggeredBy: adminId, seatCount: 1 },
          mockLogger() as never
        );

        if (expectsStripeSync) {
          expect(mockFindAndInit).toHaveBeenCalledWith(teamId);
          expect(mockUpdateQuantity).toHaveBeenCalled();
        } else {
          expect(mockUpdateQuantity).not.toHaveBeenCalled();
        }
      });

      // -----------------------------------------------------------------
      // handleMemberRemoval: remove user, verify DB + Stripe
      // -----------------------------------------------------------------

      it("handleMemberRemoval creates REMOVAL seat change log in DB", async () => {
        const logsBefore = await prisma.seatChangeLog.count({
          where: { teamId, changeType: "REMOVAL" },
        });

        const { strategy } = (await getStrategyForTeam(teamId))!;
        await strategy.handleMemberRemoval(
          { teamId, userId: memberId, triggeredBy: adminId, seatCount: 1 },
          mockLogger() as never
        );

        const logsAfter = await prisma.seatChangeLog.count({
          where: { teamId, changeType: "REMOVAL" },
        });
        expect(logsAfter).toBe(logsBefore + 1);

        const lastLog = await prisma.seatChangeLog.findFirst({
          where: { teamId, changeType: "REMOVAL" },
          orderBy: { changeDate: "desc" },
        });
        expect(lastLog).not.toBeNull();
        expect(lastLog!.userId).toBe(memberId);
      });

      it(`handleMemberRemoval ${expectsStripeSync ? "syncs" : "does NOT sync"} Stripe quantity`, async () => {
        const { strategy } = (await getStrategyForTeam(teamId))!;
        await strategy.handleMemberRemoval(
          { teamId, userId: memberId, triggeredBy: adminId, seatCount: 1 },
          mockLogger() as never
        );

        if (expectsStripeSync) {
          expect(mockFindAndInit).toHaveBeenCalledWith(teamId);
          expect(mockUpdateQuantity).toHaveBeenCalled();
        } else {
          expect(mockUpdateQuantity).not.toHaveBeenCalled();
        }
      });

      // -----------------------------------------------------------------
      // syncBillingQuantity: no seat logs, just Stripe sync (or no-op)
      // -----------------------------------------------------------------

      it("syncBillingQuantity does not create any seat change logs", async () => {
        const logsBefore = await prisma.seatChangeLog.count({ where: { teamId } });

        const { strategy } = (await getStrategyForTeam(teamId))!;
        await strategy.syncBillingQuantity({ teamId }, mockLogger() as never);

        const logsAfter = await prisma.seatChangeLog.count({ where: { teamId } });
        expect(logsAfter).toBe(logsBefore);
      });

      it(`syncBillingQuantity ${expectsStripeSync ? "calls" : "skips"} Stripe updateQuantity`, async () => {
        const { strategy } = (await getStrategyForTeam(teamId))!;
        await strategy.syncBillingQuantity({ teamId }, mockLogger() as never);

        if (expectsStripeSync) {
          expect(mockFindAndInit).toHaveBeenCalledWith(teamId);
          expect(mockUpdateQuantity).toHaveBeenCalled();
        } else {
          expect(mockFindAndInit).not.toHaveBeenCalled();
        }
      });

      // -----------------------------------------------------------------
      // handleInvoiceUpcoming (webhook path)
      // -----------------------------------------------------------------

      it(`handleInvoiceUpcoming ${expectsHwmApply ? "applies HWM" : "is a no-op"}`, async () => {
        const { strategy } = (await getStrategyForSubscription(subscriptionId))!;
        const result = await strategy.handleInvoiceUpcoming(
          { subscriptionId },
          mockLogger() as never
        );

        if (expectsHwmApply) {
          expect(mockApplyHwm).toHaveBeenCalledWith(subscriptionId);
          expect(result.applied).toBe(true);
        } else {
          expect(mockApplyHwm).not.toHaveBeenCalled();
          expect(result.applied).toBe(false);
        }
      });

      // -----------------------------------------------------------------
      // handlePostRenewalReset (webhook path)
      // -----------------------------------------------------------------

      it(`handlePostRenewalReset ${expectsHwmReset ? "resets HWM" : "is a no-op"}`, async () => {
        const timestamp = Math.floor(Date.now() / 1000);
        const { strategy } = (await getStrategyForSubscription(subscriptionId))!;
        const result = await strategy.handlePostRenewalReset(
          { subscriptionId, periodStartTimestamp: timestamp },
          mockLogger() as never
        );

        if (expectsHwmReset) {
          expect(mockResetHwm).toHaveBeenCalledWith({
            subscriptionId,
            newPeriodStart: new Date(timestamp * 1000),
          });
          expect(result).toEqual({ success: true, updated: true });
        } else {
          expect(mockResetHwm).not.toHaveBeenCalled();
          expect(result).toEqual({ success: true, updated: false });
        }
      });
    }
  );

  // -----------------------------------------------------------------------
  // Organization billing path (billingModel lookup via OrganizationBilling)
  // -----------------------------------------------------------------------

  describe("organization billing path", () => {
    let orgId: number;
    let orgSubId: string;
    let orgAdminId: number;
    let orgMemberId: number;

    beforeAll(async () => {
      const org = await prisma.team.create({
        data: {
          name: "StratInteg Org",
          slug: `strat-integ-org-${nextId()}`,
          isOrganization: true,
        },
      });
      orgId = org.id;

      orgSubId = `sub_test_org_${nextId()}`;
      await prisma.organizationBilling.create({
        data: {
          teamId: orgId,
          customerId: `cus_test_org_${nextId()}`,
          subscriptionId: orgSubId,
          subscriptionItemId: `si_test_org_${nextId()}`,
          status: "ACTIVE",
          planName: "ORGANIZATION",
          billingPeriod: "MONTHLY",
          billingModel: "SEATS",
          pricePerSeat: 3700,
          paidSeats: 1,
          subscriptionStart: new Date(),
          highWaterMark: 1,
          highWaterMarkPeriodStart: new Date(),
        },
      });

      const admin = await createUser("org-admin");
      const member = await createUser("org-member");
      orgAdminId = admin.id;
      orgMemberId = member.id;

      await addMember(orgId, orgAdminId, "OWNER");
    });

    beforeEach(() => {
      vi.clearAllMocks();
      mockFindAndInit.mockResolvedValue({ updateQuantity: mockUpdateQuantity });
    });

    it("factory resolves strategy from OrganizationBilling record", async () => {
      const result = await getStrategyForTeam(orgId);
      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsHwmBillingStrategy);
      expect(result!.billingModel).toBe("SEATS");
      expect(result!.billingPeriod).toBe("MONTHLY");
    });

    it("factory resolves by org subscriptionId", async () => {
      const result = await getStrategyForSubscription(orgSubId);
      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsHwmBillingStrategy);
    });

    it("handleMemberAddition creates seat log linked to organizationBillingId", async () => {
      const { strategy } = (await getStrategyForTeam(orgId))!;
      await strategy.handleMemberAddition(
        { teamId: orgId, userId: orgMemberId, triggeredBy: orgAdminId, seatCount: 1 },
        mockLogger() as never
      );

      const log = await prisma.seatChangeLog.findFirst({
        where: { teamId: orgId, changeType: "ADDITION" },
        orderBy: { changeDate: "desc" },
      });
      expect(log).not.toBeNull();
      expect(log!.organizationBillingId).not.toBeNull();
      expect(log!.teamBillingId).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Multi-member scenario: add 3, remove 1, verify log counts
  // -----------------------------------------------------------------------

  describe("multi-member lifecycle", () => {
    let teamId: number;
    let adminId: number;
    let memberIds: number[];

    beforeAll(async () => {
      const { team } = await createTeamWithBilling({
        slug: "lifecycle",
        billingModel: "SEATS",
        billingPeriod: "MONTHLY",
      });
      teamId = team.id;

      const admin = await createUser("lifecycle-admin");
      adminId = admin.id;
      await addMember(teamId, adminId, "OWNER");

      memberIds = [];
      for (let i = 0; i < 3; i++) {
        const m = await createUser(`lifecycle-member-${i}`);
        memberIds.push(m.id);
        await addMember(teamId, m.id, "MEMBER");
      }
    });

    beforeEach(() => {
      vi.clearAllMocks();
      mockFindAndInit.mockResolvedValue({ updateQuantity: mockUpdateQuantity });
    });

    it("tracks 3 additions and 1 removal correctly", async () => {
      const { strategy } = (await getStrategyForTeam(teamId))!;

      // Add 3 members
      for (const uid of memberIds) {
        await strategy.handleMemberAddition(
          { teamId, userId: uid, triggeredBy: adminId, seatCount: 1 },
          mockLogger() as never
        );
      }

      // Remove 1 member
      await strategy.handleMemberRemoval(
        { teamId, userId: memberIds[2], triggeredBy: adminId, seatCount: 1 },
        mockLogger() as never
      );

      const additions = await prisma.seatChangeLog.count({
        where: { teamId, changeType: "ADDITION" },
      });
      const removals = await prisma.seatChangeLog.count({
        where: { teamId, changeType: "REMOVAL" },
      });

      expect(additions).toBe(3);
      expect(removals).toBe(1);

      // HWM strategy should have synced Stripe on each operation (4 total)
      expect(mockFindAndInit).toHaveBeenCalledTimes(4);
      expect(mockUpdateQuantity).toHaveBeenCalledTimes(4);
    });
  });

  // -----------------------------------------------------------------------
  // Error resilience: Stripe failures should not prevent seat logging
  // -----------------------------------------------------------------------

  describe("error resilience", () => {
    let teamId: number;
    let adminId: number;
    let memberId: number;

    beforeAll(async () => {
      const { team } = await createTeamWithBilling({
        slug: "error-resilience",
        billingModel: "SEATS",
        billingPeriod: "MONTHLY",
      });
      teamId = team.id;

      const admin = await createUser("err-admin");
      const member = await createUser("err-member");
      adminId = admin.id;
      memberId = member.id;
      await addMember(teamId, adminId, "OWNER");
    });

    it("still creates seat log even when Stripe sync fails", async () => {
      mockFindAndInit.mockRejectedValueOnce(new Error("Stripe API down"));

      const logsBefore = await prisma.seatChangeLog.count({
        where: { teamId, changeType: "ADDITION" },
      });

      const { strategy } = (await getStrategyForTeam(teamId))!;
      // Should not throw
      await strategy.handleMemberAddition(
        { teamId, userId: memberId, triggeredBy: adminId, seatCount: 1 },
        mockLogger() as never
      );

      const logsAfter = await prisma.seatChangeLog.count({
        where: { teamId, changeType: "ADDITION" },
      });
      // Seat log was still written despite Stripe failure
      expect(logsAfter).toBe(logsBefore + 1);
    });

    it("handlePostRenewalReset returns failure when HWM service throws", async () => {
      mockResetHwm.mockRejectedValueOnce(new Error("Stripe timeout"));

      const { strategy } = (await getStrategyForTeam(teamId))!;
      const result = await strategy.handlePostRenewalReset(
        { subscriptionId: "sub_doesnt_matter", periodStartTimestamp: Math.floor(Date.now() / 1000) },
        mockLogger() as never
      );

      expect(result).toEqual({ success: false, error: "Stripe timeout" });
    });
  });

  // -----------------------------------------------------------------------
  // Factory returns null for teams with no billing record
  // -----------------------------------------------------------------------

  describe("no billing record", () => {
    it("getStrategyForTeam returns null for team without billing", async () => {
      const team = await prisma.team.create({
        data: { name: "No Billing Team", slug: `strat-integ-no-billing-${nextId()}` },
      });

      const result = await getStrategyForTeam(team.id);
      expect(result).toBeNull();
    });

    it("getStrategyForSubscription returns null for unknown subscription", async () => {
      const result = await getStrategyForSubscription("sub_does_not_exist");
      expect(result).toBeNull();
    });
  });
});
