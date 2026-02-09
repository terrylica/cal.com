import prismaMock from "@calcom/testing/lib/__mocks__/prismaMock";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SchedulingType } from "@calcom/prisma/enums";
import { TRPCError } from "@trpc/server";

import { duplicateHandler } from "./duplicate.handler";

vi.mock("@calcom/prisma", () => ({
  default: prismaMock,
}));
vi.mock("@calcom/features/eventtypes/repositories/eventTypeRepository");

describe("duplicateHandler", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = { user: { id: 1, profile: { id: 1 } } } as any;
  const input = {
    id: 123,
    slug: "test-event",
    title: "Test",
    description: "Test",
    length: 30,
    teamId: null,
  };
  const eventType = { id: 123, userId: 1, teamId: null, users: [{ id: 1 }] };

  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.eventType.findUnique.mockResolvedValue(eventType);
  });

  it("should throw INTERNAL_SERVER_ERROR in case of unique constraint violation", async () => {
    const { EventTypeRepository } = await import(
      "@calcom/features/eventtypes/repositories/eventTypeRepository"
    );
    vi.mocked(EventTypeRepository).mockImplementation(function () {
      return {
        create: vi.fn().mockRejectedValue(
          new PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "mockedVersion",
          })
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    });

    await expect(duplicateHandler({ ctx, input })).rejects.toThrow(
      new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Error duplicating event type PrismaClientKnownRequestError: Unique constraint failed",
      })
    );
  });

  describe("managed event type duplication", () => {
    const managedEventType = {
      id: 456,
      userId: 1,
      teamId: 10,
      schedulingType: SchedulingType.MANAGED,
      parentId: null,
      title: "Managed Event",
      slug: "managed-event",
      description: "A managed event type",
      length: 30,
      users: [{ id: 1 }],
      hosts: [
        { id: 1, userId: 1, eventTypeId: 456, isFixed: false, priority: 2, weight: 100, weightAdjustment: 0 },
      ],
      customInputs: [],
      workflows: [],
      hashedLink: [],
      team: { id: 10 },
      destinationCalendar: null,
      calVideoSettings: null,
    };

    const managedInput = {
      id: 456,
      slug: "managed-event-copy",
      title: "Managed Event Copy",
      description: "A copy of managed event",
      length: 30,
      teamId: 10,
    };

    it("should preserve schedulingType MANAGED when duplicating a managed event type", async () => {
      const { EventTypeRepository } = await import(
        "@calcom/features/eventtypes/repositories/eventTypeRepository"
      );

      const createdEventType = {
        id: 789,
        ...managedEventType,
        slug: managedInput.slug,
        title: managedInput.title,
        description: managedInput.description,
      };

      const createMock = vi.fn().mockResolvedValue(createdEventType);
      vi.mocked(EventTypeRepository).mockImplementation(function () {
        return {
          create: createMock,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.eventType.findUnique.mockResolvedValue(managedEventType as any);
      prismaMock.membership.findUnique.mockResolvedValue({ userId: 1, teamId: 10 });

      const result = await duplicateHandler({ ctx, input: managedInput });

      expect(result.eventType.schedulingType).toBe(SchedulingType.MANAGED);
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          schedulingType: SchedulingType.MANAGED,
        })
      );
    });

    it("should copy hosts but not children when duplicating a managed event type", async () => {
      const { EventTypeRepository } = await import(
        "@calcom/features/eventtypes/repositories/eventTypeRepository"
      );

      const createdEventType = {
        id: 789,
        ...managedEventType,
        slug: managedInput.slug,
        title: managedInput.title,
        description: managedInput.description,
      };

      const createMock = vi.fn().mockResolvedValue(createdEventType);
      vi.mocked(EventTypeRepository).mockImplementation(function () {
        return {
          create: createMock,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.eventType.findUnique.mockResolvedValue(managedEventType as any);
      prismaMock.membership.findUnique.mockResolvedValue({ userId: 1, teamId: 10 });

      await duplicateHandler({ ctx, input: managedInput });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hosts: {
            createMany: {
              data: expect.arrayContaining([
                expect.objectContaining({
                  userId: 1,
                  isFixed: false,
                  priority: 2,
                }),
              ]),
            },
          },
        })
      );
      expect(createMock).toHaveBeenCalledWith(
        expect.not.objectContaining({
          children: expect.anything(),
        })
      );
    });

    it("should set parentId to null for duplicated managed event type", async () => {
      const { EventTypeRepository } = await import(
        "@calcom/features/eventtypes/repositories/eventTypeRepository"
      );

      const createdEventType = {
        id: 789,
        ...managedEventType,
        slug: managedInput.slug,
        title: managedInput.title,
        description: managedInput.description,
        parentId: null,
      };

      const createMock = vi.fn().mockResolvedValue(createdEventType);
      vi.mocked(EventTypeRepository).mockImplementation(function () {
        return {
          create: createMock,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.eventType.findUnique.mockResolvedValue(managedEventType as any);
      prismaMock.membership.findUnique.mockResolvedValue({ userId: 1, teamId: 10 });

      const result = await duplicateHandler({ ctx, input: managedInput });

      expect(result.eventType.parentId).toBeNull();
    });

    it("should allow team members to duplicate managed event types", async () => {
      const { EventTypeRepository } = await import(
        "@calcom/features/eventtypes/repositories/eventTypeRepository"
      );

      const teamMemberCtx = { user: { id: 2, profile: { id: 2 } } };
      const managedEventTypeOwnedByOther = {
        ...managedEventType,
        userId: 1,
      };

      const createdEventType = {
        id: 789,
        ...managedEventTypeOwnedByOther,
        slug: managedInput.slug,
        title: managedInput.title,
        description: managedInput.description,
      };

      const createMock = vi.fn().mockResolvedValue(createdEventType);
      vi.mocked(EventTypeRepository).mockImplementation(function () {
        return {
          create: createMock,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.eventType.findUnique.mockResolvedValue(managedEventTypeOwnedByOther as any);
      prismaMock.membership.findUnique.mockResolvedValue({ userId: 2, teamId: 10 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await duplicateHandler({ ctx: teamMemberCtx as any, input: managedInput });

      expect(result.eventType).toBeDefined();
      expect(createMock).toHaveBeenCalled();
    });

    it("should throw error when non-team member tries to duplicate managed event type", async () => {
      const nonMemberCtx = { user: { id: 99, profile: { id: 99 } } };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.eventType.findUnique.mockResolvedValue(managedEventType as any);
      prismaMock.membership.findUnique.mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(duplicateHandler({ ctx: nonMemberCtx as any, input: managedInput })).rejects.toThrow(
        TRPCError
      );
    });
  });
});
