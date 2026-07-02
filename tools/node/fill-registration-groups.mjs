import puppeteer from 'puppeteer';
import { authenticate } from './view-registrants.mjs';
import { getEnvKey } from '../common/envkeys.mjs';
import { parseSessionMeetings } from '../common/meetings.mjs';
import { validateGrid } from '../common/validate.mjs';
import { convertProjectToRegistrationHTML } from '../common/project2html.mjs';

function expandTitle(title) {
  return title
    .replace(/ (BG|Business Group)($|,| and| &|:|>)/gi, ' Business Group$2')
    .replace(/ (CG|Community Group)($|,| and| &|:|>)/gi, ' Community Group$2')
    .replace(/ (IG|Interest Group)($|,| and| &|:|>)/gi, ' Interest Group$2')
    .replace(/ (WG|Working Group)($|,| and| &|:|>)/gi, ' Working Group$2')
    .replace(/ (TF|Task Force)($|,| and| &|:|>)/gi, ' Task Force$2')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
}

export default async function (project, options) {
  for (const session of project.sessions) {
    session.meetings = parseSessionMeetings(session, project);
    session.days = [...new Set(session.meetings.map(meeting => meeting.day))]
      .sort();
  }
  await validateGrid(project);
  if (options.view) {
    const html = await convertProjectToRegistrationHTML(project);
    console.log(html);
  }
  else {
    console.warn('Launch Puppeteer...');
    const browser = await puppeteer.launch({ headless: false });
    console.warn('Launch Puppeteer... done');

    try {
      console.warn(`Retrieve environment variables...`);
      const W3C_LOGIN = await getEnvKey('W3C_LOGIN');
      console.warn(`- W3C_LOGIN: ${W3C_LOGIN}`);
      const W3C_PASSWORD = await getEnvKey('W3C_PASSWORD');
      console.warn(`- W3C_PASSWORD: ***`);
      console.warn(`Retrieve environment variables... done`);

      let page;
      let bigMeetingId;
      let meetingsInRegistrationForm;

      console.warn('Get big meeting ID...');
      page = await browser.newPage();

      try {
        const bigMeetingUrl = `https://www.w3.org/admin/tpacs/list?filter%5Bslug%5D%5Bvalue%5D=${project.metadata.slug}`;
        await page.goto(bigMeetingUrl);
        await authenticate(page, W3C_LOGIN, W3C_PASSWORD, bigMeetingUrl);
        bigMeetingId = await page.evaluate(() =>
          document.querySelector('.content form table>tbody>tr>td:nth-child(2)')
            .textContent
            .trim());
        if (!bigMeetingId) {
          throw new Error('Could not retrieve the big meeting ID from the admin interface');
        }
        console.warn(`- big meeting ID: ${bigMeetingId}`);
      }
      finally {
        console.warn('Get big meeting ID... done');
        await page.close();
      }

      console.warn('Get list of meetings already listed...');
      page = await browser.newPage();
      try {
        const groupListUrl = `https://www.w3.org/admin/tpac-meetings/list?filter%5B_page%5D=1&filter%5B_per_page%5D=250&filter%5B_sort_order%5D=DESC&filter%5B_sort_by%5D=id&filter%5Bdays__tpac%5D%5Bvalue%5D=${bigMeetingId}`;
        await page.goto(groupListUrl);
        await authenticate(page, W3C_LOGIN, W3C_PASSWORD, groupListUrl);
        meetingsInRegistrationForm = await page.evaluate(() =>
          [...document.querySelectorAll('.content table>tbody>tr')]
            .map(el => {
              const cells = [...el.querySelectorAll('td:nth-child(2),td:nth-child(3),td:nth-child(5),td:nth-child(6),td:nth-child(7)')]
                .map(td => td.textContent.trim());
              return {
                id: cells[0],
                name: cells[1],
                days: cells[2].split(',').map(day => day.trim()),
                groups: cells[3].split(',').map(group => group.trim()),
                observers: cells[4] === 'yes'
              };
            })
        );
        if (!meetingsInRegistrationForm) {
          throw new Error('Could not retrieve the list of meetings already registered for the big meeting');
        }
        console.warn(`- nb entries already in the registration form: ${meetingsInRegistrationForm.length}`);
      }
      finally {
        console.warn('Get list of meetings already listed... done');
        await page.close();
      }

      console.warn('Compute list of meetings to add...');
      const meetings = project.sessions.map(session => Object.assign({
        name: expandTitle(session.title),
        days: session.days,
        groups: (session.groups ?? [])
          .filter(group =>
            group.w3cId && group.w3cId !== -1 &&
            typeof group.w3cId === 'number')
          .map(group => {
            group.name = expandTitle(group.name);
            return group;
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
        observers: true
      }));
      console.warn(`- nb entries that should be in the registration form: ${meetings.length}`);

      const meetingsToAdd = meetings
        .filter(meeting => !meetingsInRegistrationForm.find(m => m.name === meeting.name));
      console.warn(`- nb entries to add to the registration form: ${meetingsToAdd.length}`);
      console.warn('Compute list of meetings to add... done');

      for (const meeting of meetingsToAdd) {
        console.warn(`Add ${meeting.name}...`);
        page = await browser.newPage();
        try {
          await addMeeting(meeting, page, W3C_LOGIN, W3C_PASSWORD)
        }
        finally {
          console.warn(`Add ${meeting.name}... done`);
          await page.close();
          console.warn('Wait 2s to play nice with server...');
          await sleep(2000);
          console.warn('Wait 2s to play nice with server... done');
        }
      }
    }
    finally {
      console.warn('Close Puppeteer...');
      await browser.close();
      console.warn('Close Puppeteer... done');
    }
  }
}

async function addMeeting(meeting, page, login, password) {
  const createUrl = 'https://www.w3.org/admin/tpac-meetings/create';
  await page.goto(createUrl);
  await authenticate(page, login, password, createUrl);

  async function selectEl(selector) {
    const el = await page.waitForSelector(selector);
    if (!el) {
      throw new Error(`No element in page that matches "${selector}"`);
    }
    return el;
  }
  async function fillTextInput(selector, value) {
    const el = await selectEl(selector);

    // Clear input (select all and backspace!)
    // Note this should use platform-specific commands in theory
    // ... but that would not work on Mac in any case, see:
    // https://github.com/puppeteer/puppeteer/issues/1313
    await el.click({ clickCount: 1 });
    await page.keyboard.down('ControlLeft');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('ControlLeft');
    await el.press('Backspace');

    if (value) {
      await el.type(value);
    }
  }
  async function clickOnElement(selector) {
    const el = await selectEl(selector);
    await el.click();
  }
  async function chooseOptions(selector, values) {
    const el = await selectEl(selector);
    await el.select(...values);
  }
  async function toggleBox(selector, status) {
    const checked = await page.$eval(selector, el => el.checked ? 'checked' : 'unchecked');
    if (checked !== status) {
      const el = await selectEl(selector);
      await el.click();
    }
  }

  const dayOptions = await page.evaluate(() =>
    [...document.querySelectorAll('select[id$=days] option')]
      .map(option => Object.assign({
        value: option.getAttribute('value'),
        day: option.textContent.trim()
      }))
  );

  await fillTextInput('input[id$=name]', meeting.name);
  await chooseOptions('select[id$=days]',
    meeting.days.map(day =>
      dayOptions.find(d => d.day === day).value
    )
  );
  
  if (meeting.groups?.length > 0) {
    await page.evaluate(`window.tpac_groups = ${JSON.stringify(meeting.groups, null, 2)};`);
    await page.$eval('select[id$=groups_autocomplete_input]', el => el.innerHTML +=
      window.tpac_groups
        .filter(group => !el.querySelector(`option[selected][value="${group.w3cId}"]`))
        .map(group => `<option value="${group.w3cId}" selected="selected">${group.name}</option>`)
        .join('\n')
    );
    await page.$eval('div[id$=groups_hidden_inputs_wrap]', el => {
      const formId = el.id.split('_')[0];
      el.innerHTML +=
        window.tpac_groups
          .filter(group => !el.querySelector(`input[value="${group.w3cId}"]`))
          .map(group => `<input type="hidden" name="${formId}[groups][]" value="${group.w3cId}">`)
          .join('\n');
    });
  }

  await clickOnElement('button[name=btn_create_and_edit]');
  await page.waitForNavigation();
  const createdUrl = await page.evaluate(() => window.location.href);
  if (!createdUrl.match(/^https:\/\/www\.w3\.org\/admin\/tpac-meetings\/\d+\/edit$/)) {
    throw new Error(`Could not create meeting entry for
      ${JSON.stringify(meeting, null, 2)}
    `);
  }
}