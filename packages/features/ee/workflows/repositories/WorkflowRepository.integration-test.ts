import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { prisma } from "@calcom/prisma";
import { WorkflowTriggerEvents, TimeUnit } from "@calcom/prisma/enums";

import { WorkflowRepository } from "./WorkflowRepository";

const createdWorkflowIds: number[] = [];
const createdEventTypeIds: number[] = [];
const createdWorkflowsOnEventTypeIds: number[] = [];
let testUserId: number;

async function cleanupTestData() {
  if (createdWorkflowsOnEventTypeIds.length > 0) {
    await prisma.workflowsOnEventTypes.deleteMany({
      where: { id: { in: createdWorkflowsOnEventTypeIds } },
    });
    createdWorkflowsOnEventTypeIds.length = 0;
  }

  if (createdWorkflowIds.length > 0) {
    await prisma.workflow.deleteMany({
      where: { id: { in: createdWorkflowIds } },
    });
    createdWorkflowIds.length = 0;
  }

  if (createdEventTypeIds.length > 0) {
    await prisma.eventType.deleteMany({
      where: { id: { in: createdEventTypeIds } },
    });
    createdEventTypeIds.length = 0;
  }
}

describe("WorkflowRepository (Integration Tests)", () => {
  beforeAll(async () => {
    const testUser = await prisma.user.findFirstOrThrow({
      where: { email: "member0-acme@example.com" },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe("enrichWorkflowsWithChildrenCount", () => {
    it("should return workflows with _count.children = 0 for event types with no children", async () => {
      const parentEventType = await prisma.eventType.create({
        data: {
          title: "Parent Event Type No Children",
          slug: `parent-no-children-${Date.now()}`,
          length: 30,
          userId: testUserId,
        },
      });
      createdEventTypeIds.push(parentEventType.id);

      const workflow = await prisma.workflow.create({
        data: {
          name: "Test Workflow No Children",
          trigger: WorkflowTriggerEvents.BEFORE_EVENT,
          time: 24,
          timeUnit: TimeUnit.HOUR,
          userId: testUserId,
        },
      });
      createdWorkflowIds.push(workflow.id);

      const workflowOnEventType = await prisma.workflowsOnEventTypes.create({
        data: {
          workflowId: workflow.id,
          eventTypeId: parentEventType.id,
        },
      });
      createdWorkflowsOnEventTypeIds.push(workflowOnEventType.id);

      const workflows = await WorkflowRepository.findUserWorkflows({
        userId: testUserId,
        excludeFormTriggers: true,
      });

      const testWorkflow = workflows.find((w) => w.id === workflow.id);
      expect(testWorkflow).toBeDefined();
      expect(testWorkflow?.activeOn).toHaveLength(1);
      expect(testWorkflow?.activeOn[0].eventType._count.children).toBe(0);
    });

    it("should return workflows with correct _count.children for event types with children", async () => {
      const parentEventType = await prisma.eventType.create({
        data: {
          title: "Parent Event Type With Children",
          slug: `parent-with-children-${Date.now()}`,
          length: 30,
          userId: testUserId,
        },
      });
      createdEventTypeIds.push(parentEventType.id);

      const childEventType1 = await prisma.eventType.create({
        data: {
          title: "Child Event Type 1",
          slug: `child-1-${Date.now()}`,
          length: 30,
          userId: testUserId,
          parentId: parentEventType.id,
        },
      });
      createdEventTypeIds.push(childEventType1.id);

      const childEventType2 = await prisma.eventType.create({
        data: {
          title: "Child Event Type 2",
          slug: `child-2-${Date.now()}`,
          length: 30,
          userId: testUserId,
          parentId: parentEventType.id,
        },
      });
      createdEventTypeIds.push(childEventType2.id);

      const workflow = await prisma.workflow.create({
        data: {
          name: "Test Workflow With Children",
          trigger: WorkflowTriggerEvents.BEFORE_EVENT,
          time: 24,
          timeUnit: TimeUnit.HOUR,
          userId: testUserId,
        },
      });
      createdWorkflowIds.push(workflow.id);

      const workflowOnEventType = await prisma.workflowsOnEventTypes.create({
        data: {
          workflowId: workflow.id,
          eventTypeId: parentEventType.id,
        },
      });
      createdWorkflowsOnEventTypeIds.push(workflowOnEventType.id);

      const workflows = await WorkflowRepository.findUserWorkflows({
        userId: testUserId,
        excludeFormTriggers: true,
      });

      const testWorkflow = workflows.find((w) => w.id === workflow.id);
      expect(testWorkflow).toBeDefined();
      expect(testWorkflow?.activeOn).toHaveLength(1);
      expect(testWorkflow?.activeOn[0].eventType._count.children).toBe(2);
    });

    it("should handle workflows with multiple event types having different children counts", async () => {
      const parentEventType1 = await prisma.eventType.create({
        data: {
          title: "Parent Event Type 1",
          slug: `parent-1-${Date.now()}`,
          length: 30,
          userId: testUserId,
        },
      });
      createdEventTypeIds.push(parentEventType1.id);

      const childEventType1 = await prisma.eventType.create({
        data: {
          title: "Child of Parent 1",
          slug: `child-of-parent-1-${Date.now()}`,
          length: 30,
          userId: testUserId,
          parentId: parentEventType1.id,
        },
      });
      createdEventTypeIds.push(childEventType1.id);

      const parentEventType2 = await prisma.eventType.create({
        data: {
          title: "Parent Event Type 2",
          slug: `parent-2-${Date.now()}`,
          length: 30,
          userId: testUserId,
        },
      });
      createdEventTypeIds.push(parentEventType2.id);

      const childEventType2a = await prisma.eventType.create({
        data: {
          title: "Child 2a of Parent 2",
          slug: `child-2a-${Date.now()}`,
          length: 30,
          userId: testUserId,
          parentId: parentEventType2.id,
        },
      });
      createdEventTypeIds.push(childEventType2a.id);

      const childEventType2b = await prisma.eventType.create({
        data: {
          title: "Child 2b of Parent 2",
          slug: `child-2b-${Date.now()}`,
          length: 30,
          userId: testUserId,
          parentId: parentEventType2.id,
        },
      });
      createdEventTypeIds.push(childEventType2b.id);

      const childEventType2c = await prisma.eventType.create({
        data: {
          title: "Child 2c of Parent 2",
          slug: `child-2c-${Date.now()}`,
          length: 30,
          userId: testUserId,
          parentId: parentEventType2.id,
        },
      });
      createdEventTypeIds.push(childEventType2c.id);

      const workflow = await prisma.workflow.create({
        data: {
          name: "Test Workflow Multiple Parents",
          trigger: WorkflowTriggerEvents.BEFORE_EVENT,
          time: 24,
          timeUnit: TimeUnit.HOUR,
          userId: testUserId,
        },
      });
      createdWorkflowIds.push(workflow.id);

      const workflowOnEventType1 = await prisma.workflowsOnEventTypes.create({
        data: {
          workflowId: workflow.id,
          eventTypeId: parentEventType1.id,
        },
      });
      createdWorkflowsOnEventTypeIds.push(workflowOnEventType1.id);

      const workflowOnEventType2 = await prisma.workflowsOnEventTypes.create({
        data: {
          workflowId: workflow.id,
          eventTypeId: parentEventType2.id,
        },
      });
      createdWorkflowsOnEventTypeIds.push(workflowOnEventType2.id);

      const workflows = await WorkflowRepository.findUserWorkflows({
        userId: testUserId,
        excludeFormTriggers: true,
      });

      const testWorkflow = workflows.find((w) => w.id === workflow.id);
      expect(testWorkflow).toBeDefined();
      expect(testWorkflow?.activeOn).toHaveLength(2);

      const parent1ActiveOn = testWorkflow?.activeOn.find(
        (a) => a.eventType.id === parentEventType1.id
      );
      const parent2ActiveOn = testWorkflow?.activeOn.find(
        (a) => a.eventType.id === parentEventType2.id
      );

      expect(parent1ActiveOn?.eventType._count.children).toBe(1);
      expect(parent2ActiveOn?.eventType._count.children).toBe(3);
    });

    it("should handle workflows with no activeOn event types", async () => {
      const workflow = await prisma.workflow.create({
        data: {
          name: "Test Workflow No ActiveOn",
          trigger: WorkflowTriggerEvents.BEFORE_EVENT,
          time: 24,
          timeUnit: TimeUnit.HOUR,
          userId: testUserId,
        },
      });
      createdWorkflowIds.push(workflow.id);

      const workflows = await WorkflowRepository.findUserWorkflows({
        userId: testUserId,
        excludeFormTriggers: true,
      });

      const testWorkflow = workflows.find((w) => w.id === workflow.id);
      expect(testWorkflow).toBeDefined();
      expect(testWorkflow?.activeOn).toHaveLength(0);
    });

    it("should correctly enrich workflows returned by findAllWorkflows", async () => {
      const parentEventType = await prisma.eventType.create({
        data: {
          title: "Parent for findAllWorkflows",
          slug: `parent-find-all-${Date.now()}`,
          length: 30,
          userId: testUserId,
        },
      });
      createdEventTypeIds.push(parentEventType.id);

      const childEventType = await prisma.eventType.create({
        data: {
          title: "Child for findAllWorkflows",
          slug: `child-find-all-${Date.now()}`,
          length: 30,
          userId: testUserId,
          parentId: parentEventType.id,
        },
      });
      createdEventTypeIds.push(childEventType.id);

      const workflow = await prisma.workflow.create({
        data: {
          name: "Test Workflow findAllWorkflows",
          trigger: WorkflowTriggerEvents.BEFORE_EVENT,
          time: 24,
          timeUnit: TimeUnit.HOUR,
          userId: testUserId,
        },
      });
      createdWorkflowIds.push(workflow.id);

      const workflowOnEventType = await prisma.workflowsOnEventTypes.create({
        data: {
          workflowId: workflow.id,
          eventTypeId: parentEventType.id,
        },
      });
      createdWorkflowsOnEventTypeIds.push(workflowOnEventType.id);

      const workflows = await WorkflowRepository.findAllWorkflows({
        userId: testUserId,
        excludeFormTriggers: true,
      });

      const testWorkflow = workflows.find((w) => w.id === workflow.id);
      expect(testWorkflow).toBeDefined();
      expect(testWorkflow?.activeOn).toHaveLength(1);
      expect(testWorkflow?.activeOn[0].eventType._count.children).toBe(1);
    });

    it("should preserve eventType title and parentId in enriched workflows", async () => {
      const parentEventType = await prisma.eventType.create({
        data: {
          title: "Unique Title For Preservation Test",
          slug: `preservation-test-${Date.now()}`,
          length: 30,
          userId: testUserId,
        },
      });
      createdEventTypeIds.push(parentEventType.id);

      const workflow = await prisma.workflow.create({
        data: {
          name: "Test Workflow Preservation",
          trigger: WorkflowTriggerEvents.BEFORE_EVENT,
          time: 24,
          timeUnit: TimeUnit.HOUR,
          userId: testUserId,
        },
      });
      createdWorkflowIds.push(workflow.id);

      const workflowOnEventType = await prisma.workflowsOnEventTypes.create({
        data: {
          workflowId: workflow.id,
          eventTypeId: parentEventType.id,
        },
      });
      createdWorkflowsOnEventTypeIds.push(workflowOnEventType.id);

      const workflows = await WorkflowRepository.findUserWorkflows({
        userId: testUserId,
        excludeFormTriggers: true,
      });

      const testWorkflow = workflows.find((w) => w.id === workflow.id);
      expect(testWorkflow).toBeDefined();
      expect(testWorkflow?.activeOn[0].eventType.id).toBe(parentEventType.id);
      expect(testWorkflow?.activeOn[0].eventType.title).toBe("Unique Title For Preservation Test");
      expect(testWorkflow?.activeOn[0].eventType.parentId).toBeNull();
    });

    it("should handle child event types in activeOn with their own children count", async () => {
      const grandparentEventType = await prisma.eventType.create({
        data: {
          title: "Grandparent Event Type",
          slug: `grandparent-${Date.now()}`,
          length: 30,
          userId: testUserId,
        },
      });
      createdEventTypeIds.push(grandparentEventType.id);

      const parentEventType = await prisma.eventType.create({
        data: {
          title: "Parent Event Type (Child of Grandparent)",
          slug: `parent-child-${Date.now()}`,
          length: 30,
          userId: testUserId,
          parentId: grandparentEventType.id,
        },
      });
      createdEventTypeIds.push(parentEventType.id);

      const workflow = await prisma.workflow.create({
        data: {
          name: "Test Workflow Child ActiveOn",
          trigger: WorkflowTriggerEvents.BEFORE_EVENT,
          time: 24,
          timeUnit: TimeUnit.HOUR,
          userId: testUserId,
        },
      });
      createdWorkflowIds.push(workflow.id);

      const workflowOnEventType = await prisma.workflowsOnEventTypes.create({
        data: {
          workflowId: workflow.id,
          eventTypeId: parentEventType.id,
        },
      });
      createdWorkflowsOnEventTypeIds.push(workflowOnEventType.id);

      const workflows = await WorkflowRepository.findUserWorkflows({
        userId: testUserId,
        excludeFormTriggers: true,
      });

      const testWorkflow = workflows.find((w) => w.id === workflow.id);
      expect(testWorkflow).toBeDefined();
      expect(testWorkflow?.activeOn).toHaveLength(1);
      expect(testWorkflow?.activeOn[0].eventType.parentId).toBe(grandparentEventType.id);
      expect(testWorkflow?.activeOn[0].eventType._count.children).toBe(0);
    });
  });
});
