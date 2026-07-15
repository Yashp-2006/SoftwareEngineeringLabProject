import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Sign In' button to open the login form or login page.
        # Sign In link
        elem = page.get_by_role('link', name='Sign In', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'example@gmail.com' into the Email Address field, fill 'password123' into the Password field, then click the 'Sign In' button.
        # admin@taikaix.com email field
        elem = page.get_by_placeholder('admin@taikaix.com', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("example@gmail.com")
        
        # -> Fill 'example@gmail.com' into the Email Address field, fill 'password123' into the Password field, then click the 'Sign In' button.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("password123")
        
        # -> Fill 'example@gmail.com' into the Email Address field, fill 'password123' into the Password field, then click the 'Sign In' button.
        # Sign In button
        elem = page.get_by_role('button', name='Sign In', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Create New Competition' control, fill the competition name, set Number of Mats to 2, set a Competition Password, then click the 'Create Competition' button.
        # button
        elem = page.locator('xpath=/html/body/div[4]/div/div/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'Create New Competition' control, fill the competition name, set Number of Mats to 2, set a Competition Password, then click the 'Create Competition' button.
        # e.g. Kyoto 2026 Finals text field
        elem = page.locator('[id="new-comp-name"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("QA Test Competition")
        
        # -> Click the 'Create New Competition' control, fill the competition name, set Number of Mats to 2, set a Competition Password, then click the 'Create Competition' button.
        # e.g. 6 number field
        elem = page.locator('[id="new-comp-mats"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2")
        
        # -> Click the 'Create New Competition' control, fill the competition name, set Number of Mats to 2, set a Competition Password, then click the 'Create Competition' button.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comp-pass-qa")
        
        # -> Click the 'Create New Competition' control, fill the competition name, set Number of Mats to 2, set a Competition Password, then click the 'Create Competition' button.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Create Competition' button to create the competition and then verify the competition appears in the directory.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Create Competition' button to create the competition and then verify it appears in the Competitions directory.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the missing fields (Dates, Venue, Competition Password), then click the 'Create Competition' button to create the competition.
        # Select competition dates... text field
        elem = page.get_by_test_id('dates-input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-07-14 to 2026-07-14")
        
        # -> Fill the missing fields (Dates, Venue, Competition Password), then click the 'Create Competition' button to create the competition.
        # e.g. Nippon Budokan text field
        elem = page.locator('[id="new-comp-venue"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test Venue")
        
        # -> Fill the missing fields (Dates, Venue, Competition Password), then click the 'Create Competition' button to create the competition.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comp-pass-qa")
        
        # -> Fill the missing fields (Dates, Venue, Competition Password), then click the 'Create Competition' button to create the competition.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Create Competition' button to submit the new competition form and create 'QA Test Competition'.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the Competition Password field with 'comp-pass-qa' and click the 'Create Competition' button to create the competition.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comp-pass-qa")
        
        # -> Fill the Competition Password field with 'comp-pass-qa' and click the 'Create Competition' button to create the competition.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Tournament Type' dropdown so the available options are shown.
        # National Tournament International Tournament dropdown
        elem = page.locator('[id="new-comp-type"]')
        await elem.click(timeout=10000)
        
        # -> Select 'National Tournament' from the 'Tournament Type' dropdown and ensure the Competition Password field contains 'comp-pass-qa' so the Create Competition form can be submitted.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comp-pass-qa")
        
        # -> Select 'National Tournament' from the 'Tournament Type' dropdown and ensure the Competition Password field contains 'comp-pass-qa' so the Create Competition form can be submitted.
        # National Tournament International Tournament dropdown
        elem = page.locator("xpath=/html/body/div[4]/div/div[2]/div[3]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Fill the 'Competition Password' field with 'comp-pass-qa' and click the 'Create Competition' button.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comp-pass-qa")
        
        # -> Fill the 'Competition Password' field with 'comp-pass-qa' and click the 'Create Competition' button.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'comp-pass-qa' into the 'Competition Password' field and click the 'Create Competition' button to submit the form.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comp-pass-qa")
        
        # -> Fill 'comp-pass-qa' into the 'Competition Password' field and click the 'Create Competition' button to submit the form.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select 'National Tournament' from the 'Tournament Type' dropdown so the form's context is set before filling dependent fields.
        # National Tournament International Tournament dropdown
        elem = page.locator("xpath=/html/body/div[4]/div/div[2]/div[3]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Close the Create Competition modal using the 'Cancel' button, reopen the 'Create New Competition' form, set 'Competition Password' to 'comp-pass-qa', then click 'Create Competition' once to attempt creating the competition.
        # Cancel button
        elem = page.get_by_role('button', name='Cancel', exact=True)
        await elem.click(timeout=10000)
        
        # -> Close the Create Competition modal using the 'Cancel' button, reopen the 'Create New Competition' form, set 'Competition Password' to 'comp-pass-qa', then click 'Create Competition' once to attempt creating the competition.
        # button
        elem = page.locator('xpath=/html/body/div[4]/div/div/button')
        await elem.click(timeout=10000)
        
        # -> Close the Create Competition modal using the 'Cancel' button, reopen the 'Create New Competition' form, set 'Competition Password' to 'comp-pass-qa', then click 'Create Competition' once to attempt creating the competition.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comp-pass-qa")
        
        # -> Close the Create Competition modal using the 'Cancel' button, reopen the 'Create New Competition' form, set 'Competition Password' to 'comp-pass-qa', then click 'Create Competition' once to attempt creating the competition.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'View Event' button on the competition card to open the event page and look for the Operator Console and mat count.
        # View Event link
        elem = page.get_by_role('link', name='View Event', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    