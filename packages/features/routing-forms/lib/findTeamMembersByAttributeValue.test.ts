import type { Attribute } from "@calcom/app-store/routing-forms/types/types";
import type { AttributeType } from "@calcom/prisma/enums";
import type { AttributesQueryValue } from "@calcom/routing-forms/types/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canUseInvertedIndexApproach,
  findTeamMembersByAttributeValue,
} from "./findTeamMembersByAttributeValue";

// Mock Prisma
vi.mock("@calcom/prisma", () => ({
  default: {
    attributeOption: {
      findMany: vi.fn(),
    },
    attributeToUser: {
      findMany: vi.fn(),
    },
    membership: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@calcom/prisma";

const orgId = 1001;
const teamId = 100;

function buildSelectTypeFieldQueryValue({
  rules,
  conjunction = "AND",
}: {
  rules: {
    raqbFieldId: string;
    value: string | number | string[] | [string[]];
    operator: string;
    valueType?: string[];
  }[];
  conjunction?: "AND" | "OR";
}) {
  const queryValue = {
    id: "query-id-1",
    type: "group",
    properties: {
      conjunction,
    },
    children1: rules.reduce(
      (acc, rule, index) => {
        acc[`rule-${index + 1}`] = {
          type: "rule",
          properties: {
            field: rule.raqbFieldId,
            value: rule.value instanceof Array ? rule.value : [rule.value],
            operator: rule.operator,
            valueSrc: ["value"],
            valueType: rule.valueType ?? ["select"],
          },
        };
        return acc;
      },
      {} as Record<string, unknown>
    ),
  };

  return queryValue as AttributesQueryValue;
}

function createAttribute({
  id,
  name,
  type,
  options,
}: {
  id: string;
  name: string;
  type: AttributeType;
  options: { id: string; value: string; slug: string }[];
}): Attribute {
  return {
    id,
    name,
    type,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    options: options.map((opt) => ({
      ...opt,
      attributeId: id,
      isGroup: false,
      contains: [],
    })),
  };
}

describe("findTeamMembersByAttributeValue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("canUseInvertedIndexApproach", () => {
    it("should return false for null query value", () => {
      expect(canUseInvertedIndexApproach(null)).toBe(false);
    });

    it("should return false for empty query value", () => {
      const queryValue = { type: "group" } as AttributesQueryValue;
      expect(canUseInvertedIndexApproach(queryValue)).toBe(false);
    });

    it("should return true for simple flat rules", () => {
      const queryValue = buildSelectTypeFieldQueryValue({
        rules: [
          {
            raqbFieldId: "attr1",
            value: ["option1"],
            operator: "select_equals",
          },
        ],
      });
      expect(canUseInvertedIndexApproach(queryValue)).toBe(true);
    });

    it("should return false for nested groups", () => {
      const queryValue = {
        type: "group",
        children1: {
          "rule-1": {
            type: "group", // Nested group
            children1: {},
          },
        },
      } as unknown as AttributesQueryValue;
      expect(canUseInvertedIndexApproach(queryValue)).toBe(false);
    });
  });

  describe("findTeamMembersByAttributeValue", () => {
    it("should return null userIds when attributesQueryValue is null", async () => {
      const result = await findTeamMembersByAttributeValue({
        teamId,
        orgId,
        attributesQueryValue: null,
        attributesOfTheOrg: [],
      });

      expect(result.userIds).toBeNull();
    });

    it("should return null userIds when query value has no rules", async () => {
      const queryValue = { type: "group" } as AttributesQueryValue;

      const result = await findTeamMembersByAttributeValue({
        teamId,
        orgId,
        attributesQueryValue: queryValue,
        attributesOfTheOrg: [],
      });

      expect(result.userIds).toBeNull();
    });

    it("should find members matching a single select_equals rule", async () => {
      const Option1 = { id: "opt1", value: "Option 1", slug: "option-1" };
      const Attribute1 = createAttribute({
        id: "attr1",
        name: "Attribute 1",
        type: "SINGLE_SELECT",
        options: [Option1],
      });

      const queryValue = buildSelectTypeFieldQueryValue({
        rules: [
          {
            raqbFieldId: Attribute1.id,
            // After resolution, the value will be the label (lowercase)
            value: ["option 1"],
            operator: "select_equals",
          },
        ],
      });

      // Mock attributeOption.findMany to return the matching option
      vi.mocked(prisma.attributeOption.findMany).mockResolvedValue([
        {
          id: Option1.id,
          value: Option1.value,
          isGroup: false,
          contains: [],
          attributeId: Attribute1.id,
          slug: Option1.slug,
        },
      ]);

      // Mock attributeToUser.findMany to return members with this option
      vi.mocked(prisma.attributeToUser.findMany).mockResolvedValue([
        { member: { userId: 1 } },
        { member: { userId: 2 } },
      ] as never);

      const result = await findTeamMembersByAttributeValue({
        teamId,
        orgId,
        attributesQueryValue: queryValue,
        attributesOfTheOrg: [Attribute1],
      });

      expect(result.userIds).toEqual([1, 2]);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it("should find members matching select_any_in rule", async () => {
      const Option1 = { id: "opt1", value: "Option 1", slug: "option-1" };
      const Option2 = { id: "opt2", value: "Option 2", slug: "option-2" };
      const Attribute1 = createAttribute({
        id: "attr1",
        name: "Attribute 1",
        type: "SINGLE_SELECT",
        options: [Option1, Option2],
      });

      const queryValue = buildSelectTypeFieldQueryValue({
        rules: [
          {
            raqbFieldId: Attribute1.id,
            value: [["option 1", "option 2"]],
            operator: "select_any_in",
            valueType: ["multiselect"],
          },
        ],
      });

      vi.mocked(prisma.attributeOption.findMany).mockResolvedValue([
        {
          id: Option1.id,
          value: Option1.value,
          isGroup: false,
          contains: [],
          attributeId: Attribute1.id,
          slug: Option1.slug,
        },
        {
          id: Option2.id,
          value: Option2.value,
          isGroup: false,
          contains: [],
          attributeId: Attribute1.id,
          slug: Option2.slug,
        },
      ]);

      vi.mocked(prisma.attributeToUser.findMany).mockResolvedValue([
        { member: { userId: 1 } },
        { member: { userId: 2 } },
        { member: { userId: 3 } },
      ] as never);

      const result = await findTeamMembersByAttributeValue({
        teamId,
        orgId,
        attributesQueryValue: queryValue,
        attributesOfTheOrg: [Attribute1],
      });

      expect(result.userIds).toEqual([1, 2, 3]);
    });

    it("should handle AND conjunction correctly", async () => {
      const Option1 = { id: "opt1", value: "Option 1", slug: "option-1" };
      const Option2 = { id: "opt2", value: "Option 2", slug: "option-2" };
      const Attribute1 = createAttribute({
        id: "attr1",
        name: "Attribute 1",
        type: "SINGLE_SELECT",
        options: [Option1],
      });
      const Attribute2 = createAttribute({
        id: "attr2",
        name: "Attribute 2",
        type: "SINGLE_SELECT",
        options: [Option2],
      });

      const queryValue = buildSelectTypeFieldQueryValue({
        rules: [
          {
            raqbFieldId: Attribute1.id,
            value: ["option 1"],
            operator: "select_equals",
          },
          {
            raqbFieldId: Attribute2.id,
            value: ["option 2"],
            operator: "select_equals",
          },
        ],
        conjunction: "AND",
      });

      // First rule matches users 1, 2, 3
      // Second rule matches users 2, 3, 4
      // AND should return 2, 3
      vi.mocked(prisma.attributeOption.findMany)
        .mockResolvedValueOnce([
          {
            id: Option1.id,
            value: Option1.value,
            isGroup: false,
            contains: [],
            attributeId: Attribute1.id,
            slug: Option1.slug,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: Option2.id,
            value: Option2.value,
            isGroup: false,
            contains: [],
            attributeId: Attribute2.id,
            slug: Option2.slug,
          },
        ]);

      vi.mocked(prisma.attributeToUser.findMany)
        .mockResolvedValueOnce([
          { member: { userId: 1 } },
          { member: { userId: 2 } },
          { member: { userId: 3 } },
        ] as never)
        .mockResolvedValueOnce([
          { member: { userId: 2 } },
          { member: { userId: 3 } },
          { member: { userId: 4 } },
        ] as never);

      const result = await findTeamMembersByAttributeValue({
        teamId,
        orgId,
        attributesQueryValue: queryValue,
        attributesOfTheOrg: [Attribute1, Attribute2],
      });

      expect(result.userIds).toEqual([2, 3]);
    });

    it("should handle OR conjunction correctly", async () => {
      const Option1 = { id: "opt1", value: "Option 1", slug: "option-1" };
      const Option2 = { id: "opt2", value: "Option 2", slug: "option-2" };
      const Attribute1 = createAttribute({
        id: "attr1",
        name: "Attribute 1",
        type: "SINGLE_SELECT",
        options: [Option1],
      });
      const Attribute2 = createAttribute({
        id: "attr2",
        name: "Attribute 2",
        type: "SINGLE_SELECT",
        options: [Option2],
      });

      const queryValue = buildSelectTypeFieldQueryValue({
        rules: [
          {
            raqbFieldId: Attribute1.id,
            value: ["option 1"],
            operator: "select_equals",
          },
          {
            raqbFieldId: Attribute2.id,
            value: ["option 2"],
            operator: "select_equals",
          },
        ],
        conjunction: "OR",
      });

      // First rule matches users 1, 2
      // Second rule matches users 3, 4
      // OR should return 1, 2, 3, 4
      vi.mocked(prisma.attributeOption.findMany)
        .mockResolvedValueOnce([
          {
            id: Option1.id,
            value: Option1.value,
            isGroup: false,
            contains: [],
            attributeId: Attribute1.id,
            slug: Option1.slug,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: Option2.id,
            value: Option2.value,
            isGroup: false,
            contains: [],
            attributeId: Attribute2.id,
            slug: Option2.slug,
          },
        ]);

      vi.mocked(prisma.attributeToUser.findMany)
        .mockResolvedValueOnce([{ member: { userId: 1 } }, { member: { userId: 2 } }] as never)
        .mockResolvedValueOnce([{ member: { userId: 3 } }, { member: { userId: 4 } }] as never);

      const result = await findTeamMembersByAttributeValue({
        teamId,
        orgId,
        attributesQueryValue: queryValue,
        attributesOfTheOrg: [Attribute1, Attribute2],
      });

      expect(result.userIds).toEqual(expect.arrayContaining([1, 2, 3, 4]));
      expect(result.userIds?.length).toBe(4);
    });

    it("should return empty array when no matching options found", async () => {
      const Option1 = { id: "opt1", value: "Option 1", slug: "option-1" };
      const Attribute1 = createAttribute({
        id: "attr1",
        name: "Attribute 1",
        type: "SINGLE_SELECT",
        options: [Option1],
      });

      const queryValue = buildSelectTypeFieldQueryValue({
        rules: [
          {
            raqbFieldId: Attribute1.id,
            value: ["nonexistent option"],
            operator: "select_equals",
          },
        ],
      });

      // No matching options
      vi.mocked(prisma.attributeOption.findMany).mockResolvedValue([]);

      const result = await findTeamMembersByAttributeValue({
        teamId,
        orgId,
        attributesQueryValue: queryValue,
        attributesOfTheOrg: [Attribute1],
      });

      expect(result.userIds).toEqual([]);
    });

    it("should handle group options by including contained options", async () => {
      const Option1 = { id: "opt1", value: "Option 1", slug: "option-1" };
      const Option2 = { id: "opt2", value: "Option 2", slug: "option-2" };
      const GroupOption = { id: "group-opt", value: "Group Option", slug: "group-option" };
      const Attribute1 = createAttribute({
        id: "attr1",
        name: "Attribute 1",
        type: "SINGLE_SELECT",
        options: [Option1, Option2, GroupOption],
      });

      const queryValue = buildSelectTypeFieldQueryValue({
        rules: [
          {
            raqbFieldId: Attribute1.id,
            value: ["group option"],
            operator: "select_equals",
          },
        ],
      });

      // Group option contains opt1 and opt2
      vi.mocked(prisma.attributeOption.findMany).mockResolvedValue([
        {
          id: GroupOption.id,
          value: GroupOption.value,
          isGroup: true,
          contains: [Option1.id, Option2.id],
          attributeId: Attribute1.id,
          slug: GroupOption.slug,
        },
      ]);

      // Members with any of the contained options
      vi.mocked(prisma.attributeToUser.findMany).mockResolvedValue([
        { member: { userId: 1 } },
        { member: { userId: 2 } },
      ] as never);

      const result = await findTeamMembersByAttributeValue({
        teamId,
        orgId,
        attributesQueryValue: queryValue,
        attributesOfTheOrg: [Attribute1],
      });

      // Should have searched for group-opt, opt1, and opt2
      expect(vi.mocked(prisma.attributeToUser.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attributeOptionId: {
              in: expect.arrayContaining([GroupOption.id, Option1.id, Option2.id]),
            },
          }),
        })
      );

      expect(result.userIds).toEqual([1, 2]);
    });
  });
});
