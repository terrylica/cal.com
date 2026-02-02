import { resolveQueryValue } from "@calcom/app-store/routing-forms/lib/resolveQueryValue";
import type { Attribute } from "@calcom/app-store/routing-forms/types/types";
import logger from "@calcom/lib/logger";
import type { AttributesQueryValue, dynamicFieldValueOperands } from "@calcom/lib/raqb/types";
import prisma from "@calcom/prisma";

const moduleLogger = logger.getSubLogger({ prefix: ["findTeamMembersByAttributeValue"] });

/**
 * Represents a parsed rule from the RAQB query value
 */
type ParsedRule = {
  attributeId: string;
  operator: string;
  /** Values to match - these are the resolved labels (not IDs) */
  values: string[];
};

/**
 * Result of parsing the attributes query value
 */
type ParsedAttributeQuery = {
  rules: ParsedRule[];
  /** The conjunction type - 'AND' or 'OR' */
  conjunction: "AND" | "OR";
};

/**
 * Type for RAQB rule item in children1
 */
type RaqbRuleItem = {
  type: string;
  properties?: {
    field?: string;
    operator?: string;
    value?: unknown[];
    valueSrc?: string[];
    valueType?: string[];
    valueError?: (string | null)[];
  };
};

function isQueryValueARuleGroup(
  queryValue: unknown
): queryValue is {
  type: "group";
  children1?: Record<string, RaqbRuleItem>;
  properties?: { conjunction?: string };
} {
  return (
    typeof queryValue === "object" &&
    queryValue !== null &&
    "type" in queryValue &&
    (queryValue as { type: string }).type === "group"
  );
}

function isARule(rule: RaqbRuleItem): boolean {
  return rule.type === "rule";
}

/**
 * Parses the RAQB query value to extract the rules and conjunction type.
 * The query value should already be resolved (field templates replaced with actual values).
 */
function parseAttributesQueryValue(queryValue: AttributesQueryValue): ParsedAttributeQuery | null {
  if (!isQueryValueARuleGroup(queryValue)) {
    return null;
  }

  const children1 = queryValue.children1;
  if (!children1) {
    return null;
  }

  // Get conjunction from properties, default to AND
  const conjunction: "AND" | "OR" = queryValue.properties?.conjunction === "OR" ? "OR" : "AND";

  const rules: ParsedRule[] = [];

  for (const ruleId of Object.keys(children1)) {
    const rule = children1[ruleId];

    if (!isARule(rule)) {
      // Skip nested groups for now - we only support flat rules
      continue;
    }

    const properties = rule.properties;
    if (!properties) {
      continue;
    }

    const attributeId = properties.field;
    const operator = properties.operator;
    const value = properties.value;

    if (!attributeId || !operator || !value) {
      continue;
    }

    // Extract values from the RAQB value format
    // Value can be: [["value1", "value2"]] for multiselect or ["value1"] for single select
    const flattenedValues: string[] = [];
    for (const v of value) {
      if (v === null || v === undefined) {
        continue;
      }
      if (Array.isArray(v)) {
        for (const innerV of v) {
          if (typeof innerV === "string") {
            flattenedValues.push(innerV);
          }
        }
      } else if (typeof v === "string") {
        flattenedValues.push(v);
      }
    }

    if (flattenedValues.length === 0) {
      continue;
    }

    rules.push({
      attributeId,
      operator,
      values: flattenedValues,
    });
  }

  if (rules.length === 0) {
    return null;
  }

  return { rules, conjunction };
}

/**
 * Maps RAQB operators to their matching behavior
 */
type OperatorMatchType = "EQUALS" | "ANY_IN" | "NOT_EQUALS" | "NOT_ANY_IN";

function getOperatorMatchType(operator: string): OperatorMatchType {
  switch (operator) {
    case "select_equals":
      return "EQUALS";
    case "select_not_equals":
      return "NOT_EQUALS";
    case "select_any_in":
    case "multiselect_some_in":
      return "ANY_IN";
    case "select_not_any_in":
    case "multiselect_not_some_in":
      return "NOT_ANY_IN";
    default:
      // Default to ANY_IN for unknown operators
      moduleLogger.warn(`Unknown operator: ${operator}, defaulting to ANY_IN`);
      return "ANY_IN";
  }
}

/**
 * Finds team members who have attribute options matching the given values.
 * This is the "inverted index" approach - instead of fetching all members and evaluating logic,
 * we query directly for members who have the required attribute values.
 */
