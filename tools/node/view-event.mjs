import { convertProjectToHTML } from '../common/project2html.mjs';
import { convertProjectToJSON } from '../common/project.mjs';

export default async function (project, options) {
  if (options.format?.toLowerCase() === 'json') {
    const data = convertProjectToJSON(project);
    console.log(JSON.stringify(data, null, 2));
  }
  else {
    const html = await convertProjectToHTML(project);
    console.log(html);
  }
}
