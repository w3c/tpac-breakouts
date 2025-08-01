import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateSession } from '../tools/common/validate.mjs';
import { computeSessionCalendarUpdates } from '../tools/common/meetings.mjs';
import { convertEntryToJSON } from '../tools/common/calendar.mjs';

describe('Conversion to calendar entries', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/breakouts-day-2024');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('converts an existing breakout session entry to the expected format', async function () {
    const project = await loadProject();
    const sessionNumber = 22;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    const actions = computeSessionCalendarUpdates(session, project);
    const entry = actions.update[0];
    const status = 'draft';
    const json = convertEntryToJSON({ entry, session, project, status,
      author: 41989
    });

    assert.deepStrictEqual(
      json,
      {
        "uuid": "9e7690a7-cd77-4192-ab60-337243f9b70a",
        "general": {
          "title": "Web features, Baseline status, and standardization signals",
          "description": "How do web developers talk about web features? What names do they use? How do these features map to specifications, fine-grained API functions and tests? What does a developer view tell us about the interoperability of the web platform?\n\nThe [`web-features` project](https://github.com/web-platform-dx/web-features), [envisioned in 2022](https://www.w3.org/2022/09/TPAC/breakouts.html#webdx) and [launched in 2023](https://www.w3.org/2023/09/TPAC/demos/web-features.html), explores the set of interoperable features of the web platform by:\n\n- Creating feature definitions, which identify and describe capabilities of web browsers.\n- Generating [Baseline](https://github.com/web-platform-dx/web-features/blob/main/docs/baseline.md) support data, which summarizes the availability of web features across key browsers and releases.\n- Publishing the `web-features` npm package, which bundles feature identifiers with Baseline statuses.\n\nDeveloped by the WebDX Community Group and contributors, web-features data leverages compatibility data from the browser-compat-data project, is already [integrated in MDN](https://developer.mozilla.org/en-US/blog/baseline-evolution-on-mdn/), [Can I Use](https://caniuse.com/css-nesting), [Web Platform Tests](https://github.com/web-platform-tests/wpt.fyi/blob/main/api/query/README.md#feature), and is starting to reach additional authors of JavaScript libraries and dashboards.\n\nLooking forward, feature identifiers at the \"right\" level make it possible to tag signals from the web community in surveys, browser standard positions, bug trackers, polyfills and usage counters. It also makes it easier to combine these signals with other projects that generate data out of specifications such as [`browser-specs`](https://github.com/w3c/browser-specs/) and [webref](https://github.com/w3c/webref).\n\nFeatures are also used in standardization groups, informally to organize discussions, but also formally to address transition requirements set forth by the W3C Process Document for advancing specifications on the Recommendation track. Within the Process, [new features](https://www.w3.org/2023/Process-20231103/#class-4) are defined as substantive changes that add new functionality, and used to assess [implementation experience](https://www.w3.org/2023/Process-20231103/#implementation-experience), document functionality that is considered [at risk](https://www.w3.org/2023/Process-20231103/#at-risk), and scope changes that may be incorporated in a specification depending on its maturity stage. This raises questions on the intersection between web-features and W3C’s standardization process, including:\n\n- Can web-features provide useful information to working groups?\n- Can it also inform the standardization process, e.g., to detect the need to transition a feature implemented by more than one browser out of incubation?\n- What additional data or tooling would make web-features a powerful tool for standards bodies?\n- How would **you** like to see web-features data presented in standards work?",
          "location": "Koto",
          "big-meeting": "tpac2024",
          "category": "breakout-sessions",
          "visibility": "public",
          "status": "draft",
          "author": 41989
        },
        "dates": {
          "start": "2024-03-12 14:00:00",
          "end": "2024-03-12 15:00:00",
          "timezone": "Etc/UTC"
        },
        "participants": {
          "individuals": [
            5,
            55,
            56
          ]
        },
        "joining": {
          "chat": "https://webirc.w3.org/?channels=web-features",
          "visibility": "registered"
        },
        "agenda": {
          "url": "",
          "agenda": "**Chairs:**\ntidoust, captainbrosset, atopal\n\n**Description:**\nHow do web developers talk about web features? What names do they use? How do these features map to specifications, fine-grained API functions and tests? What does a developer view tell us about the interoperability of the web platform?\n\nThe [`web-features` project](https://github.com/web-platform-dx/web-features), [envisioned in 2022](https://www.w3.org/2022/09/TPAC/breakouts.html#webdx) and [launched in 2023](https://www.w3.org/2023/09/TPAC/demos/web-features.html), explores the set of interoperable features of the web platform by:\n\n- Creating feature definitions, which identify and describe capabilities of web browsers.\n- Generating [Baseline](https://github.com/web-platform-dx/web-features/blob/main/docs/baseline.md) support data, which summarizes the availability of web features across key browsers and releases.\n- Publishing the `web-features` npm package, which bundles feature identifiers with Baseline statuses.\n\nDeveloped by the WebDX Community Group and contributors, web-features data leverages compatibility data from the browser-compat-data project, is already [integrated in MDN](https://developer.mozilla.org/en-US/blog/baseline-evolution-on-mdn/), [Can I Use](https://caniuse.com/css-nesting), [Web Platform Tests](https://github.com/web-platform-tests/wpt.fyi/blob/main/api/query/README.md#feature), and is starting to reach additional authors of JavaScript libraries and dashboards.\n\nLooking forward, feature identifiers at the \"right\" level make it possible to tag signals from the web community in surveys, browser standard positions, bug trackers, polyfills and usage counters. It also makes it easier to combine these signals with other projects that generate data out of specifications such as [`browser-specs`](https://github.com/w3c/browser-specs/) and [webref](https://github.com/w3c/webref).\n\nFeatures are also used in standardization groups, informally to organize discussions, but also formally to address transition requirements set forth by the W3C Process Document for advancing specifications on the Recommendation track. Within the Process, [new features](https://www.w3.org/2023/Process-20231103/#class-4) are defined as substantive changes that add new functionality, and used to assess [implementation experience](https://www.w3.org/2023/Process-20231103/#implementation-experience), document functionality that is considered [at risk](https://www.w3.org/2023/Process-20231103/#at-risk), and scope changes that may be incorporated in a specification depending on its maturity stage. This raises questions on the intersection between web-features and W3C’s standardization process, including:\n\n- Can web-features provide useful information to working groups?\n- Can it also inform the standardization process, e.g., to detect the need to transition a feature implemented by more than one browser out of incubation?\n- What additional data or tooling would make web-features a powerful tool for standards bodies?\n- How would **you** like to see web-features data presented in standards work?\n\n**Goal(s):**\nShare updates on the web-features project, its use to inform the standardization process, and additional data, tooling and visualizations to make web-features a powerful tool for standards bodies.\n\n\n**Agenda:**\n- Presentation (20mn - see [slides](https://docs.google.com/presentation/d/e/2PACX-1vT5PiEfUCia_p-hIKu-LxQ90qwQks42FtsXTxI4wATYuG1OWEQlCnGcP7R_gENVnGUa82ZTGkQXQgRQ/pub))\n  - Web developers and web features\n  - Web features and standardization\n  - First stab at gathering signals to inform standardization process\n    - Late incubations\n    - Late Working Drafts\n    - Not-so-well supported Recommendations\n- Discussion (30mn)\n\n**Materials:**\n- [minutes](https://www.w3.org/2024/03/12-web-features-minutes.html)\n- [Session proposal on GitHub](https://github.com/w3c/tpac-breakouts/issues/22)\n"
        },
        "minutes": {
          "url": "https://www.w3.org/2024/03/12-web-features-minutes.html"
        }
      });
  });
});