async function findMembersByAttributeOptionValues({
  teamId,
  orgId,
  attributeId,
  values,
  matchType,
}: {
  teamId: number;
  orgId: number;
  attributeId: string;
  /** Values to match - these should be the option labels (case-insensitive) */
  values: string[];
  matchType: OperatorMatchType;
}): Promise<number[]> {
  // First, find the attribute options that match the given values
  const attributeOptions = await prisma.attributeOption.findMany({
    where: {
      attributeId,
      // Case-insensitive match on the value
      value: {
        in: values,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      value: true,
      isGroup: true,
      contains: true,
    },
  });

  if (attributeOptions.length === 0 && (matchType === "EQUALS" || matchType === "ANY_IN")) {
    // No matching options found, so no members can match
    return [];
  }

  // Collect all option IDs to search for, including group expansion
  const optionIdsToSearch: string[] = [];
  for (const option of attributeOptions) {
    optionIdsToSearch.push(option.id);
    // If this is a group option, also include the contained options
    if (option.isGroup && option.contains.length > 0) {
      optionIdsToSearch.push(...option.contains);
    }
  }

  // Find team members who have these attribute options assigned
  // We need to join through membership to filter by team
  const membersWithAttribute = await prisma.attributeToUser.findMany({
    where: {
      attributeOptionId: {
        in: optionIdsToSearch,
      },
      member: {
        // The member must be in the team (sub-team)
        user: {
          teams: {
            some: {
              teamId,
            },
          },
        },
        // The membership must be in the org (for attribute assignment)
        teamId: orgId,
      },
    },
    select: {
      member: {
        select: {
          userId: true,
        },
      },
    },
  });

  const matchingUserIds = Array.from(new Set(membersWithAttribute.map((m) => m.member.userId)));

  if (matchType === "NOT_EQUALS" || matchType === "NOT_ANY_IN") {
    // For NOT operators, we need to find all team members and exclude the matching ones
    const allTeamMembers = await prisma.membership.findMany({
      where: {
        teamId,
      },
      select: {
        userId: true,
      },
    });

    const allUserIds = allTeamMembers.map((m) => m.userId);
    const matchingSet = new Set(matchingUserIds);
    return allUserIds.filter((userId) => !matchingSet.has(userId));
  }

  return matchingUserIds;
}

/**
 * Finds team members matching the attribute logic using direct database queries.
 * This is an optimized alternative to the JSON logic evaluation approach.
 *
 * @param data - The query parameters
 * @param data.teamId - The team ID to search within
 * @param data.orgId - The organization ID (for attribute assignments)
 * @param data.attributesQueryValue - The RAQB query value defining the attribute logic
 * @param data.attributesOfTheOrg - All attributes defined for the organization
 * @param data.dynamicFieldValueOperands - Optional field values for resolving field templates
 *
 * @returns Array of user IDs matching the attribute logic, or null if no logic is defined
 */
export async function findTeamMembersByAttributeValue({
  teamId,
  orgId,
  attributesQueryValue,
  attributesOfTheOrg,
  dynamicFieldValueOperands,
}: {
  teamId: number;
  orgId: number;
  attributesQueryValue: AttributesQueryValue | null;
  attributesOfTheOrg: Attribute[];
  dynamicFieldValueOperands?: dynamicFieldValueOperands;
}): Promise<{
  userIds: number[] | null;
  timeTaken: number | null;
}> {
  const startTime = performance.now();

  if (!attributesQueryValue) {
    return { userIds: null, timeTaken: null };
  }

  // Resolve the query value (replace field templates with actual values)
  const resolvedQueryValue = resolveQueryValue({
    queryValue: attributesQueryValue,
    attributes: attributesOfTheOrg,
    dynamicFieldValueOperands,
  });

  // Parse the resolved query value
  const parsedQuery = parseAttributesQueryValue(resolvedQueryValue);

  if (!parsedQuery) {
    // No valid rules found - return null to indicate all members match
    return { userIds: null, timeTaken: performance.now() - startTime };
  }

  const { rules, conjunction } = parsedQuery;

  // Execute queries for each rule
  const ruleResults: number[][] = [];

  for (const rule of rules) {
    const matchType = getOperatorMatchType(rule.operator);
    const matchingUserIds = await findMembersByAttributeOptionValues({
      teamId,
      orgId,
      attributeId: rule.attributeId,
      values: rule.values,
      matchType,
    });
    ruleResults.push(matchingUserIds);
  }

  // Combine results based on conjunction
  let finalUserIds: number[];

  if (conjunction === "AND") {
    // Intersection of all rule results
    if (ruleResults.length === 0) {
      finalUserIds = [];
    } else {
      const firstResult = new Set(ruleResults[0]);
      finalUserIds = Array.from(firstResult).filter((userId) =>
        ruleResults.every((result) => result.includes(userId))
      );
    }
  } else {
    // Union of all rule results
    const allUserIds = new Set<number>();
    for (const result of ruleResults) {
      for (const userId of result) {
        allUserIds.add(userId);
      }
    }
    finalUserIds = Array.from(allUserIds);
  }

  const timeTaken = performance.now() - startTime;

  moduleLogger.debug("findTeamMembersByAttributeValue completed", {
    teamId,
    orgId,
    rulesCount: rules.length,
    conjunction,
    matchingMembersCount: finalUserIds.length,
    timeTaken,
  });

  return { userIds: finalUserIds, timeTaken };
}

/**
 * Checks if the attribute query can be optimized using the inverted index approach.
 * Some complex queries (nested groups, unsupported operators) may not be supported.
 */
export function canUseInvertedIndexApproach(attributesQueryValue: AttributesQueryValue | null): boolean {
  if (!attributesQueryValue) {
    return false;
  }

  if (!isQueryValueARuleGroup(attributesQueryValue)) {
    return false;
  }

  const children1 = attributesQueryValue.children1;
  if (!children1) {
    return false;
  }

  // Check if all children are simple rules (not nested groups)
  for (const ruleId of Object.keys(children1)) {
    const rule = children1[ruleId];
    if (rule.type !== "rule") {
      // Nested group found - not supported
      return false;
    }
  }

  return true;
}
