export function sleep(ms) {
  if (typeof Utilities !== 'undefined' && Utilities.sleep) {
    return Utilities.sleep(ms);
  }
  return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
}
