import { prisma } from "@calcom/prisma";
import { SchedulingType } from "@calcom/prisma/enums";
import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { submitAndWaitForResponse } from "./lib/testUtils";

test.describe.configure({ mode: "parallel" });

test.afterEach(async ({ users }) => {
  await users.deleteAll();
});

async function saveEventType(page: import("@playwright/test").Page) {
  await submitAndWaitForResponse(page, "/api/trpc/eventTypesHeavy/update?batch=1", {
    action: () => page.locator("[data-testid=update-eventtype]").click(),
  });
}

async function createTeamWithEvent(
  users: Parameters<Parameters<typeof test>[2]>[0]["users"],
  schedulingType: SchedulingType
) {
  const teamMatesObj = [{ name: "teammate-1" }, { name: "teammate-2" }];
  const owner = await users.create(
    { username: "pro-user", name: "pro-user" },
    {
      hasTeam: true,
      teammates: teamMatesObj,
      schedulingType,
    }
  );
  await owner.apiLogin();
  const { team } = await owner.getFirstTeamMembership();
  const teamEvent = await owner.getFirstTeamEvent(team.id);
  return { owner, team, teamEvent, teamMatesObj };
}

async function createTeamWithManyMembers(
  users: Parameters<Parameters<typeof test>[2]>[0]["users"],
  schedulingType: SchedulingType,
  memberCount: number
) {
  const teamMatesObj = Array.from({ length: memberCount }, (_, i) => ({
    name: `teammate-${i + 1}`,
  }));
  const owner = await users.create(
    { username: "pro-user", name: "pro-user" },
    {
      hasTeam: true,
      teammates: teamMatesObj,
      schedulingType,
    }
  );
  await owner.apiLogin();
  const { team } = await owner.getFirstTeamMembership();
  const teamEvent = await owner.getFirstTeamEvent(team.id);
  return { owner, team, teamEvent, teamMatesObj };
}

async function navigateToAssignmentTab(page: import("@playwright/test").Page, eventId: number) {
  await page.goto(`/event-types/${eventId}?tabName=team`);
  await page.waitForLoadState("networkidle");
  const form = page.locator("#event-type-form");
  await expect(form).toBeVisible();
  return form;
}

test.describe("Team Event Type - Assignment Tab", () => {
  test("Displays hosts on the Collective assignment tab", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.COLLECTIVE);

    const form = await navigateToAssignmentTab(page, teamEvent.id);

    await expect(form.getByText("Fixed hosts").first()).toBeVisible();
    await expect(form.getByText("pro-user")).toBeVisible();
  });

  test("Displays hosts on the Round Robin assignment tab", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.ROUND_ROBIN);

    const form = await navigateToAssignmentTab(page, teamEvent.id);

    await expect(form.getByText("Round-robin hosts")).toBeVisible();
    await expect(form.getByText("pro-user")).toBeVisible();
  });

  test("Can switch scheduling type from Collective to Round Robin and save", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.COLLECTIVE);

    await navigateToAssignmentTab(page, teamEvent.id);

    const form = page.locator("#event-type-form");
    const schedulingTypeSelect = form.getByText("Scheduling type").locator("..").getByRole("combobox");
    await schedulingTypeSelect.click();
    await page.locator('[id*="-option-"]').filter({ hasText: "Round robin" }).click();

    await expect(form.getByText("Round-robin hosts")).toBeVisible();

    await saveEventType(page);

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#event-type-form").getByText("Round-robin hosts")).toBeVisible();
  });

  test("Can switch scheduling type from Round Robin to Collective and save", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.ROUND_ROBIN);

    await navigateToAssignmentTab(page, teamEvent.id);

    const form = page.locator("#event-type-form");
    const schedulingTypeSelect = form.getByText("Scheduling type").locator("..").getByRole("combobox");
    await schedulingTypeSelect.click();
    await page.locator('[id*="-option-"]').filter({ hasText: "Collective" }).click();

    await expect(form.getByText("Fixed hosts").first()).toBeVisible();

    await saveEventType(page);

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#event-type-form").getByText("Fixed hosts").first()).toBeVisible();
  });
});

test.describe("Team Event Type - Round Robin Weights", () => {
  test("Can see weights toggle on Round Robin event", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.ROUND_ROBIN);

    const form = await navigateToAssignmentTab(page, teamEvent.id);

    await expect(form.getByText("Enable weights")).toBeVisible();
  });
});

