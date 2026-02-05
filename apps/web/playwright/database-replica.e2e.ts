import { expect } from "@playwright/test";

import { SchedulingType } from "@calcom/prisma/enums";

import { test } from "./lib/fixtures";
import { bookTimeSlot, selectFirstAvailableTimeSlotNextMonth } from "./lib/testUtils";

test.describe.configure({ mode: "parallel" });

test.describe("Database Replica Header", () => {
  test.afterEach(({ users }) => users.deleteAll());

  test("Team booking page loads correctly with x-cal-replica header", async ({ page, users }) => {
    const owner = await users.create(
      { username: "replica-test-user", name: "replica-test-user" },
      {
        hasTeam: true,
        teammates: [{ name: "teammate-1" }],
        schedulingType: SchedulingType.COLLECTIVE,
      }
    );

    const { team } = await owner.getFirstTeamMembership();
    const { slug: teamEventSlug } = await owner.getFirstTeamEvent(team.id);

    await page.setExtraHTTPHeaders({
      "x-cal-replica": "read",
    });

    await page.goto(`/team/${team.slug}/${teamEventSlug}`);
    await expect(page).toHaveURL(`/team/${team.slug}/${teamEventSlug}`);

    // Wait for booker calendar to load
    await page.getByTestId("incrementMonth").waitFor();
    await selectFirstAvailableTimeSlotNextMonth(page);
    await bookTimeSlot(page);
    await expect(page.locator("[data-testid=success-page]")).toBeVisible();
  });

  test("Team booking page loads correctly without x-cal-replica header", async ({ page, users }) => {
    const owner = await users.create(
      { username: "no-replica-test-user", name: "no-replica-test-user" },
      {
        hasTeam: true,
        teammates: [{ name: "teammate-1" }],
        schedulingType: SchedulingType.COLLECTIVE,
      }
    );

    const { team } = await owner.getFirstTeamMembership();
    const { slug: teamEventSlug } = await owner.getFirstTeamEvent(team.id);

    await page.goto(`/team/${team.slug}/${teamEventSlug}`);
    await expect(page).toHaveURL(`/team/${team.slug}/${teamEventSlug}`);

    // Wait for booker calendar to load
    await page.getByTestId("incrementMonth").waitFor();
    await selectFirstAvailableTimeSlotNextMonth(page);
    await bookTimeSlot(page);
    await expect(page.locator("[data-testid=success-page]")).toBeVisible();
  });

  test("Team booking page handles unknown replica gracefully", async ({ page, users }) => {
    const owner = await users.create(
      { username: "unknown-replica-user", name: "unknown-replica-user" },
      {
        hasTeam: true,
        teammates: [{ name: "teammate-1" }],
        schedulingType: SchedulingType.COLLECTIVE,
      }
    );

    const { team } = await owner.getFirstTeamMembership();
    const { slug: teamEventSlug } = await owner.getFirstTeamEvent(team.id);

    await page.setExtraHTTPHeaders({
      "x-cal-replica": "nonexistent-replica",
    });

    await page.goto(`/team/${team.slug}/${teamEventSlug}`);
    await expect(page).toHaveURL(`/team/${team.slug}/${teamEventSlug}`);

    // Should fallback to primary and still work
    await page.getByTestId("incrementMonth").waitFor();
    await selectFirstAvailableTimeSlotNextMonth(page);
    await bookTimeSlot(page);
    await expect(page.locator("[data-testid=success-page]")).toBeVisible();
  });
});
