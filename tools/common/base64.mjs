export function base64Encode(str) {
  if (typeof Utilities !== 'undefined' && Utilities.base64Encode) {
    return Utilities.base64Encode(str, Utilities.Charset.UTF_8);
  }
  else {
    return Buffer.from(str).toString('base64');
  }
}