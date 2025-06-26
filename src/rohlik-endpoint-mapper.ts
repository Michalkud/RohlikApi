import { chromium, BrowserContext, Cookie } from 'playwright';
import fs from 'fs';

// Paste your cookies here or load from a file
const futureExpiry = Math.floor(Date.now() / 1000) + 31536000; // 1 year from now
const cookies: Cookie[] = [
  {"domain":"www.rohlik.cz","path":"/","name":"userId","value":"989721","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":"www.rohlik.cz","path":"/","name":"closedAnnouncements","value":"%5B%7B%22updatedAt%22%3A%222025-03-21T12%3A54%3A33Z%22%2C%22validUntil%22%3A1758345022556%7D%5D","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"_gcl_au","value":"1.1.669167976.1743851586","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":"www.rohlik.cz","path":"/","name":"sailthru_visitor","value":"e9a304ce-a5fc-4f33-8074-826955ebbcf9","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"sailthru_hid","value":"8abe41e7ed4f9de3417fa63bfa2852f55f2b6251a6956421beb31f179b545125dabb5e9558a60106665b60d1","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"_fbp","value":"fb.1.1743851588299.92512369885888361","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"_tt_enable_cookie","value":"1","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"_ttp","value":"01JR2TF2XDT5YWBWG32GEAHP7K_.tt.1","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"_ga","value":"GA1.1.516594129.1744718822","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"_hjSessionUser_203416","value":"eyJpZCI6IjFkMjM0YTBjLWM5NzUtNWU2My1hNGQwLWU3NzY3OWQ0Nzk4ZiIsImNyZWF0ZWQiOjE3NDM4NTE1ODg0MzYsImV4aXN0aW5nIjp0cnVlfQ==","sameSite":"Lax","secure":true,"expires":futureExpiry,"httpOnly":false},
  {"domain":"www.rohlik.cz","path":"/","name":"tutorialDelivery","value":"true","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"__exponea_etc__","value":"773e65a0-19dc-43c3-afbd-d6a08f968bc1","sameSite":"Lax","secure":true,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"udid","value":"0197a60e-53a8-7f9b-84ab-330978621d13@1750837646275","sameSite":"Lax","secure":true,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"_clck","value":"1whlmcg%7C2%7Cfx3%7C0%7C1921","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"__exponea_time2__","value":"0.008219480514526367","sameSite":"Lax","secure":true,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"__cfruid","value":"97e68f24c068d5b7d83c5ecd03fbb679b766c09a-1750923443","sameSite":"Lax","secure":true,"expires":futureExpiry,"httpOnly":true},
  {"domain":".rohlik.cz","path":"/","name":"_cfuvid","value":"gj2qhsJbSUOoBUNavmJrcCQ.eO5MoNWieGzUWwqmJ_4-1750923443645-0.0.1.1-604800000","sameSite":"Lax","secure":true,"expires":futureExpiry,"httpOnly":true},
  {"domain":"www.rohlik.cz","path":"/","name":"language","value":"cs-CZ","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":"www.rohlik.cz","path":"/","name":"NEXT_LOCALE","value":"cs-CZ","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"PHPSESSION","value":"h0ra8Jqy5Lt8afrhQIBX9iGeqslR4vjH","sameSite":"Lax","secure":true,"expires":futureExpiry,"httpOnly":true},
  {"domain":".rohlik.cz","path":"/","name":"cto_bundle","value":"1UgdkV85aFQ1MCUyRlRIQ2U2QmJmWnJGbXdkQnZ2MWJmJTJGR3Z4VzJ4cE9IWjRXNDdDY3VjeHM5UHZiU2hNY2VocHhRSm5PSERFelR6a1VOTnREckQ5YTlNeEhZNm13U3FPTVFkMVF3dGVQRjN2aUp0RHR3RXFDT2J6ZmZ2dlVLcmxyTUl5VzRrazZHJTJCJTJCZWh0bVJhJTJGWjkzZCUyQnBEZUlCc2wzZEJuRzljUXdITzgwYldyNFBDWEVYT0xsSWFDQ3NqR1NUeU10N1FBazBWcE9HOWclMkJRTnFFbEFYVjJFb1ElM0QlM0Q","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"ttcsid","value":"1750925231399::EZQXY1DKb5WsH1VuIi82.9.1750930761315","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"ttcsid_CSQC173C77U9RHEHQI30","value":"1750925231399::_M22s9AW4bSXQT3t0BA9.9.1750930761695","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":".rohlik.cz","path":"/","name":"_clsk","value":"1abvlmj%7C1750930762629%7C25%7C1%7Cz.clarity.ms%2Fcollect","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":"www.rohlik.cz","path":"/","name":"lastVisit","value":"1750930183262","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":"www.rohlik.cz","path":"/","name":"currentVisit","value":"1750931361130","sameSite":"Lax","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":"www.rohlik.cz","path":"/","name":"_dd_s","value":"aid=305f96e4-8395-4ccf-9f7a-5672f1d57a4c&rum=0&expire=1750932261868","sameSite":"Strict","secure":false,"expires":futureExpiry,"httpOnly":false},
  {"domain":"www.rohlik.cz","path":"/","name":"userId","value":"989721","sameSite":"Lax","secure":false},
  {"domain":"www.rohlik.cz","path":"/","name":"closedAnnouncements","value":"%5B%7B%22updatedAt%22%3A%222025-03-21T12%3A54%3A33Z%22%2C%22validUntil%22%3A1758345022556%7D%5D","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"_gcl_au","value":"1.1.669167976.1743851586","sameSite":"Lax","secure":false},
  {"domain":"www.rohlik.cz","path":"/","name":"sailthru_visitor","value":"e9a304ce-a5fc-4f33-8074-826955ebbcf9","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"sailthru_hid","value":"8abe41e7ed4f9de3417fa63bfa2852f55f2b6251a6956421beb31f179b545125dabb5e9558a60106665b60d1","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"_fbp","value":"fb.1.1743851588299.92512369885888361","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"_tt_enable_cookie","value":"1","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"_ttp","value":"01JR2TF2XDT5YWBWG32GEAHP7K_.tt.1","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"_ga","value":"GA1.1.516594129.1744718822","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"_hjSessionUser_203416","value":"eyJpZCI6IjFkMjM0YTBjLWM5NzUtNWU2My1hNGQwLWU3NzY3OWQ0Nzk4ZiIsImNyZWF0ZWQiOjE3NDM4NTE1ODg0MzYsImV4aXN0aW5nIjp0cnVlfQ==","sameSite":"Lax","secure":true},
  {"domain":"www.rohlik.cz","path":"/","name":"tutorialDelivery","value":"true","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"__exponea_etc__","value":"773e65a0-19dc-43c3-afbd-d6a08f968bc1","sameSite":"Lax","secure":true},
  {"domain":".rohlik.cz","path":"/","name":"udid","value":"0197a60e-53a8-7f9b-84ab-330978621d13@1750837646275","sameSite":"Lax","secure":true},
  {"domain":".rohlik.cz","path":"/","name":"_clck","value":"1whlmcg%7C2%7Cfx3%7C0%7C1921","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"__exponea_time2__","value":"0.008219480514526367","sameSite":"Lax","secure":true},
  {"domain":".rohlik.cz","path":"/","name":"__cfruid","value":"97e68f24c068d5b7d83c5ecd03fbb679b766c09a-1750923443","sameSite":"Lax","secure":true},
  {"domain":".rohlik.cz","path":"/","name":"_cfuvid","value":"gj2qhsJbSUOoBUNavmJrcCQ.eO5MoNWieGzUWwqmJ_4-1750923443645-0.0.1.1-604800000","sameSite":"Lax","secure":true},
  {"domain":"www.rohlik.cz","path":"/","name":"language","value":"cs-CZ","sameSite":"Lax","secure":false},
  {"domain":"www.rohlik.cz","path":"/","name":"NEXT_LOCALE","value":"cs-CZ","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"PHPSESSION","value":"h0ra8Jqy5Lt8afrhQIBX9iGeqslR4vjH","sameSite":"Lax","secure":true},
  {"domain":".rohlik.cz","path":"/","name":"cto_bundle","value":"1UgdkV85aFQ1MCUyRlRIQ2U2QmJmWnJGbXdkQnZ2MWJmJTJGR3Z4VzJ4cE9IWjRXNDdDY3VjeHM5UHZiU2hNY2VocHhRSm5PSERFelR6a1VOTnREckQ5YTlNeEhZNm13U3FPTVFkMVF3dGVQRjN2aUp0RHR3RXFDT2J6ZmZ2dlVLcmxyTUl5VzRrazZHJTJCJTJCZWh0bVJhJTJGWjkzZCUyQnBEZUlCc2wzZEJuRzljUXdITzgwYldyNFBDWEVYT0xsSWFDQ3NqR1NUeU10N1FBazBWcE9HOWclMkJRTnFFbEFYVjJFb1ElM0QlM0Q","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"ttcsid","value":"1750925231399::EZQXY1DKb5WsH1VuIi82.9.1750930761315","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"ttcsid_CSQC173C77U9RHEHQI30","value":"1750925231399::_M22s9AW4bSXQT3t0BA9.9.1750930761695","sameSite":"Lax","secure":false},
  {"domain":".rohlik.cz","path":"/","name":"_clsk","value":"1abvlmj%7C1750930762629%7C25%7C1%7Cz.clarity.ms%2Fcollect","sameSite":"Lax","secure":false},
  {"domain":"www.rohlik.cz","path":"/","name":"lastVisit","value":"1750930183262","sameSite":"Lax","secure":false},
  {"domain":"www.rohlik.cz","path":"/","name":"currentVisit","value":"1750931361130","sameSite":"Lax","secure":false},
  {"domain":"www.rohlik.cz","path":"/","name":"_dd_s","value":"aid=305f96e4-8395-4ccf-9f7a-5672f1d57a4c&rum=0&expire=1750932261868","sameSite":"Strict","secure":false},
  {"domain":"www.rohlik.cz","path":"/","name":"JSESSIONID","value":"node01c338nvbg5pt1t813rlmv84zl732304.node0","sameSite":"Lax","secure":false},
  {"domain":"www.rohlik.cz","path":"/","name":"sailthru_pageviews","value":"47","sameSite":"Lax","secure":false}
];

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Log all network requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('rohlik.cz')) {
      console.log(`[${request.method()}] ${url}`);
      if (request.postData()) {
        console.log('Payload:', request.postData());
      }
    }
  });
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('rohlik.cz') && response.status() >= 400) {
      console.log(`Error response: [${response.status()}] ${url}`);
    }
  });

  // Go to homepage (should be logged in)
  await page.goto('https://www.rohlik.cz');
  await page.waitForTimeout(3000);

  // Automate product search
  const searchSelector = 'input[type="search"], input[placeholder*="Hledat"], input[placeholder*="Vyhledat"]';
  await page.waitForSelector(searchSelector);
  await page.fill(searchSelector, 'mléko');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000); // Wait for search results

  // Click the first "add to cart" button
  const addToCartSelector = '[data-testid*="add-to-cart"], button[aria-label*="Přidat do košíku"], button:has-text("Přidat do košíku")';
  await page.waitForSelector(addToCartSelector, { timeout: 10000 });
  await page.click(addToCartSelector);
  await page.waitForTimeout(4000); // Wait for cart update

  console.log('Product search and add to cart complete. Check the console for mapped endpoints.');
  await page.waitForTimeout(10000); // Allow time for network requests to finish

  await browser.close();
}

main().catch(console.error); 