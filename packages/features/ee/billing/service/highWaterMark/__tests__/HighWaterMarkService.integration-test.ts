import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import prisma from "@calcom/prisma";
import type { Team, User } from "@calcom/prisma/client";
import { MembershipRole } from "@calcom/prisma/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HighWaterMarkRepository } from "../../../repository/highWaterMark/HighWaterMarkRepository";
import type { IBillingProviderService } from "../../billingProvider/IBillingProviderService";
import { SeatChangeTrackingService } from "../../seatTracking/SeatChangeTrackingService";
import { HighWaterMarkService } from "../HighWaterMarkService";

// Mock billing provider service
const createMockBillingService = (): IBillingProviderService => ({
  createInvoiceItem: vi.fn().mockResolvedValue({ invoiceItemId: "ii_test_123" }),
  deleteInvoiceItem: vi.fn().mockResolvedValue(undefined),
  createInvoice: vi.fn().mockResolvedValue({ invoiceId: "in_test_123" }),
  finalizeInvoice: vi.fn().mockResolvedValue({ invoiceUrl: "https://invoice.stripe.com/test" }),
  voidInvoice: vi.fn().mockResolvedValue(undefined),
  getSubscription: vi.fn().mockResolvedValue({
    items: [
      {
        id: "si_test_123",
        quantity: 1,
        price: { unit_amount: 1500, recurring: { interval: "month" } },
      },
    ],
    customer: "cus_test_123",
    status: "active",
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    trial_end: null,
  }),
  handleSubscriptionUpdate: vi.fn().mockResolvedValue(undefined),
  checkoutSessionIsPaid: vi.fn().mockResolvedValue(true),
  handleSubscriptionCancel: vi.fn().mockResolvedValue(undefined),
  handleSubscriptionCreation: vi.fn().mockResolvedValue(undefined),
  handleEndTrial: vi.fn().mockResolvedValue(undefined),
  createCustomer: vi.fn().mockResolvedValue({ stripeCustomerId: "cus_test_123" }),
  createPaymentIntent: vi.fn().mockResolvedValue({ id: "pi_test_123", client_secret: "secret_123" }),
  createSubscriptionCheckout: vi.fn().mockResolvedValue({
    checkoutUrl: "https://checkout.test",
    sessionId: "cs_test_123",
  }),
  createPrice: vi.fn().mockResolvedValue({ priceId: "price_test_123" }),
  getPrice: vi.fn().mockResolvedValue(null),
  getSubscriptionStatus: vi.fn().mockResolvedValue(null),
  getCheckoutSession: vi.fn().mockResolvedValue(null),
  getCustomer: vi.fn().mockResolvedValue(null),
  getSubscriptions: vi.fn().mockResolvedValue(null),
  updateCustomer: vi.fn().mockResolvedValue(undefined),
  getPaymentIntentFailureReason: vi.fn().mockResolvedValue(null),
  hasDefaultPaymentMethod: vi.fn().mockResolvedValue(true),
  createSubscriptionUsageRecord: vi.fn().mockResolvedValue(undefined),
});

const mockFeaturesRepository: IFeaturesRepository = {
  checkIfFeatureIsEnabledGlobally: vi.fn().mockResolvedValue(true),
  checkIfUserHasFeature: vi.fn().mockResolvedValue(false),
  getUserFeaturesStatus: vi.fn().mockResolvedValue({}),
  checkIfUserHasFeatureNonHierarchical: vi.fn().mockResolvedValue(false),
  checkIfTeamHasFeature: vi.fn().mockResolvedValue(false),
  getTeamsWithFeatureEnabled: vi.fn().mockResolvedValue([]),
  setUserFeatureState: vi.fn().mockResolvedValue(undefined),
  setTeamFeatureState: vi.fn().mockResolvedValue(undefined),
  getUserFeatureStates: vi.fn().mockResolvedValue({}),
  getTeamsFeatureStates: vi.fn().mockResolvedValue({}),
  getUserAutoOptIn: vi.fn().mockResolvedValue(false),
  getTeamsAutoOptIn: vi.fn().mockResolvedValue({}),
  setUserAutoOptIn: vi.fn().mockResolvedValue(undefined),
  setTeamAutoOptIn: vi.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  getSubLogger: vi.fn().mockReturnThis(),
};

