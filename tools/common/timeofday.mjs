/**
 * Returns true if the slot is acceptable for the requested time of day.
 *
 * Note the function considers that afternoons start at 13:00 (and that 12:00
 * is still morning in particular). It also considers that evenings start at
 * 19:00.
 *
 * @function
 * @param slot The chosen slot
 * @param timeofday One of `morning`, `afternoon`, `evening`, 'any`
 * @return A boolean
 */
export function isSlotAcceptable(slot, timeofday) {
  if (!slot) {
    return true;
  }
  const hour = parseInt(slot.match(/^(\d+)(?::\d+)?$/)[1], 10);
  switch (timeofday) {
  case 'morning':
    return hour <= 12;
  case 'afternoon':
    return hour > 12 && hour <= 18;
  case 'evening':
    return hour >= 19;
  default:
    return true;
  }
}