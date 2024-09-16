/**
 * Function that is supposed to run within the context of a TPAC registrants
 * page. Serialized by "list-chairs".
 */
export default function checkRegistrants(chairs) {
  function matchChair(txt, chair) {
    return txt.includes(chair.name) || txt.includes(chair.email);
  }

  // Extract the list of in-person registrants
  const list = new Set();
  const listStartEl = document.querySelector('h2[id^=meeting]');
  const remoteHeadingEl = document.getElementById('remotes');
  let listEl = listStartEl;
  while (listEl && listEl !== remoteHeadingEl) {
    if (listEl.nodeName === 'UL') {
      const items = [...document.querySelectorAll('li')].map(el =>
        el.textContent.trim().replace(/\s+/g, ' ').split(/:\s*attending/)[0]);
      for (const item of items) {
        list.add(item);
      }
    }
    listEl = listEl.nextElementSibling;
  }
  const inperson = [...list];

  // Extract the list of remote registrants
  let remoteEl = remoteHeadingEl;
  while (remoteEl.nodeName !== 'UL') {
    remoteEl = remoteEl.nextElementSibling;
  }
  const remote = [...remoteEl.querySelectorAll('li')]
    .map(el => el.textContent.trim().replace(/\s+/g, ' '));

  // Compute the list of chairs that need to register
  const needRegistration = chairs.filter(chair =>
    !inperson.find(line => matchChair(line, chair)) &&
    !remote.find(line => matchChair(line, chair)));

  // Compute the list of sessions that have remote-only chairs
  const sessions = chairs
    .map(chair => chair.sessions)
    .filter((session, idx, arr) => arr.indexOf(s => s.number === session.number) === idx);
  const remoteSessions = sessions.filter(session =>
    session.chairs.every(chair => remote.find(line => matchChair(line, chair)))
  );

  let res = [];
  if (remoteSessions.length > 0) {
    res.push('Sessions that have remote-only chairs:');
    for (const session of remoteSessions) {
      res.push(`- #${session.number}: ${session.title} - ${session.chairs.map(c => c.name).join(', ')}`);
    }
    res.push('');
  }

  const mainChairs = needRegistration.filter(chair => chair.sessions.find(s =>
    s.chairs[0].name === chair.name));
  if (mainChairs.length > 0) {
    res.push('Chairs who proposed a session and still need to register:');
    for (const chair of mainChairs) {
      res.push(`- ${chair.name} <${chair.email}> - ${chair.sessions.map(s => '#' + s.number).join(', ')}`);
    }
    res.push('');
  }

  const secondary = needRegistration.filter(chair => !mainChairs.find(c => c.name === chair.name))
  if (secondary.length > 0) {
    res.push('Additional chairs who still need to register:');
    for (const chair of secondary) {
      res.push(`- ${chair.name} <${chair.email}> - ${chair.sessions.map(s => '#' + s.number).join(', ')}`);
    }
  }

  return res.join('\n');
}