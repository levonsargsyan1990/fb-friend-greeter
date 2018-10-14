const puppeteer = require('puppeteer');
require('dotenv').config()

const username = process.env.USERNAME;
const password = process.env.PASSWORD;

if (!username || !password) {
  return console.error('Error: Username and/or password are not provided. Please follow the readme file before running the script');
}

const loggedCheck = async (page) => {
  try {
    await page.waitForXPath('//h3[contains(., "Log In With One Tap")]', { timeout: 5000 });
    return true;
  } catch(err) {
    return false;
  }
};

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

(async () => {
  try {
    var browser = await puppeteer.launch({ headless: false, slowMo: 25 })
    const context =  browser.defaultBrowserContext()
    const page = await context.newPage();
    
    /* This is a little workaround. The desktop version is asking to enable desktop notifications,
     and there is no way to respond to that dialog (this is a known issue of Chromium devtools as far as I could investigate)
     For this we are using mobile version
     */

    //  Navigating to mobile webpage
    await page.goto('https://m.facebook.com');
    
    // Login
    await page.type('#m_login_email', username);
    await page.type('#m_login_password', password);
    await page.click('#u_0_5');
    
    // Checking if username and password were correct
    const isLoggedIn = await loggedCheck(page)
    if (!isLoggedIn) {
      throw new Error('Username or password are incorrect')
    }

    // Skipping one tap login
    await page.click('._54k8');
    
    // Navigating to "Friends" page
    await page.waitForNavigation();
    await page.click('#u_0_c');

    // Waiting for friend suggestions to be loaded
    const titleXpath = '//header[contains(., "PEOPLE YOU MAY KNOW")]';
    await page.waitForXPath(titleXpath);
    
    // As both friend requests and friend suggestions have same classes, we are taking only those that have "Add Friend" button inside
    const friendsXpath = '//div[contains(@class, "_55wp _4g33 _5pxa") and //button/span[text() = "Add Friend"]]//h1/a';

    // Taking only first 5 friends
    const friendNodes = (await page.$x(friendsXpath)).slice(0, 5);

    // Getting names of suggested people and URLs of their profiles
    const namePromises = friendNodes.map(async friendNode => {
      const name = await (await friendNode.getProperty('innerHTML')).jsonValue();
      const url = await (await friendNode.getProperty('href')).jsonValue();
      return { name, url };
    });

    const friends = await Promise.all(namePromises);

    // Looping through 5 pages
    await asyncForEach(friends, async friend => {
      // Navigationg to profile
      await page.goto(friend.url);
  
      // Finding the "Message" button and clickong it
      const messageButtonXpath = '//div[@data-sigil="hq-profile-logging-action-bar-button"]//a[contains(., "Message")]';
      const messageButton = await page.waitForXPath(messageButtonXpath);
      messageButton.click();
      
      // Typing the message and sending it
      const messageInputXpath = '//textarea[@placeholder="Write a message..."]';
      const messageInput = await page.waitForXPath(messageInputXpath);
      await messageInput.type(`Hello ${friend.name}`);
      await page.click('button[type="submit"]');
    });
    await browser.close();
    console.log('Done')
  } catch (err) {
    console.error('Error: ', err);
    await browser.close();
  }
})();  
