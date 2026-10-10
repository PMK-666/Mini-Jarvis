import { expect, test, type Page } from "@playwright/test";

async function useScenario(page: Page, scenario: string) {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem("e2e-init")) {
      localStorage.clear();
      localStorage.setItem("itinera.scenario", JSON.stringify(s));
      sessionStorage.setItem("e2e-init", "1");
    }
  }, scenario);
}

/** Open the Philippines trip, set dates, run the engine and resolve the incomplete parts. */
async function planPhilippines(page: Page) {
  await page.goto("/");
  await page.getByTestId("trip-philippines-honeymoon").click();
  await expect(page.getByRole("heading", { name: "Philippines", level: 1 })).toBeVisible();
  await page.getByTestId("book-trip").click();
  await page.getByTestId("start-date").fill("2026-12-11");
  await page.getByTestId("check-availability").click();
  await expect(page.getByTestId("needs-attention")).toBeVisible({ timeout: 30_000 });
  // Bangkok hotel was never chosen in the original → customer chooses
  await page.locator('[data-testid^="alt-select:stay-bkk:kimpton"]').click();
  await expect(page.getByTestId("needs-attention").or(page.getByTestId("ready"))).toBeVisible({ timeout: 30_000 });
  // Four open nights → Manila
  await page.getByTestId("alt-choice:choice-open:manila").click();
  await expect(page.getByTestId("needs-attention").or(page.getByTestId("ready"))).toBeVisible({ timeout: 30_000 });
}

async function checkout(page: Page, card = "4242 4242 4242 4242") {
  await page.getByTestId("to-checkout").click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await page.getByTestId("fill-demo").click();
  await page.getByTestId("card-number").fill(card);
  await page.getByTestId("card-exp").fill("1230");
  await page.getByTestId("card-cvc").fill("123");
  await page.getByTestId("accept-terms").check();
  await page.getByTestId("pay").click();
}

test("sold-out room → choose alternative → pay → confirmed", async ({ page }) => {
  await useScenario(page, "cauayan-room-unavailable");
  await planPhilippines(page);
  const issue = page.getByTestId("issue-unavailable");
  await expect(issue).toContainText("El Nido: your room is unavailable");
  await expect(page.getByTestId("to-checkout")).toBeDisabled();
  await issue.locator('[data-testid^="alt-room:stay-cauayan:hillside-villa"]').click();
  await expect(page.getByTestId("ready")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Changes you made")).toBeVisible();
  await checkout(page);
  await expect(page.getByTestId("booking-confirmed")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Booking reference ITN-/)).toBeVisible();
  await page.goto("/trips");
  await expect(page.getByText("Philippines · Honeymoon")).toBeVisible();
});

test("unreachable resort is blocked until an earlier flight is chosen", async ({ page }) => {
  await useScenario(page, "late-flight-transfer");
  await planPhilippines(page);
  const issue = page.getByTestId("issue-transfer-feasibility");
  await expect(issue).toContainText("You can't reach Cauayan Island Resort");
  await issue.getByRole("button", { name: /T6404/ }).click();
  await expect(page.getByTestId("ready")).toBeVisible({ timeout: 30_000 });
});

test("supplier declines during booking → replacement → confirmed", async ({ page }) => {
  await useScenario(page, "booking-partial-failure");
  await planPhilippines(page);
  await expect(page.getByTestId("ready")).toBeVisible();
  await checkout(page);
  await expect(page.getByTestId("booking-action-required")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("res-transfer-usu-houseboat")).toContainText("Confirmed");
  await page.getByTestId("see-replacements").click();
  await page.getByTestId("replacement-option").first().click();
  await expect(page.getByTestId("booking-confirmed")).toBeVisible({ timeout: 60_000 });
});

test("declined card books nothing and lets you retry", async ({ page }) => {
  await useScenario(page, "all-available");
  await planPhilippines(page);
  await expect(page.getByTestId("ready")).toBeVisible();
  await checkout(page, "4000 0000 0000 0002");
  await expect(page.getByTestId("booking-declined")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("try-again").click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
});

test("price change must be accepted before payment", async ({ page }) => {
  await useScenario(page, "price-change");
  await planPhilippines(page);
  await checkout(page);
  await expect(page.getByText("The price has changed")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("accept-price").click();
  await expect(page.getByTestId("booking-confirmed")).toBeVisible({ timeout: 60_000 });
});

test("marketplace filters and saving work", async ({ page }) => {
  await useScenario(page, "all-available");
  await page.goto("/");
  await page.getByRole("button", { name: "Ski Holiday", exact: true }).click();
  await expect(page.getByTestId("trip-switzerland-ski")).toBeVisible();
  await expect(page.getByTestId("trip-philippines-honeymoon")).toHaveCount(0);
  await page.getByRole("button", { name: "Save Switzerland" }).click();
  await page.goto("/saved");
  await expect(page.getByTestId("trip-switzerland-ski")).toBeVisible();
});
