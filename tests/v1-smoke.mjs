import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:4173/";
const OUT = "test-artifacts";
fs.mkdirSync(OUT, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function visible(page, selector) {
  return page.locator(selector).isVisible().catch(() => false);
}

async function attachErrorCapture(page, bucket) {
  page.on("pageerror", error => bucket.push(`PAGEERROR: ${error.message}`));
  page.on("console", msg => {
    if (msg.type() === "error") bucket.push(`CONSOLE: ${msg.text()}`);
  });
}

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  // Scenario 1: brand-new visitor.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    await attachErrorCapture(page, errors);

    const response = await page.goto(BASE, { waitUntil: "networkidle" });
    assert(response?.ok(), "Fresh visitor: index.html did not return OK.");
    await page.waitForTimeout(400);

    assert(await visible(page, "#v1CompanyShell"), "Fresh visitor: company website is not visible.");
    assert(!(await visible(page, ".app-shell")), "Fresh visitor: original app should not be visible over company site.");
    assert((await page.locator("#v1CompanyShell").innerText()).includes("NextStage"), "Fresh visitor: company shell did not render NextStage content.");
    await page.screenshot({ path: `${OUT}/01-company.png`, fullPage: true });

    await page.locator('[data-v1-action="open-app"]').first().click();
    await page.waitForTimeout(200);
    assert(await visible(page, "#v1PrivacyGate"), "Fresh visitor: privacy/terms gate did not appear.");
    assert(await page.locator("#v1TermsCheck").count() === 1, "Fresh visitor: terms checkbox missing.");
    assert(await page.locator("#v1SafetyCheck").count() === 1, "Fresh visitor: safety checkbox missing.");
    await page.screenshot({ path: `${OUT}/02-privacy-gate.png`, fullPage: true });

    await page.locator("#v1TermsCheck").check();
    await page.locator("#v1SafetyCheck").check();
    await page.locator('[data-v1-action="accept-terms"]').click();
    await page.waitForTimeout(250);

    assert(await visible(page, "#authScreen"), "Fresh visitor: auth screen did not appear after accepting terms.");
    assert(await visible(page, "#signInForm"), "Fresh visitor: Sign In is not the default auth view.");
    assert(!(await visible(page, "#createAccountForm")), "Fresh visitor: Create Account should not be the default auth view.");

    const learnTab = page.locator("#v1AuthLearnTab");
    assert(await learnTab.count() === 1, "Fresh visitor: Learn More auth option missing.");
    await learnTab.click();
    await page.waitForTimeout(100);
    assert(await visible(page, "#v1AuthLearnPanel"), "Fresh visitor: Learn More panel did not open.");

    if (errors.length) {
      throw new Error("Fresh visitor browser errors:\n" + errors.join("\n"));
    }
    await context.close();
  }

  // Scenario 2: established signed-in account with accepted terms.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      localStorage.setItem("nextstage-prototype-auth-v1", JSON.stringify({
        id: "local-prototype-account",
        email: "tester@example.com",
        username: "tester",
        firstName: "Test",
        lastName: "Athlete",
        displayName: "Test Athlete",
        passwordHash: "prototype-test-only",
        salt: "prototype-test-only",
        iterations: 150000,
        createdAt: new Date().toISOString()
      }));
      localStorage.setItem("nextstage-prototype-session-v1", JSON.stringify({
        accountId: "local-prototype-account",
        signedIn: true,
        signedInAt: new Date().toISOString()
      }));
      localStorage.setItem("nextstage-prototype-v1-expansion", JSON.stringify({
        version: 1,
        terms: {
          acceptedVersion: "prototype-v1-2026-11",
          acceptedAt: new Date().toISOString()
        },
        entryPreference: "auto",
        activeContext: "athlete",
        enabledContexts: ["athlete"]
      }));
    });

    const page = await context.newPage();
    const errors = [];
    await attachErrorCapture(page, errors);

    const response = await page.goto(BASE, { waitUntil: "networkidle" });
    assert(response?.ok(), "Signed-in user: index.html did not return OK.");
    await page.waitForTimeout(500);

    assert(await visible(page, ".app-shell"), "Signed-in user: original athlete app is not visible.");
    assert(await visible(page, "#view-dashboard"), "Signed-in user: dashboard view is not visible.");
    const dashboardText = await page.locator("#view-dashboard").innerText();
    assert(dashboardText.includes("ATHLETE DASHBOARD") || dashboardText.includes("Athlete Dashboard"), "Signed-in user: athlete dashboard content did not render.");
    assert(await page.locator('[data-v1-action="open-inspiration"]').count() > 0, "Signed-in user: Inspiration control missing.");
    assert(await page.locator('[data-v1-action="open-account"]').count() > 0, "Signed-in user: Account Center control missing.");
    await page.screenshot({ path: `${OUT}/03-athlete-app.png`, fullPage: true });

    await page.locator('[data-v1-action="open-account"]').first().click();
    await page.waitForTimeout(150);
    assert(await visible(page, "#v1PanelBackdrop"), "Signed-in user: Account Center panel did not open.");
    const panelText = await page.locator("#v1PanelBackdrop").innerText();
    assert(panelText.includes("Account") || panelText.includes("Roles"), "Signed-in user: Account Center content missing.");
    await page.locator('[data-v1-action="close-panel"]').click();

    await page.locator('[data-route="profile"]').first().click();
    await page.waitForTimeout(300);
    assert(await visible(page, "#view-profile"), "Signed-in user: Athlete Passport did not open.");
    assert(await page.locator("#v1FeaturedOverview").count() === 1, "Signed-in user: Featured Passport summary was not injected.");

    await page.locator('[data-v1-action="open-admin"]').first().click();
    await page.waitForTimeout(250);
    assert(await visible(page, "#v1AdminShell"), "Admin: backend/admin shell did not appear.");
    const adminText = await page.locator("#v1AdminShell").innerText();
    assert(adminText.includes("Backend") || adminText.includes("Admin"), "Admin: expected backend/admin content missing.");
    assert(await page.locator('[data-v1-admin-tab="inspiration"]').count() === 1, "Admin: Inspiration CMS tab missing.");
    assert(await page.locator('[data-v1-admin-tab="diagnostics"]').count() === 1, "Admin: Diagnostics tab missing.");
    await page.locator('[data-v1-admin-tab="inspiration"]').click();
    await page.waitForTimeout(120);
    assert((await page.locator("#v1AdminShell").innerText()).includes("Inspiration"), "Admin: Inspiration manager did not render.");
    await page.screenshot({ path: `${OUT}/04-admin-inspiration.png`, fullPage: true });

    if (errors.length) {
      throw new Error("Signed-in browser errors:\n" + errors.join("\n"));
    }
    await context.close();
  }

  console.log("V1_SMOKE_TEST_PASS");
} catch (error) {
  failures.push(error?.stack || String(error));
  console.error("V1_SMOKE_TEST_FAIL");
  console.error(failures.join("\n\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
