export default {
  sessions: [
    {
      title: "Web features, Baseline status, and standardization signals",
      number: 22,
      author: 'tidoust',
      body: `
### Session description

How do web developers talk about web features? What names do they use? How do these features map to specifications, fine-grained API functions and tests? What does a developer view tell us about the interoperability of the web platform?

The [\`web-features\` project](https://github.com/web-platform-dx/web-features), [envisioned in 2022](https://www.w3.org/2022/09/TPAC/breakouts.html#webdx) and [launched in 2023](https://www.w3.org/2023/09/TPAC/demos/web-features.html), explores the set of interoperable features of the web platform by:

- Creating feature definitions, which identify and describe capabilities of web browsers.
- Generating [Baseline](https://github.com/web-platform-dx/web-features/blob/main/docs/baseline.md) support data, which summarizes the availability of web features across key browsers and releases.
- Publishing the \`web-features\` npm package, which bundles feature identifiers with Baseline statuses.

Developed by the WebDX Community Group and contributors, web-features data leverages compatibility data from the browser-compat-data project, is already [integrated in MDN](https://developer.mozilla.org/en-US/blog/baseline-evolution-on-mdn/), [Can I Use](https://caniuse.com/css-nesting), [Web Platform Tests](https://github.com/web-platform-tests/wpt.fyi/blob/main/api/query/README.md#feature), and is starting to reach additional authors of JavaScript libraries and dashboards.

Looking forward, feature identifiers at the \"right\" level make it possible to tag signals from the web community in surveys, browser standard positions, bug trackers, polyfills and usage counters. It also makes it easier to combine these signals with other projects that generate data out of specifications such as [\`browser-specs\`](https://github.com/w3c/browser-specs/) and [webref](https://github.com/w3c/webref).

Features are also used in standardization groups, informally to organize discussions, but also formally to address transition requirements set forth by the W3C Process Document for advancing specifications on the Recommendation track. Within the Process, [new features](https://www.w3.org/2023/Process-20231103/#class-4) are defined as substantive changes that add new functionality, and used to assess [implementation experience](https://www.w3.org/2023/Process-20231103/#implementation-experience), document functionality that is considered [at risk](https://www.w3.org/2023/Process-20231103/#at-risk), and scope changes that may be incorporated in a specification depending on its maturity stage. This raises questions on the intersection between web-features and W3C’s standardization process, including:

- Can web-features provide useful information to working groups?
- Can it also inform the standardization process, e.g., to detect the need to transition a feature implemented by more than one browser out of incubation?
- What additional data or tooling would make web-features a powerful tool for standards bodies?
- How would **you** like to see web-features data presented in standards work?

### Session goal

Share updates on the web-features project, its use to inform the standardization process, and additional data, tooling and visualizations to make web-features a powerful tool for standards bodies.

### Session type

Breakout (Default)

### Additional session chairs (Optional)

@captainbrosset, @atopal

### IRC channel (Optional)

#web-features

### Other sessions where we should avoid scheduling conflicts (Optional)

_No response_

### Instructions for meeting planners (Optional)

_No response_

### Agenda (link or inline) (Optional)

- Presentation (20mn - see [slides](https://docs.google.com/presentation/d/e/2PACX-1vT5PiEfUCia_p-hIKu-LxQ90qwQks42FtsXTxI4wATYuG1OWEQlCnGcP7R_gENVnGUa82ZTGkQXQgRQ/pub))
  - Web developers and web features
  - Web features and standardization
  - First stab at gathering signals to inform standardization process
    - Late incubations
    - Late Working Drafts
    - Not-so-well supported Recommendations
    - Discussion (30mn)

### Links to calendar (Optional)

- [Wednesday, 13:00 - 14:00](https://www.w3.org/events/meetings/9e7690a7-cd77-4192-ab60-337243f9b70a/)

### Meeting materials (Optional)

- [Minutes](https://www.w3.org/2024/03/12-web-features-minutes.html)`,
    }
  ]
};