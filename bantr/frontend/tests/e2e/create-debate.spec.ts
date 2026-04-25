import { expect, test } from "@playwright/test";

const debate = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "22222222-2222-2222-2222-222222222222",
  title: "Universal Basic Income Finals",
  topic: "Resolved: universal basic income should replace means-tested welfare.",
  agent_prompt: "Argue the opposition with concise evidence.",
  agent_voice_id: "demo-voice",
  status: "pending",
  livekit_room_name: "debate-e2e-room",
  started_at: null,
  ended_at: null,
  created_at: "2026-04-25T09:00:00.000Z",
};

test("authenticated user can create a debate and land on its detail view", async ({ page }) => {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      json: {
        id: debate.user_id,
        email: "debater@example.com",
        username: "debater",
        role: "user",
        permissions: [],
      },
    });
  });
  await page.route("**/api/v1/debates", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: debate });
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.route(`**/api/v1/debates/${debate.id}`, async (route) => {
    await route.fulfill({ json: debate });
  });

  await page.goto("/create");
  await page.getByLabel("Title").fill(debate.title);
  await page.getByLabel("Topic").fill(debate.topic);
  await page.getByLabel("Agent Prompt").fill(debate.agent_prompt);
  await page.getByRole("button", { name: "Create Debate" }).click();

  await expect(page).toHaveURL(`/debates/${debate.id}`);
  await expect(page.getByRole("heading", { name: debate.title })).toBeVisible();
  await expect(page.getByText(`Room ${debate.livekit_room_name}`)).toBeVisible();
});
