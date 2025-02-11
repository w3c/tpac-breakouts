export function getSessionSections(template) {
  const sessionSections = (template ? template.body : [])
    .filter(section => !!section.id);

  // The "calendar" and "materials" sections are not part of the template.
  // They are added manually or automatically when need arises. For the
  // purpose of validation and serialization, we need to add them to the list
  // of sections (as custom "auto hide" sections that only get displayed when
  // they are not empty).
  sessionSections.push({
    id: 'calendar',
    attributes: {
      label: 'Links to calendar',
      autoHide: true
    }
  });
  sessionSections.push({
    id: 'materials',
    attributes: {
      label: 'Meeting materials',
      autoHide: true
    }
  });

  return sessionSections;
}