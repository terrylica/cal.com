import prismaMock from "@calcom/testing/lib/__mocks__/prismaMock";

import { describe, expect, it, vi, beforeEach } from "vitest";

import { AssignmentReasonEnum } from "@calcom/prisma/enums";

import AssignmentReasonRecorder from "./AssignmentReasonRecorder";

vi.mock("@calcom/features/attributes/lib/getAttributes", () => ({
  getUsersAttributes: vi.fn(),
}));

vi.mock("@calcom/app-store/_utils/raqb/raqbUtils.server", () => ({
  acrossQueryValueCompatiblity: {
    getAttributesQueryValue: vi.fn(),
  },
}));

const { getUsersAttributes } = await import("@calcom/features/attributes/lib/getAttributes");
const { acrossQueryValueCompatiblity } = await import("@calcom/app-store/_utils/raqb/raqbUtils.server");
const { getAttributesQueryValue } = acrossQueryValueCompatiblity;

function buildRoutingFormResponse({
  chosenRouteId,
  response,
  routes,
  fields,
}: {
  chosenRouteId: string;
  response: Record<string, unknown>;
  routes: unknown;
  fields: unknown;
}) {
  return {
    id: 1,
    chosenRouteId,
    response,
    form: {
      routes,
      fields,
    },
  };
}

function buildRoute({
  id,
  attributesQueryValue,
}: {
  id: string;
  attributesQueryValue: unknown;
}) {
  return {
    id,
    queryValue: { id: "q1", type: "group" as const },
    attributesQueryValue,
    action: { type: "eventTypeRedirectUrl", value: "1" },
  };
}

