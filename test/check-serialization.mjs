import { describe, it, beforeEach } from 'node:test';
import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { initSectionHandlers,
         parseSessionBody,
         serializeSessionDescription,
         validateSessionBody } from '../tools/common/session.mjs';
import * as assert from 'node:assert';

describe('The serialization of session descriptions', function () {
  beforeEach(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/session-validation');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('does not introduce changes if description is complete', async function () {
    const project = await loadProject();
    await initSectionHandlers(project);
    const initialBody = `### Session description

My session is rich.

### Session goal

Uncover bugs.

### Session type

Breakout (Default)

### Additional session chairs (Optional)

_No response_

### Estimated number of in-person attendees

Fewer than 20 people

### IRC channel (Optional)

_No response_

### Other sessions where we should avoid scheduling conflicts (Optional)

_No response_

### Instructions for meeting planners (Optional)

_No response_

### Agenda (link or inline)

_No response_`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(serializedBody, initialBody);
  });


  it('completes description with additional sections as needed', async function () {
    const project = await loadProject();
    await initSectionHandlers(project);
    const initialBody = `### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`;
    const expectedBody = `### Session description

My session is rich.

### Session goal

Uncover bugs.

### Session type

Breakout (Default)

### Additional session chairs (Optional)

_No response_

### Estimated number of in-person attendees

_No response_

### IRC channel (Optional)

_No response_

### Other sessions where we should avoid scheduling conflicts (Optional)

_No response_

### Instructions for meeting planners (Optional)

_No response_

### Agenda (link or inline)

_No response_`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(serializedBody, expectedBody);
  });

  it('handles times choices correctly', async function () {
    setEnvKey('REPOSITORY', 'test/tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
    const project = await loadProject();
    await initSectionHandlers(project);
    const initialBody = `### Estimate of in-person participants

16-30

### Select preferred dates and times (11-15 September)

- [ ] Monday, 09:30 - 11:00
- [ ] Monday, 11:30 - 13:00
- [X] Monday, 14:30 - 16:30
- [X] Monday, 17:00 - 18:30
- [ ] Tuesday, 09:30 - 11:00
- [ ] Tuesday, 11:30 - 13:00
- [ ] Tuesday, 14:30 - 16:30
- [ ] Tuesday, 17:00 - 18:30
- [ ] Thursday, 09:30 - 11:00
- [ ] Thursday, 11:30 - 13:00
- [ ] Thursday, 14:30 - 16:30
- [ ] Thursday, 17:00 - 18:30
- [ ] Friday, 09:30 - 11:00
- [ ] Friday, 11:30 - 13:00
- [ ] Friday, 14:30 - 16:30
- [ ] Friday, 17:00 - 18:30

### Other sessions where we should avoid scheduling conflicts (Optional)

_No response_

### Other instructions for meeting planners (Optional)

_No response_

### Discussion channel (Optional)

_No response_

### Agenda for the meeting.

_No response_`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(serializedBody, initialBody);
  });


  it('adds times section if missing', async function () {
    setEnvKey('REPOSITORY', 'test/tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
    const project = await loadProject();
    await initSectionHandlers(project);
    const initialBody = `### Estimate of in-person participants

16-30`;
    const expectedBody = `### Estimate of in-person participants

16-30

### Select preferred dates and times (11-15 September)

- [ ] Monday, 09:30 - 11:00
- [ ] Monday, 11:30 - 13:00
- [ ] Monday, 14:30 - 16:30
- [ ] Monday, 17:00 - 18:30
- [ ] Tuesday, 09:30 - 11:00
- [ ] Tuesday, 11:30 - 13:00
- [ ] Tuesday, 14:30 - 16:30
- [ ] Tuesday, 17:00 - 18:30
- [ ] Thursday, 09:30 - 11:00
- [ ] Thursday, 11:30 - 13:00
- [ ] Thursday, 14:30 - 16:30
- [ ] Thursday, 17:00 - 18:30
- [ ] Friday, 09:30 - 11:00
- [ ] Friday, 11:30 - 13:00
- [ ] Friday, 14:30 - 16:30
- [ ] Friday, 17:00 - 18:30

### Other sessions where we should avoid scheduling conflicts (Optional)

_No response_

### Other instructions for meeting planners (Optional)

_No response_

### Discussion channel (Optional)

_No response_

### Agenda for the meeting.

_No response_`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(serializedBody, expectedBody);
  });


  it('handles times choices correctly', async function () {
    setEnvKey('REPOSITORY', 'test/tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
    const project = await loadProject();
    await initSectionHandlers(project);
    const initialBody = `### Estimate of in-person participants

16-30

### Select preferred dates and times (11-15 September)

- [ ] Monday, 09:30 - 11:00
- [ ] Monday, 11:30 - 13:00
- [X] Monday, 14:30 - 16:30
- [X] Monday, 17:00 - 18:30
- [ ] Tuesday, 09:30 - 11:00
- [ ] Tuesday, 11:30 - 13:00
- [ ] Tuesday, 14:30 - 16:30
- [ ] Tuesday, 17:00 - 18:30
- [ ] Thursday, 09:30 - 11:00
- [ ] Thursday, 11:30 - 13:00
- [ ] Thursday, 14:30 - 16:30
- [ ] Thursday, 17:00 - 18:30
- [ ] Friday, 09:30 - 11:00
- [ ] Friday, 11:30 - 13:00
- [ ] Friday, 14:30 - 16:30
- [ ] Friday, 17:00 - 18:30

### Other sessions where we should avoid scheduling conflicts (Optional)

_No response_

### Other instructions for meeting planners (Optional)

_No response_

### Discussion channel (Optional)

_No response_

### Agenda for the meeting.

_No response_`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(serializedBody, initialBody);
  });


  it('parses the discussion URL correctly', async function () {
    setEnvKey('REPOSITORY', 'test/tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
    const project = await loadProject();
    project.sessionSections = project.sessionSections
      .filter(section => section.id === 'discussion');
    await initSectionHandlers(project);
    const initialBody = `### Discussion channel (Optional)

https://example.org/discuss`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(desc.discussion, 'https://example.org/discuss');
    assert.strictEqual(serializedBody, initialBody);
  });


  it('serializes conflicting issues on multiple lines', async function () {
    const project = await loadProject();
    project.sessionSections = project.sessionSections
      .filter(section => section.id === 'conflicts');
    await initSectionHandlers(project);
    const initialBody = `### Other sessions where we should avoid scheduling conflicts (Optional)

#30, #12, #42`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    const expectedBody = initialBody.replace(
      /#30, #12, #42/,
      '- #30\n- #12\n- #42');
    assert.strictEqual(serializedBody, expectedBody);
  });


  it('understands conflicting issues on multiple lines', async function () {
    const project = await loadProject();
    project.sessionSections = project.sessionSections
      .filter(section => section.id === 'conflicts');
    await initSectionHandlers(project);
    const initialBody = `### Other sessions where we should avoid scheduling conflicts (Optional)

- #30
- #12
- #42`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(serializedBody, initialBody);
  });

  it('supports raw URLs in conflicting issues', async function () {
    const project = await loadProject();
    project.sessionSections = project.sessionSections
      .filter(section => section.id === 'conflicts');
    await initSectionHandlers(project);
    const initialBody = `### Other sessions where we should avoid scheduling conflicts (Optional)

- https://github.com/w3c/tpac-breakouts-2024/#30
- https://github.com/w3c/tpac-breakouts-2024/#12
- https://github.com/w3c/tpac-breakouts-2024/#42`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    const expectedBody = initialBody.replace(
      /https:\/\/github\.com\/w3c\/tpac-breakouts-2024\//g,
      '');
    assert.strictEqual(serializedBody, expectedBody);
  });

  it('supports links in conflicting issues', async function () {
    const project = await loadProject();
    project.sessionSections = project.sessionSections
      .filter(section => section.id === 'conflicts');
    await initSectionHandlers(project);
    const initialBody = `### Other sessions where we should avoid scheduling conflicts (Optional)

- [https://github.com/w3c/tpac-breakouts-2024/#30](#30)
- [https://github.com/w3c/tpac-breakouts-2024/#12](#12)
- [https://github.com/w3c/tpac-breakouts-2024/#42](#42)`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    const expectedBody = initialBody.replace(
      /\[https:\/\/github\.com\/w3c\/tpac-breakouts-2024\/#\d+\]\(([^\)]+)\)/g,
      '$1');
    assert.strictEqual(serializedBody, expectedBody);
  });

  it('supports URLs in IRC channels', async function () {
    const project = await loadProject();
    project.sessionSections = project.sessionSections
      .filter(section => section.id === 'shortname');
    await initSectionHandlers(project);
    const initialBody = `### IRC channel (Optional)

[\`#rich-session\`](https://webirc.w3.org/?channels=rich-session)`;
    const errors = validateSessionBody(initialBody);
    assert.deepEqual(errors, []);
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(serializedBody, initialBody);
  });

  it('supports URLs in list of additional chairs', async function () {
    const project = await loadProject();
    project.sessionSections = project.sessionSections
      .filter(section => section.id === 'chairs');
    await initSectionHandlers(project);
    const initialBody = `### Additional session chairs (Optional)

@ianbjacobs, [https://github.com/tidoust](tidoust)`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    const expectedBody = initialBody.replace(
      /\[https:\/\/github\.com\/tidoust\]\(([^\)]+)\)/g,
      '$1');
    assert.strictEqual(serializedBody, expectedBody);
  });
});