test.describe("Team Event Type - Host Assignment and Removal", () => {
  test("Can remove a host from a Collective event type", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.COLLECTIVE);
    const form = await navigateToAssignmentTab(page, teamEvent.id);

    const hostRow = form.locator("li").filter({ hasText: "teammate-1" });
    await expect(hostRow).toBeVisible();

    await hostRow.locator("svg").last().click();

    await expect(hostRow).not.toBeVisible();
  });

  test("Can remove a host from a Round Robin event type", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.ROUND_ROBIN);
    const form = await navigateToAssignmentTab(page, teamEvent.id);

    const hostRow = form.locator("li").filter({ hasText: "teammate-1" });
    await expect(hostRow).toBeVisible();

    await hostRow.locator("svg").last().click();

    await expect(hostRow).not.toBeVisible();
  });

  test("Can add a host back after removal on a Round Robin event", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.ROUND_ROBIN);
    const form = await navigateToAssignmentTab(page, teamEvent.id);

    const hostRow = form.locator("li").filter({ hasText: "teammate-1" });
    await expect(hostRow).toBeVisible();
    await hostRow.locator("svg").last().click();
    await expect(hostRow).not.toBeVisible();

    const hostSelect = form.getByRole("combobox").nth(1);
    await hostSelect.click();
    await hostSelect.fill("teammate-1");
    await page.locator('[id*="-option-"]').filter({ hasText: "teammate-1" }).click();

    await expect(form.locator("li").filter({ hasText: "teammate-1" })).toBeVisible();
  });

  test("Can toggle assign all team members on a Round Robin event", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.ROUND_ROBIN);
    const form = await navigateToAssignmentTab(page, teamEvent.id);

    await expect(form.getByText("Add all team members, including future members")).toBeVisible();
    const toggle = page.getByTestId("assign-all-team-members-toggle");
    await expect(toggle).toBeVisible();
  });

  test("Host removal persists after saving and reloading", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.ROUND_ROBIN);
    const form = await navigateToAssignmentTab(page, teamEvent.id);

    const initialHosts = await prisma.host.findMany({
      where: { eventTypeId: teamEvent.id },
      select: { userId: true },
    });
    const initialCount = initialHosts.length;

    const hostRow = form.locator("li").filter({ hasText: "teammate-1" });
    await expect(hostRow).toBeVisible();
    await hostRow.locator("svg").last().click();
    await expect(hostRow).not.toBeVisible();

    await saveEventType(page);

    const hostsAfterSave = await prisma.host.findMany({
      where: { eventTypeId: teamEvent.id },
      select: {
        userId: true,
        user: { select: { name: true } },
      },
    });
    expect(hostsAfterSave).toHaveLength(initialCount - 1);
    const remainingNames = hostsAfterSave.map((h) => h.user.name);
    expect(remainingNames).not.toContain("teammate-1");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator("#event-type-form").locator("li").filter({ hasText: "teammate-1" })
    ).not.toBeVisible();
  });

  test("Can remove the 30th host from a 40-member Round Robin event", async ({ page, users }) => {
    test.slow();
    const { teamEvent } = await createTeamWithManyMembers(users, SchedulingType.ROUND_ROBIN, 40);
    const form = await navigateToAssignmentTab(page, teamEvent.id);

    const initialHosts = await prisma.host.findMany({
      where: { eventTypeId: teamEvent.id },
      select: { userId: true },
    });
    expect(initialHosts).toHaveLength(41);

    const targetHost = form.locator("li").filter({ hasText: "teammate-30" });
    await targetHost.scrollIntoViewIfNeeded();
    await expect(targetHost).toBeVisible();
    await targetHost.locator("svg").last().click();
    await expect(targetHost).not.toBeVisible();

    await saveEventType(page);

    const hostsAfterSave = await prisma.host.findMany({
      where: { eventTypeId: teamEvent.id },
      select: {
        userId: true,
        user: { select: { name: true } },
      },
    });
    expect(hostsAfterSave).toHaveLength(40);
    const remainingNames = hostsAfterSave.map((h) => h.user.name);
    expect(remainingNames).not.toContain("teammate-30");
  });
});

test.describe("Team Event Type - Managed Event Assignment", () => {
  test("Can navigate to managed event assignment tab and see members", async ({ page, users }) => {
    const teamMateName = "teammate-1";

    const adminUser = await users.create(null, {
      hasTeam: true,
      teammates: [{ name: teamMateName }],
      teamEventTitle: "Managed",
      teamEventSlug: "managed",
      schedulingType: "MANAGED",
      addManagedEventToTeamMates: true,
    });

    await adminUser.apiLogin();
    const { team } = await adminUser.getFirstTeamMembership();
    const managedEvent = await adminUser.getFirstTeamEvent(team.id, SchedulingType.MANAGED);

    await page.goto(`/event-types/${managedEvent.id}?tabName=team`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("#event-type-form").getByText("Add all team members, including future members")
    ).toBeVisible();
  });
});