describe("AssignmentReasonRecorder._routingFormRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should join all multiselect attribute values in assignment reason", async () => {
    const routeId = "route-1";
    const attrId = "attr-region";

    const routingFormResponse = buildRoutingFormResponse({
      chosenRouteId: routeId,
      response: { location: { value: ["north", "south", "west"] } },
      routes: [
        buildRoute({
          id: routeId,
          attributesQueryValue: {
            id: "qv1",
            type: "group",
            children1: {
              rule1: {
                type: "rule",
                properties: {
                  field: attrId,
                  operator: "multiselect_some_in",
                  value: [["north", "south", "west"]],
                  valueSrc: ["value"],
                  valueType: ["multiselect"],
                },
              },
            },
          },
        }),
      ],
      fields: [],
    });

    prismaMock.app_RoutingForms_FormResponse.findUnique.mockResolvedValue(routingFormResponse as never);

    vi.mocked(getUsersAttributes).mockResolvedValue([
      {
        id: attrId,
        name: "Region",
        slug: "region",
        type: "MULTI_SELECT",
        isWeightsEnabled: false,
        options: [
          { id: "opt-1", value: "North", slug: "north", contains: [], isGroup: false },
          { id: "opt-2", value: "South", slug: "south", contains: [], isGroup: false },
          { id: "opt-3", value: "West", slug: "west", contains: [], isGroup: false },
        ],
      },
    ] as never);

    vi.mocked(getAttributesQueryValue).mockReturnValue({
      id: "qv1",
      type: "group",
      children1: {
        rule1: {
          type: "rule",
          properties: {
            field: attrId,
            operator: "multiselect_some_in",
            value: [["north", "south", "west"]],
            valueSrc: ["value"],
            valueType: ["multiselect"],
          },
        },
      },
    });

    prismaMock.assignmentReason.create.mockResolvedValue({} as never);

    const result = await AssignmentReasonRecorder._routingFormRoute({
      bookingId: 1,
      routingFormResponseId: 1,
      organizerId: 10,
      teamId: 100,
      isRerouting: false,
    });

    expect(result).toBeDefined();
    expect(result?.reasonString).toContain("Region: north, south, west");
    expect(result?.reasonEnum).toBe(AssignmentReasonEnum.ROUTING_FORM_ROUTING);

    expect(prismaMock.assignmentReason.create).toHaveBeenCalledWith({
      data: {
        bookingId: 1,
        reasonEnum: AssignmentReasonEnum.ROUTING_FORM_ROUTING,
        reasonString: expect.stringContaining("north, south, west"),
      },
    });
  });

  it("should handle single select attribute value (non-array)", async () => {
    const routeId = "route-1";
    const attrId = "attr-city";

    const routingFormResponse = buildRoutingFormResponse({
      chosenRouteId: routeId,
      response: { city: { value: "mumbai" } },
      routes: [
        buildRoute({
          id: routeId,
          attributesQueryValue: {
            id: "qv1",
            type: "group",
            children1: {},
          },
        }),
      ],
      fields: [],
    });

    prismaMock.app_RoutingForms_FormResponse.findUnique.mockResolvedValue(routingFormResponse as never);

    vi.mocked(getUsersAttributes).mockResolvedValue([
      {
        id: attrId,
        name: "City",
        slug: "city",
        type: "SINGLE_SELECT",
        isWeightsEnabled: false,
        options: [
          { id: "opt-1", value: "Mumbai", slug: "mumbai", contains: [], isGroup: false },
        ],
      },
    ] as never);

    vi.mocked(getAttributesQueryValue).mockReturnValue({
      id: "qv1",
      type: "group",
      children1: {
        rule1: {
          type: "rule",
          properties: {
            field: attrId,
            operator: "select_equals",
            value: ["mumbai"],
            valueSrc: ["value"],
            valueType: ["select"],
          },
        },
      },
    });

    prismaMock.assignmentReason.create.mockResolvedValue({} as never);

    const result = await AssignmentReasonRecorder._routingFormRoute({
      bookingId: 2,
      routingFormResponseId: 2,
      organizerId: 10,
      teamId: 100,
      isRerouting: false,
    });

    expect(result).toBeDefined();
    expect(result?.reasonString).toContain("City: mumbai");
    expect(result?.reasonEnum).toBe(AssignmentReasonEnum.ROUTING_FORM_ROUTING);
  });

  it("should include rerouting info when isRerouting is true", async () => {
    const routeId = "route-1";
    const attrId = "attr-region";

    const routingFormResponse = buildRoutingFormResponse({
      chosenRouteId: routeId,
      response: {},
      routes: [
        buildRoute({
          id: routeId,
          attributesQueryValue: {
            id: "qv1",
            type: "group",
            children1: {},
          },
        }),
      ],
      fields: [],
    });

    prismaMock.app_RoutingForms_FormResponse.findUnique.mockResolvedValue(routingFormResponse as never);

    vi.mocked(getUsersAttributes).mockResolvedValue([
      {
        id: attrId,
        name: "Region",
        slug: "region",
        type: "MULTI_SELECT",
        isWeightsEnabled: false,
        options: [],
      },
    ] as never);

    vi.mocked(getAttributesQueryValue).mockReturnValue({
      id: "qv1",
      type: "group",
      children1: {
        rule1: {
          type: "rule",
          properties: {
            field: attrId,
            operator: "multiselect_some_in",
            value: [["east", "west"]],
            valueSrc: ["value"],
            valueType: ["multiselect"],
          },
        },
      },
    });

    prismaMock.assignmentReason.create.mockResolvedValue({} as never);

    const result = await AssignmentReasonRecorder._routingFormRoute({
      bookingId: 3,
      routingFormResponseId: 3,
      organizerId: 10,
      teamId: 100,
      isRerouting: true,
      reroutedByEmail: "admin@example.com",
    });

    expect(result).toBeDefined();
    expect(result?.reasonString).toContain("Rerouted by admin@example.com");
    expect(result?.reasonString).toContain("Region: east, west");
    expect(result?.reasonEnum).toBe(AssignmentReasonEnum.REROUTED);
  });

  it("should handle multiple attributes in the route", async () => {
    const routeId = "route-1";
    const regionAttrId = "attr-region";
    const deptAttrId = "attr-dept";

    const routingFormResponse = buildRoutingFormResponse({
      chosenRouteId: routeId,
      response: {},
      routes: [
        buildRoute({
          id: routeId,
          attributesQueryValue: {
            id: "qv1",
            type: "group",
            children1: {},
          },
        }),
      ],
      fields: [],
    });

    prismaMock.app_RoutingForms_FormResponse.findUnique.mockResolvedValue(routingFormResponse as never);

    vi.mocked(getUsersAttributes).mockResolvedValue([
      {
        id: regionAttrId,
        name: "Region",
        slug: "region",
        type: "MULTI_SELECT",
        isWeightsEnabled: false,
        options: [],
      },
      {
        id: deptAttrId,
        name: "Department",
        slug: "department",
        type: "SINGLE_SELECT",
        isWeightsEnabled: false,
        options: [],
      },
    ] as never);

    vi.mocked(getAttributesQueryValue).mockReturnValue({
      id: "qv1",
      type: "group",
      children1: {
        rule1: {
          type: "rule",
          properties: {
            field: regionAttrId,
            operator: "multiselect_some_in",
            value: [["north", "south"]],
            valueSrc: ["value"],
            valueType: ["multiselect"],
          },
        },
        rule2: {
          type: "rule",
          properties: {
            field: deptAttrId,
            operator: "select_equals",
            value: ["engineering"],
            valueSrc: ["value"],
            valueType: ["select"],
          },
        },
      },
    });

    prismaMock.assignmentReason.create.mockResolvedValue({} as never);

    const result = await AssignmentReasonRecorder._routingFormRoute({
      bookingId: 4,
      routingFormResponseId: 4,
      organizerId: 10,
      teamId: 100,
      isRerouting: false,
    });

    expect(result).toBeDefined();
    expect(result?.reasonString).toContain("Region: north, south");
    expect(result?.reasonString).toContain("Department: engineering");
  });

  it("should return undefined when routing form response is not found", async () => {
    prismaMock.app_RoutingForms_FormResponse.findUnique.mockResolvedValue(null);

    const result = await AssignmentReasonRecorder._routingFormRoute({
      bookingId: 5,
      routingFormResponseId: 999,
      organizerId: 10,
      teamId: 100,
      isRerouting: false,
    });

    expect(result).toBeUndefined();
  });
});
