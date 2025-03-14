import reportError from './lib/report-error.mjs';


export default async function () {
  try {
    console.log('Export metadata to GitHub...');
    console.log('- TODO: export metadata to GitHub');
    console.log('Export metadata to GitHub... done');

    console.log('Report result...');
    console.log('- TODO: report result');
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}