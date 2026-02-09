import { SchedulingType } from "@calcom/prisma/enums";
import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import {
  bookTimeSlot,
  selectFirstAvailableTimeSlotNextMonth,
  submitAndWaitForResponse,
  testName,
} from "./lib/testUtils";

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

async function navigateToAssignmentTab(page: import("@playwright/test").Page, eventId: number) {
  await page.goto(`/event-types/${eventId}?tabName=team`);
  await page.waitForLoadState("networkidle");
  const form = page.locator("#event-type-form");
  await expect(form).toBeVisible();
  return form;
}

test.describe("Team Event Type - Assignment Tab", () => {
  test("Can navigate to assignment tab for a Collective event type", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.COLLECTIVE);

    const form = await navigateToAssignmentTab(page, teamEvent.id);

    await expect(page.getByTestId("vertical-tab-assignment")).toBeVisible();
    await expect(form.getByText("Scheduling type")).toBeVisible();
  });

  test("Can navigate to assignment tab for a Round Robin event type", async ({ page, users }) => {
    const { teamEvent } = await createTeamWithEvent(users, SchedulingType.ROUND_ROBIN);

    const form = await navigateToAssignmentTab(page, teamEvent.id);

    await expect(page.getByTestId("vertical-tab-assignment")).toBeVisible();
    await expect(form.getByText("Scheduling type")).toBeVisible();
    await expect(form.getByText("Round-robin hosts")).toBeVisible();
  });

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

test.describe("Team Event Type - Tab Navigation", () => {
  test("Can navigate between tabs on a team event type", async ({ page, users }) => {
    const teamMatesObj = [{ name: "teammate-1" }];

    const owner = await users.create(
      { username: "pro-user", name: "pro-user" },
      {
        hasTeam: true,
        teammates: teamMatesObj,
        schedulingType: SchedulingType.ROUND_ROBIN,
      }
    );

    await owner.apiLogin();
    const { team } = await owner.getFirstTeamMembership();
    const teamEvent = await owner.getFirstTeamEvent(team.id);

    await page.goto(`/event-types/${teamEvent.id}?tabName=setup`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#event-type-form")).toBeVisible();

    await page.getByTestId("vertical-tab-assignment").click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#event-type-form").getByText("Scheduling type")).toBeVisible();

    await page.getByTestId("vertical-tab-availability").click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#event-type-form")).toBeVisible();
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

test.describe("Team Event Type - Booking", () => {
  test("Can book a Collective team event", async ({ page, users }) => {
    const { team, teamEvent } = await createTeamWithEvent(users, SchedulingType.COLLECTIVE);

    await page.goto(`/team/${team.slug}/${teamEvent.slug}`);
    await selectFirstAvailableTimeSlotNextMonth(page);
    await bookTimeSlot(page);
    await expect(page.locator("[data-testid=success-page]")).toBeVisible();

    const expectedTitle = `${teamEvent.title} between ${team.name} and ${testName}`;
    await expect(page.locator("[data-testid=booking-title]")).toHaveText(expectedTitle);
  });

  test("Can book a Round Robin team event", async ({ page, users }) => {
    const { owner, team, teamEvent, teamMatesObj } = await createTeamWithEvent(
      users,
      SchedulingType.ROUND_ROBIN
    );

    await page.goto(`/team/${team.slug}/${teamEvent.slug}`);
    await selectFirstAvailableTimeSlotNextMonth(page);
    await bookTimeSlot(page);
    await expect(page.locator("[data-testid=success-page]")).toBeVisible();

    await expect(page.locator(`[data-testid="attendee-name-${testName}"]`)).toHaveText(testName);

    const bookingTitle = await page.getByTestId("booking-title").textContent();
    expect(
      teamMatesObj.concat([{ name: owner.name ?? "" }]).some((teamMate) => {
        const expectedTitle = `${teamEvent.title} between ${teamMate.name} and ${testName}`;
        return expectedTitle === bookingTitle;
      })
    ).toBe(true);
  });
});
