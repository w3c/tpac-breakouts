export default async function (url, options) {
  options = options ?? {};
  if (typeof UrlFetchApp !== 'undefined') {
    // AppScript runtime, cannot use fetch directly
    const params = {};
    if (options.method) {
      params.method = options.method;
    }
    if (options.headers) {
      params.headers = options.headers;
    }
    if (options.body) {
      params.payload = options.body;
    }

    const response = UrlFetchApp.fetch(url, params);
    return {
      status: response.getResponseCode(),
      json: async function () {
        if (response.getResponseCode() === 200) {
          const text =  response.getContentText('UTF-8');
          return JSON.parse(text);
        }
      },
      text: async function () {
        return response.getContentText('UTF-8');
      }
    };
  }
  else {
    // Regular runtime, should have a fetch function
    return fetch(url, options);
  }
}