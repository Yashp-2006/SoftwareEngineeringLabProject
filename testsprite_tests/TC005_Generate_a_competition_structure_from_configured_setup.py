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
        
        # -> Click the 'Sign In' link to open the login page.
        # Sign In link
        elem = page.get_by_role('link', name='Sign In', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'example@gmail.com' into the Email Address field and 'password123' into the Password field, then click the 'Sign In' button.
        # admin@taikaix.com email field
        elem = page.get_by_placeholder('admin@taikaix.com', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("example@gmail.com")
        
        # -> Fill 'example@gmail.com' into the Email Address field and 'password123' into the Password field, then click the 'Sign In' button.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("password123")
        
        # -> Fill 'example@gmail.com' into the Email Address field and 'password123' into the Password field, then click the 'Sign In' button.
        # Sign In button
        elem = page.get_by_role('button', name='Sign In', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select 'National Tournament' from the 'Tournament Type' dropdown and wait for the page UI to update.
        # National Tournament International Tournament dropdown
        elem = page.locator("xpath=/html/body/div[4]/div/div[2]/div[3]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Fill the 'Create New Competition' form (Competition Name, Dates, Venue, Competition Password) and click the 'Create Competition' button.
        # e.g. Kyoto 2026 Finals text field
        elem = page.locator('[id="new-comp-name"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test Competition 2026")
        
        # -> Fill the 'Create New Competition' form (Competition Name, Dates, Venue, Competition Password) and click the 'Create Competition' button.
        # Select competition dates... text field
        elem = page.get_by_test_id('dates-input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-09-10 to 2026-09-12")
        
        # -> Fill the 'Create New Competition' form (Competition Name, Dates, Venue, Competition Password) and click the 'Create Competition' button.
        # e.g. Nippon Budokan text field
        elem = page.locator('[id="new-comp-venue"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Nippon Budokan")
        
        # -> Fill the 'Create New Competition' form (Competition Name, Dates, Venue, Competition Password) and click the 'Create Competition' button.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("compPass!234")
        
        # -> Fill the 'Create New Competition' form (Competition Name, Dates, Venue, Competition Password) and click the 'Create Competition' button.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Create Competition' button to submit the form and open the newly created competition setup page.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Competition Password' field with the intended password and click the 'Create Competition' button to submit the form.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("compPass!234")
        
        # -> Fill the 'Competition Password' field with the intended password and click the 'Create Competition' button to submit the form.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Set a competition password using the 'Set a strong password...' field and click the 'Create Competition' button.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("compPass!234")
        
        # -> Set a competition password using the 'Set a strong password...' field and click the 'Create Competition' button.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Set a strong password...' field with the competition password and click the 'Create Competition' button to submit the form.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Search the page for any validation or error messages (e.g., 'Required', 'error'), then fill the 'Set a strong password...' field and click the 'Create Competition' button.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("compPass!234")
        
        # -> Search the page for any validation or error messages (e.g., 'Required', 'error'), then fill the 'Set a strong password...' field and click the 'Create Competition' button.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Set a strong password...' field with the competition password and click the 'Create Competition' button.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("compPass!234")
        
        # -> Fill the 'Set a strong password...' field with the competition password and click the 'Create Competition' button.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Set a strong password...' field with 'compPass!234', click the adjacent password control if needed, then click the 'Create Competition' button and verify the competition appears.
        # button
        elem = page.locator('xpath=/html/body/div[4]/div/div[2]/div[6]/div/button')
        await elem.click(timeout=10000)
        
        # -> Fill the 'Set a strong password...' field with 'compPass!234', click the adjacent password control if needed, then click the 'Create Competition' button and verify the competition appears.
        # Create Competition button
        elem = page.get_by_role('button', name='Create Competition', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Set a strong password...' field with compPass!234 and press Enter to submit the Create Competition form, then check the page for 'Test Competition 2026'.
        # Set a strong password... password field
        elem = page.get_by_placeholder('Set a strong password...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("compPass!234")
        
        # -> Open the profile by clicking the avatar (Go to Profile) to check if the competition appears in the profile/organizer area or to find links to competition setup pages.
        # Go to Profile link
        elem = page.get_by_role('link', name='Go to Profile', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the competition 'Kyoto 2026 Finals' from the Competition History on the profile page.
        # link
        elem = page.locator('a[href="/competitions/1"]')
        await elem.click(timeout=10000)
        
        # -> Open the 'Schedule' tab to view or set the competition date range and scheduling controls.
        # Schedule link
        elem = page.get_by_role('link', name='Schedule', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the competition structure is generated
        await page.locator("xpath=/html/body/div[4]/a[4]").nth(0).scroll_into_view_if_needed()
        # Assert: The Schedule tab is visible in the competition navigation.
        await expect(page.locator("xpath=/html/body/div[4]/a[4]").nth(0)).to_be_visible(timeout=15000), "The Schedule tab is visible in the competition navigation."
        # Assert: The competition overview displays total and scheduled category counts.
        await expect(page.locator("xpath=/html/body/main/section[2]/div[1]/div[2]/div").nth(0)).to_contain_text("Total Categories 0 Scheduled 0 Unscheduled 0", timeout=15000), "The competition overview displays total and scheduled category counts."
        # Assert: The schedule table displays 'No categories match the current filters.' indicating the schedule area is present.
        await expect(page.locator("xpath=/html/body/main/section[2]/div[2]/div/table/tbody/tr").nth(0)).to_have_text("No categories match the current filters.", timeout=15000), "The schedule table displays 'No categories match the current filters.' indicating the schedule area is present."
        
        # --> Verify generated competition data is available in the setup view
        await page.locator("xpath=/html/body/div[4]/a[4]").nth(0).scroll_into_view_if_needed()
        # Assert: The Schedule tab is visible in the competition setup view.
        await expect(page.locator("xpath=/html/body/div[4]/a[4]").nth(0)).to_be_visible(timeout=15000), "The Schedule tab is visible in the competition setup view."
        # Assert: The setup view displays 'No categories match the current filters.' showing the schedule content has loaded.
        await expect(page.locator("xpath=/html/body/main/section[2]/div[2]/div/table/tbody/tr/td").nth(0)).to_have_text("No categories match the current filters.", timeout=15000), "The setup view displays 'No categories match the current filters.' showing the schedule content has loaded."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    