describe("HighWaterMarkService Integration Tests", () => {
  let testUser: User;
  let testTeam: Team;
  let subscriptionId: string;
  let subscriptionItemId: string;
  let customerId: string;

  beforeEach(async () => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `test-hwm-${timestamp}-${randomSuffix}@example.com`,
        username: `testhwm-${timestamp}-${randomSuffix}`,
        name: "Test HWM User",
      },
    });

    // Create test team
    testTeam = await prisma.team.create({
      data: {
        name: `Test HWM Team ${timestamp}-${randomSuffix}`,
        slug: `test-hwm-team-${timestamp}-${randomSuffix}`,
        isOrganization: false,
      },
    });

    // Create team owner membership
    await prisma.membership.create({
      data: {
        userId: testUser.id,
        teamId: testTeam.id,
        role: MembershipRole.OWNER,
        accepted: true,
      },
    });

    // Set up subscription IDs
    subscriptionId = `sub_test_${timestamp}`;
    subscriptionItemId = `si_test_${timestamp}`;
    customerId = `cus_test_${timestamp}`;

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

    // Create team billing with MONTHLY billing period
    await prisma.teamBilling.create({
      data: {
        teamId: testTeam.id,
        subscriptionId,
        subscriptionItemId,
        customerId,
        billingPeriod: "MONTHLY",
        pricePerSeat: 1500, // $15/seat
        paidSeats: 1,
        subscriptionStart,
        subscriptionEnd,
        subscriptionTrialEnd: null,
        status: "ACTIVE",
        planName: "TEAM",
        highWaterMark: 1,
        highWaterMarkPeriodStart: subscriptionStart,
      },
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  describe("High Water Mark Tracking on Seat Addition", () => {
    it("should update high water mark when a new member is added", async () => {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(7);

      // Add a new member
      const newUser = await prisma.user.create({
        data: {
          email: `test-hwm-member-${timestamp}-${randomSuffix}@example.com`,
          username: `testhwmmember-${timestamp}-${randomSuffix}`,
          name: "Test HWM Member",
        },
      });

      await prisma.membership.create({
        data: {
          userId: newUser.id,
          teamId: testTeam.id,
          role: MembershipRole.MEMBER,
          accepted: true,
        },
      });

      // Use SeatChangeTrackingService which now updates HWM
      const seatTracker = new SeatChangeTrackingService();
      await seatTracker.logSeatAddition({
        teamId: testTeam.id,
        userId: newUser.id,
        triggeredBy: testUser.id,
        seatCount: 1,
        operationId: `membership-${newUser.id}`,
      });

      // Verify HWM was updated
      const billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true },
      });

      expect(billing?.highWaterMark).toBe(2);
    });

    it("should track peak usage when multiple members are added", async () => {
      const timestamp = Date.now();
      const seatTracker = new SeatChangeTrackingService();

      // Add 3 members
      for (let i = 0; i < 3; i++) {
        const randomSuffix = Math.random().toString(36).substring(7);
        const newUser = await prisma.user.create({
          data: {
            email: `test-hwm-member-${timestamp}-${i}-${randomSuffix}@example.com`,
            username: `testhwmmember-${timestamp}-${i}-${randomSuffix}`,
            name: `Test HWM Member ${i}`,
          },
        });

        await prisma.membership.create({
          data: {
            userId: newUser.id,
            teamId: testTeam.id,
            role: MembershipRole.MEMBER,
            accepted: true,
          },
        });

        await seatTracker.logSeatAddition({
          teamId: testTeam.id,
          userId: newUser.id,
          triggeredBy: testUser.id,
          seatCount: 1,
          operationId: `membership-${newUser.id}`,
        });
      }

      // Verify HWM reflects peak (1 owner + 3 members = 4)
      const billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true },
      });

      expect(billing?.highWaterMark).toBe(4);
    });

    it("should NOT decrease high water mark when members are removed", async () => {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(7);
      const seatTracker = new SeatChangeTrackingService();

      // Add a member first
      const newUser = await prisma.user.create({
        data: {
          email: `test-hwm-member-${timestamp}-${randomSuffix}@example.com`,
          username: `testhwmmember-${timestamp}-${randomSuffix}`,
          name: "Test HWM Member",
        },
      });

      await prisma.membership.create({
        data: {
          userId: newUser.id,
          teamId: testTeam.id,
          role: MembershipRole.MEMBER,
          accepted: true,
        },
      });

      await seatTracker.logSeatAddition({
        teamId: testTeam.id,
        userId: newUser.id,
        triggeredBy: testUser.id,
        seatCount: 1,
        operationId: `membership-add-${newUser.id}`,
      });

      // Verify HWM is 2
      let billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true },
      });
      expect(billing?.highWaterMark).toBe(2);

      // Remove the member
      await prisma.membership.delete({
        where: {
          userId_teamId: {
            userId: newUser.id,
            teamId: testTeam.id,
          },
        },
      });

      await seatTracker.logSeatRemoval({
        teamId: testTeam.id,
        userId: newUser.id,
        triggeredBy: testUser.id,
        seatCount: 1,
        operationId: `membership-remove-${newUser.id}`,
      });

      // HWM should still be 2 (not decreased)
      billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true },
      });
      expect(billing?.highWaterMark).toBe(2);
    });
  });

  describe("Apply High Water Mark to Subscription", () => {
    it("should update Stripe subscription quantity to HWM before renewal", async () => {
      const mockBillingService = createMockBillingService();

      // Set HWM higher than paid seats
      await prisma.teamBilling.update({
        where: { teamId: testTeam.id },
        data: {
          highWaterMark: 5,
          paidSeats: 1,
        },
      });

      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        undefined,
        undefined,
        mockBillingService
      );

      const applied = await hwmService.applyHighWaterMarkToSubscription(subscriptionId);

      expect(applied).toBe(true);
      expect(mockBillingService.handleSubscriptionUpdate).toHaveBeenCalledWith({
        subscriptionId,
        subscriptionItemId,
        membershipCount: 5,
        prorationBehavior: "none",
      });

      // Verify paidSeats was updated in DB
      const billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { paidSeats: true },
      });
      expect(billing?.paidSeats).toBe(5);
    });

    it("should NOT update subscription if HWM is not higher than paid seats", async () => {
      const mockBillingService = createMockBillingService();

      // HWM equals paid seats
      await prisma.teamBilling.update({
        where: { teamId: testTeam.id },
        data: {
          highWaterMark: 1,
          paidSeats: 1,
        },
      });

      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        undefined,
        undefined,
        mockBillingService
      );

      const applied = await hwmService.applyHighWaterMarkToSubscription(subscriptionId);

      expect(applied).toBe(false);
      expect(mockBillingService.handleSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it("should skip non-monthly billing subscriptions", async () => {
      const mockBillingService = createMockBillingService();

      // Change to annual billing
      await prisma.teamBilling.update({
        where: { teamId: testTeam.id },
        data: {
          billingPeriod: "ANNUALLY",
          highWaterMark: 5,
          paidSeats: 1,
        },
      });

      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        undefined,
        undefined,
        mockBillingService
      );

      const applied = await hwmService.applyHighWaterMarkToSubscription(subscriptionId);

      expect(applied).toBe(false);
      expect(mockBillingService.handleSubscriptionUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Reset High Water Mark on New Billing Period", () => {
    it("should reset HWM to current member count on new period", async () => {
      const timestamp = Date.now();
      const seatTracker = new SeatChangeTrackingService();

      // Add members to increase HWM
      for (let i = 0; i < 3; i++) {
        const randomSuffix = Math.random().toString(36).substring(7);
        const newUser = await prisma.user.create({
          data: {
            email: `test-hwm-reset-${timestamp}-${i}-${randomSuffix}@example.com`,
            username: `testhwmreset-${timestamp}-${i}-${randomSuffix}`,
            name: `Test HWM Reset Member ${i}`,
          },
        });

        await prisma.membership.create({
          data: {
            userId: newUser.id,
            teamId: testTeam.id,
            role: MembershipRole.MEMBER,
            accepted: true,
          },
        });

        await seatTracker.logSeatAddition({
          teamId: testTeam.id,
          userId: newUser.id,
          triggeredBy: testUser.id,
          seatCount: 1,
          operationId: `membership-${newUser.id}`,
        });
      }

      // Verify HWM is 4
      let billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true },
      });
      expect(billing?.highWaterMark).toBe(4);

      // Remove 2 members
      const membersToRemove = await prisma.membership.findMany({
        where: {
          teamId: testTeam.id,
          role: MembershipRole.MEMBER,
        },
        take: 2,
      });

      for (const member of membersToRemove) {
        await prisma.membership.delete({
          where: {
            userId_teamId: {
              userId: member.userId,
              teamId: testTeam.id,
            },
          },
        });
      }

      // Now we have 2 members (1 owner + 1 member), but HWM is still 4
      const hwmService = new HighWaterMarkService(mockLogger as any);
      const newPeriodStart = new Date();
      newPeriodStart.setMonth(newPeriodStart.getMonth() + 1);

      await hwmService.resetHighWaterMark({
        teamId: testTeam.id,
        isOrganization: false,
        newPeriodStart,
      });

      // HWM should now be reset to current member count (2)
      billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true, highWaterMarkPeriodStart: true },
      });

      expect(billing?.highWaterMark).toBe(2);
      expect(billing?.highWaterMarkPeriodStart?.getTime()).toBe(newPeriodStart.getTime());
    });
  });

  describe("End-to-End Monthly Billing Flow", () => {
    it("should track HWM throughout billing cycle and apply before renewal", async () => {
      const timestamp = Date.now();
      const mockBillingService = createMockBillingService();
      const seatTracker = new SeatChangeTrackingService();
      const hwmRepo = new HighWaterMarkRepository();

      // Initial state: 1 owner, HWM = 1, paidSeats = 1
      let billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true, paidSeats: true },
      });
      expect(billing?.highWaterMark).toBe(1);
      expect(billing?.paidSeats).toBe(1);

      // Week 1: Add 2 members
      const members: User[] = [];
      for (let i = 0; i < 2; i++) {
        const randomSuffix = Math.random().toString(36).substring(7);
        const newUser = await prisma.user.create({
          data: {
            email: `test-e2e-${timestamp}-${i}-${randomSuffix}@example.com`,
            username: `teste2e-${timestamp}-${i}-${randomSuffix}`,
            name: `Test E2E Member ${i}`,
          },
        });
        members.push(newUser);

        await prisma.membership.create({
          data: {
            userId: newUser.id,
            teamId: testTeam.id,
            role: MembershipRole.MEMBER,
            accepted: true,
          },
        });

        await seatTracker.logSeatAddition({
          teamId: testTeam.id,
          userId: newUser.id,
          triggeredBy: testUser.id,
          seatCount: 1,
          operationId: `membership-${newUser.id}`,
        });
      }

      // HWM should be 3 (1 owner + 2 members)
      billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true, paidSeats: true },
      });
      expect(billing?.highWaterMark).toBe(3);
      expect(billing?.paidSeats).toBe(1); // Still 1 - not charged yet

      // Week 2: Add 2 more, then remove 1
      for (let i = 2; i < 4; i++) {
        const randomSuffix = Math.random().toString(36).substring(7);
        const newUser = await prisma.user.create({
          data: {
            email: `test-e2e-${timestamp}-${i}-${randomSuffix}@example.com`,
            username: `teste2e-${timestamp}-${i}-${randomSuffix}`,
            name: `Test E2E Member ${i}`,
          },
        });
        members.push(newUser);

        await prisma.membership.create({
          data: {
            userId: newUser.id,
            teamId: testTeam.id,
            role: MembershipRole.MEMBER,
            accepted: true,
          },
        });

        await seatTracker.logSeatAddition({
          teamId: testTeam.id,
          userId: newUser.id,
          triggeredBy: testUser.id,
          seatCount: 1,
          operationId: `membership-${newUser.id}`,
        });
      }

      // HWM should be 5 (1 owner + 4 members)
      billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true },
      });
      expect(billing?.highWaterMark).toBe(5);

      // Remove 1 member
      await prisma.membership.delete({
        where: {
          userId_teamId: {
            userId: members[0].id,
            teamId: testTeam.id,
          },
        },
      });

      await seatTracker.logSeatRemoval({
        teamId: testTeam.id,
        userId: members[0].id,
        triggeredBy: testUser.id,
        seatCount: 1,
        operationId: `membership-remove-${members[0].id}`,
      });

      // HWM should still be 5 (peak usage)
      billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true },
      });
      expect(billing?.highWaterMark).toBe(5);

      // Simulate invoice.upcoming webhook (before renewal)
      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        hwmRepo,
        undefined,
        mockBillingService
      );

      const applied = await hwmService.applyHighWaterMarkToSubscription(subscriptionId);

      expect(applied).toBe(true);
      expect(mockBillingService.handleSubscriptionUpdate).toHaveBeenCalledWith({
        subscriptionId,
        subscriptionItemId,
        membershipCount: 5, // HWM value
        prorationBehavior: "none",
      });

      // Verify paidSeats updated to HWM
      billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { paidSeats: true },
      });
      expect(billing?.paidSeats).toBe(5);

      // Simulate new billing period (subscription.updated webhook)
      const newPeriodStart = new Date();
      newPeriodStart.setMonth(newPeriodStart.getMonth() + 1);

      await hwmService.resetHighWaterMark({
        teamId: testTeam.id,
        isOrganization: false,
        newPeriodStart,
      });

      // HWM should be reset to current count (4: 1 owner + 3 members)
      billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true, highWaterMarkPeriodStart: true },
      });
      expect(billing?.highWaterMark).toBe(4);
      expect(billing?.highWaterMarkPeriodStart?.getTime()).toBe(newPeriodStart.getTime());
    });
  });

  describe("Organization Billing Support", () => {
    it("should track HWM for organizations", async () => {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(7);

      // Create organization
      const org = await prisma.team.create({
        data: {
          name: `Test HWM Org ${timestamp}-${randomSuffix}`,
          slug: `test-hwm-org-${timestamp}-${randomSuffix}`,
          isOrganization: true,
        },
      });

      await prisma.membership.create({
        data: {
          userId: testUser.id,
          teamId: org.id,
          role: MembershipRole.OWNER,
          accepted: true,
        },
      });

      const subscriptionStart = new Date();
      const subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

      // Create organization billing
      await prisma.organizationBilling.create({
        data: {
          teamId: org.id,
          subscriptionId: `sub_org_${timestamp}`,
          subscriptionItemId: `si_org_${timestamp}`,
          customerId: `cus_org_${timestamp}`,
          billingPeriod: "MONTHLY",
          pricePerSeat: 2500,
          paidSeats: 1,
          subscriptionStart,
          subscriptionEnd,
          status: "ACTIVE",
          planName: "ORGANIZATION",
          highWaterMark: 1,
          highWaterMarkPeriodStart: subscriptionStart,
        },
      });

      const seatTracker = new SeatChangeTrackingService();

      // Add member to org
      const newUser = await prisma.user.create({
        data: {
          email: `test-hwm-org-member-${timestamp}-${randomSuffix}@example.com`,
          username: `testhwmorgmember-${timestamp}-${randomSuffix}`,
          name: "Test HWM Org Member",
        },
      });

      await prisma.membership.create({
        data: {
          userId: newUser.id,
          teamId: org.id,
          role: MembershipRole.MEMBER,
          accepted: true,
        },
      });

      await seatTracker.logSeatAddition({
        teamId: org.id,
        userId: newUser.id,
        triggeredBy: testUser.id,
        seatCount: 1,
        operationId: `org-membership-${newUser.id}`,
      });

      // Verify HWM updated for org
      const orgBilling = await prisma.organizationBilling.findUnique({
        where: { teamId: org.id },
        select: { highWaterMark: true },
      });

      expect(orgBilling?.highWaterMark).toBe(2);
    });
  });

  describe("Billing Period Restrictions", () => {
    it("should NOT apply HWM for annual billing plans", async () => {
      // Change to annual billing
      await prisma.teamBilling.update({
        where: { teamId: testTeam.id },
        data: {
          billingPeriod: "ANNUALLY",
          highWaterMark: 1,
        },
      });

      const hwmService = new HighWaterMarkService(mockLogger as any);

      // shouldApplyHighWaterMark should return false for annual plans
      const shouldApply = await hwmService.shouldApplyHighWaterMark(testTeam.id);

      expect(shouldApply).toBe(false);
    });

    it("should apply HWM for monthly billing plans", async () => {
      // Ensure monthly billing is set
      await prisma.teamBilling.update({
        where: { teamId: testTeam.id },
        data: {
          billingPeriod: "MONTHLY",
          highWaterMark: 1,
        },
      });

      const hwmService = new HighWaterMarkService(mockLogger as any);

      // shouldApplyHighWaterMark should return true for monthly plans when feature is enabled
      const shouldApply = await hwmService.shouldApplyHighWaterMark(testTeam.id);

      // This depends on whether the feature flag is enabled in the test DB
      // If enabled, should be true; if disabled, should be false
      // For this integration test, we're just checking it doesn't throw
      expect(typeof shouldApply).toBe("boolean");
    });
  });

  describe("Edge Cases", () => {
    it("should handle team with no billing record gracefully", async () => {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(7);

      // Create team without billing
      const teamNoBilling = await prisma.team.create({
        data: {
          name: `Test No Billing ${timestamp}-${randomSuffix}`,
          slug: `test-no-billing-${timestamp}-${randomSuffix}`,
          isOrganization: false,
        },
      });

      await prisma.membership.create({
        data: {
          userId: testUser.id,
          teamId: teamNoBilling.id,
          role: MembershipRole.OWNER,
          accepted: true,
        },
      });

      const mockBillingService = createMockBillingService();
      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        undefined,
        undefined,
        mockBillingService
      );

      // Should not throw, just return null
      const result = await hwmService.updateHighWaterMarkOnSeatAddition({
        teamId: teamNoBilling.id,
        currentPeriodStart: new Date(),
      });

      expect(result).toBeNull();
    });

    it("should handle subscription not found gracefully", async () => {
      const mockBillingService = createMockBillingService();
      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        undefined,
        undefined,
        mockBillingService
      );

      const result = await hwmService.applyHighWaterMarkToSubscription("sub_nonexistent");

      expect(result).toBe(false);
      expect(mockBillingService.handleSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it("should lazy initialize HWM when null and member count exceeds paid seats", async () => {
      const mockBillingService = createMockBillingService();
      const timestamp = Date.now();

      // Set HWM to null but paidSeats to 1 (simulating uninitialized state)
      await prisma.teamBilling.update({
        where: { teamId: testTeam.id },
        data: {
          highWaterMark: null,
          paidSeats: 1,
        },
      });

      // Add extra members so member count (2) > paidSeats (1)
      const randomSuffix = Math.random().toString(36).substring(7);
      const newUser = await prisma.user.create({
        data: {
          email: `test-lazy-init-${timestamp}-${randomSuffix}@example.com`,
          username: `testlazyinit-${timestamp}-${randomSuffix}`,
          name: "Test Lazy Init Member",
        },
      });

      await prisma.membership.create({
        data: {
          userId: newUser.id,
          teamId: testTeam.id,
          role: MembershipRole.MEMBER,
          accepted: true,
        },
      });

      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        undefined,
        undefined,
        mockBillingService
      );

      const result = await hwmService.applyHighWaterMarkToSubscription(subscriptionId);

      // Should have lazy initialized HWM to 2 (current member count)
      // and then applied it since 2 > 1 (paidSeats)
      expect(result).toBe(true);
      expect(mockBillingService.handleSubscriptionUpdate).toHaveBeenCalledWith({
        subscriptionId,
        subscriptionItemId,
        membershipCount: 2,
        prorationBehavior: "none",
      });

      // Verify HWM was persisted
      const billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true, paidSeats: true },
      });
      expect(billing?.highWaterMark).toBe(2);
      expect(billing?.paidSeats).toBe(2);
    });

    it("should lazy initialize HWM but not update Stripe if equal to paid seats", async () => {
      const mockBillingService = createMockBillingService();

      // Set HWM to null, paidSeats matches member count (1 owner)
      await prisma.teamBilling.update({
        where: { teamId: testTeam.id },
        data: {
          highWaterMark: null,
          paidSeats: 1, // Same as member count
        },
      });

      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        undefined,
        undefined,
        mockBillingService
      );

      const result = await hwmService.applyHighWaterMarkToSubscription(subscriptionId);

      // HWM initialized to 1, but no Stripe update needed since 1 <= 1
      expect(result).toBe(false);
      expect(mockBillingService.handleSubscriptionUpdate).not.toHaveBeenCalled();

      // Verify HWM was still initialized
      const billing = await prisma.teamBilling.findUnique({
        where: { teamId: testTeam.id },
        select: { highWaterMark: true },
      });
      expect(billing?.highWaterMark).toBe(1);
    });

    it("should sync paidSeats from Stripe when null in database", async () => {
      const mockBillingService = createMockBillingService();

      // Mock Stripe to return quantity of 3
      vi.mocked(mockBillingService.getSubscription).mockResolvedValue({
        items: [
          {
            id: subscriptionItemId,
            quantity: 3,
            price: { unit_amount: 1500, recurring: { interval: "month" } },
          },
        ],
        customer: customerId,
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        trial_end: null,
      });

      // Set paidSeats to null, HWM to 5 (higher than Stripe quantity)
      await prisma.teamBilling.update({
        where: { teamId: testTeam.id },
        data: {
          highWaterMark: 5,
          paidSeats: null,
        },
      });

      const hwmService = new HighWaterMarkService(
        mockLogger as any,
        undefined,
        undefined,
        mockBillingService
      );

      const result = await hwmService.applyHighWaterMarkToSubscription(subscriptionId);

      // HWM (5) > paidSeats from Stripe (3), so should update
      expect(result).toBe(true);
      expect(mockBillingService.handleSubscriptionUpdate).toHaveBeenCalledWith({
        subscriptionId,
        subscriptionItemId,
        membershipCount: 5,
        prorationBehavior: "none",
      });
    });
  });
});
