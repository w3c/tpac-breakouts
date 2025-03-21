import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/common/envkeys.mjs';
import { fetchProject } from '../tools/node/lib/project.mjs';
import { initSectionHandlers,
         parseSessionBody,
         serializeSessionDescription } from '../tools/common/session.mjs';
import * as assert from 'node:assert';

async function fetchTestProject() {
  return fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
}

describe('The serialization of session descriptions', function () {
  beforeEach(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'session-validation');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('does not introduce changes if description is complete', async function () {
    const project = await fetchTestProject();
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
    const project = await fetchTestProject();
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
    setEnvKey('PROJECT_NUMBER', 'tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
    const project = await fetchTestProject();
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
    setEnvKey('PROJECT_NUMBER', 'tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
    const project = await fetchTestProject();
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
    setEnvKey('PROJECT_NUMBER', 'tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
    const project = await fetchTestProject();
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
    setEnvKey('PROJECT_NUMBER', 'tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
    const project = await fetchTestProject();
    await initSectionHandlers(project);
    const initialBody = `### Estimate of in-person participants

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

https://example.org/discuss

### Agenda for the meeting.

_No response_`;
    const desc = parseSessionBody(initialBody);
    const serializedBody = serializeSessionDescription(desc);
    assert.strictEqual(desc.discussion, 'https://example.org/discuss');
    assert.strictEqual(serializedBody, initialBody);
  });
});