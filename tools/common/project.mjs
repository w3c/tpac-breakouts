/**
 * List of allowed timezone values.
 *
 * The list comes from running the following query on any W3C calendar entry:
 *
 *  [...document.querySelectorAll('#event_timezone option')]
 *   .map(option => option.getAttribute('value'))
 *   .filter(value => !!value);
 *
 * This query should return an array with >430 entries.
 */
const timezones = [
  'Pacific/Niue',
  'Pacific/Midway',
  'Pacific/Pago_Pago',
  'Pacific/Rarotonga',
  'Pacific/Honolulu',
  'Pacific/Johnston',
  'Pacific/Tahiti',
  'Pacific/Marquesas',
  'Pacific/Gambier',
  'America/Adak',
  'America/Anchorage',
  'America/Juneau',
  'America/Metlakatla',
  'America/Nome',
  'America/Sitka',
  'America/Yakutat',
  'Pacific/Pitcairn',
  'America/Hermosillo',
  'America/Mazatlan',
  'America/Creston',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Phoenix',
  'America/Santa_Isabel',
  'PST8PDT',
  'America/Los_Angeles',
  'America/Tijuana',
  'America/Vancouver',
  'America/Dawson',
  'America/Whitehorse',
  'America/Bahia_Banderas',
  'America/Belize',
  'America/Costa_Rica',
  'America/El_Salvador',
  'America/Guatemala',
  'America/Managua',
  'America/Merida',
  'America/Mexico_City',
  'America/Monterrey',
  'America/Regina',
  'America/Swift_Current',
  'America/Tegucigalpa',
  'Pacific/Galapagos',
  'America/Chihuahua',
  'MST7MDT',
  'America/Boise',
  'America/Cambridge_Bay',
  'America/Denver',
  'America/Edmonton',
  'America/Inuvik',
  'America/Yellowknife',
  'America/Eirunepe',
  'America/Rio_Branco',
  'CST6CDT',
  'America/North_Dakota/Beulah',
  'America/North_Dakota/Center',
  'America/Chicago',
  'America/Indiana/Knox',
  'America/Matamoros',
  'America/Menominee',
  'America/North_Dakota/New_Salem',
  'America/Rainy_River',
  'America/Rankin_Inlet',
  'America/Resolute',
  'America/Indiana/Tell_City',
  'America/Winnipeg',
  'America/Bogota',
  'Pacific/Easter',
  'America/Coral_Harbour',
  'America/Cancun',
  'America/Cayman',
  'America/Jamaica',
  'America/Panama',
  'America/Guayaquil',
  'America/Ojinaga',
  'America/Lima',
  'America/Boa_Vista',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Manaus',
  'America/Porto_Velho',
  'America/Anguilla',
  'America/Antigua',
  'America/Aruba',
  'America/Barbados',
  'America/Blanc-Sablon',
  'America/Curacao',
  'America/Dominica',
  'America/Grenada',
  'America/Guadeloupe',
  'America/Kralendijk',
  'America/Lower_Princes',
  'America/Marigot',
  'America/Martinique',
  'America/Montserrat',
  'America/Port_of_Spain',
  'America/Puerto_Rico',
  'America/Santo_Domingo',
  'America/St_Barthelemy',
  'America/St_Kitts',
  'America/St_Lucia',
  'America/St_Thomas',
  'America/St_Vincent',
  'America/Tortola',
  'America/La_Paz',
  'America/Montreal',
  'America/Havana',
  'EST5EDT',
  'America/Detroit',
  'America/Grand_Turk',
  'America/Indianapolis',
  'America/Iqaluit',
  'America/Louisville',
  'America/Indiana/Marengo',
  'America/Kentucky/Monticello',
  'America/Nassau',
  'America/New_York',
  'America/Nipigon',
  'America/Pangnirtung',
  'America/Indiana/Petersburg',
  'America/Port-au-Prince',
  'America/Thunder_Bay',
  'America/Toronto',
  'America/Indiana/Vevay',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Guyana',
  'America/Caracas',
  'America/Buenos_Aires',
  'America/Catamarca',
  'America/Cordoba',
  'America/Jujuy',
  'America/Argentina/La_Rioja',
  'America/Mendoza',
  'America/Argentina/Rio_Gallegos',
  'America/Argentina/Salta',
  'America/Argentina/San_Juan',
  'America/Argentina/San_Luis',
  'America/Argentina/Tucuman',
  'America/Argentina/Ushuaia',
  'Atlantic/Bermuda',
  'America/Glace_Bay',
  'America/Goose_Bay',
  'America/Halifax',
  'America/Moncton',
  'America/Thule',
  'America/Araguaina',
  'America/Bahia',
  'America/Belem',
  'America/Fortaleza',
  'America/Maceio',
  'America/Recife',
  'America/Santarem',
  'America/Sao_Paulo',
  'Antarctica/Palmer',
  'America/Punta_Arenas',
  'America/Santiago',
  'Atlantic/Stanley',
  'America/Cayenne',
  'America/Asuncion',
  'Antarctica/Rothera',
  'America/Paramaribo',
  'America/Montevideo',
  'America/St_Johns',
  'America/Noronha',
  'Atlantic/South_Georgia',
  'America/Miquelon',
  'America/Godthab',
  'Atlantic/Azores',
  'Atlantic/Cape_Verde',
  'America/Scoresbysund',
  'Etc/UTC',
  'Etc/GMT',
  'Africa/Abidjan',
  'Africa/Accra',
  'Africa/Bamako',
  'Africa/Banjul',
  'Africa/Bissau',
  'Africa/Conakry',
  'Africa/Dakar',
  'America/Danmarkshavn',
  'Europe/Dublin',
  'Africa/Freetown',
  'Europe/Guernsey',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
  'Africa/Lome',
  'Europe/London',
  'Africa/Monrovia',
  'Africa/Nouakchott',
  'Africa/Ouagadougou',
  'Atlantic/Reykjavik',
  'Atlantic/St_Helena',
  'Africa/Sao_Tome',
  'Antarctica/Troll',
  'Atlantic/Canary',
  'Africa/Casablanca',
  'Africa/El_Aaiun',
  'Atlantic/Faeroe',
  'Europe/Lisbon',
  'Atlantic/Madeira',
  'Africa/Algiers',
  'Europe/Amsterdam',
  'Europe/Andorra',
  'Europe/Belgrade',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Budapest',
  'Europe/Busingen',
  'Africa/Ceuta',
  'Europe/Copenhagen',
  'Europe/Gibraltar',
  'Europe/Ljubljana',
  'Arctic/Longyearbyen',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Monaco',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Podgorica',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/San_Marino',
  'Europe/Sarajevo',
  'Europe/Skopje',
  'Europe/Stockholm',
  'Europe/Tirane',
  'Africa/Tunis',
  'Europe/Vaduz',
  'Europe/Vatican',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zagreb',
  'Europe/Zurich',
  'Africa/Bangui',
  'Africa/Brazzaville',
  'Africa/Douala',
  'Africa/Kinshasa',
  'Africa/Lagos',
  'Africa/Libreville',
  'Africa/Luanda',
  'Africa/Malabo',
  'Africa/Ndjamena',
  'Africa/Niamey',
  'Africa/Porto-Novo',
  'Africa/Blantyre',
  'Africa/Bujumbura',
  'Africa/Gaborone',
  'Africa/Harare',
  'Africa/Juba',
  'Africa/Khartoum',
  'Africa/Kigali',
  'Africa/Lubumbashi',
  'Africa/Lusaka',
  'Africa/Maputo',
  'Africa/Windhoek',
  'Europe/Athens',
  'Asia/Beirut',
  'Europe/Bucharest',
  'Africa/Cairo',
  'Europe/Chisinau',
  'Asia/Famagusta',
  'Asia/Gaza',
  'Asia/Hebron',
  'Europe/Helsinki',
  'Europe/Kaliningrad',
  'Europe/Kiev',
  'Europe/Mariehamn',
  'Asia/Nicosia',
  'Europe/Riga',
  'Europe/Sofia',
  'Europe/Tallinn',
  'Africa/Tripoli',
  'Europe/Uzhgorod',
  'Europe/Vilnius',
  'Europe/Zaporozhye',
  'Asia/Jerusalem',
  'Africa/Johannesburg',
  'Africa/Maseru',
  'Africa/Mbabane',
  'Asia/Aden',
  'Asia/Baghdad',
  'Asia/Bahrain',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Riyadh',
  'Africa/Addis_Ababa',
  'Indian/Antananarivo',
  'Africa/Asmera',
  'Indian/Comoro',
  'Africa/Dar_es_Salaam',
  'Africa/Djibouti',
  'Africa/Kampala',
  'Indian/Mayotte',
  'Africa/Mogadishu',
  'Africa/Nairobi',
  'Asia/Amman',
  'Asia/Damascus',
  'Europe/Moscow',
  'Europe/Minsk',
  'Europe/Simferopol',
  'Europe/Kirov',
  'Antarctica/Syowa',
  'Europe/Istanbul',
  'Europe/Volgograd',
  'Asia/Tehran',
  'Asia/Yerevan',
  'Asia/Baku',
  'Asia/Tbilisi',
  'Asia/Dubai',
  'Asia/Muscat',
  'Indian/Mauritius',
  'Europe/Astrakhan',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Indian/Reunion',
  'Europe/Samara',
  'Indian/Mahe',
  'Asia/Kabul',
  'Asia/Almaty',
  'Asia/Qostanay',
  'Indian/Kerguelen',
  'Indian/Maldives',
  'Antarctica/Mawson',
  'Asia/Karachi',
  'Asia/Dushanbe',
  'Asia/Ashgabat',
  'Asia/Samarkand',
  'Asia/Tashkent',
  'Antarctica/Vostok',
  'Asia/Aqtau',
  'Asia/Aqtobe',
  'Asia/Atyrau',
  'Asia/Oral',
  'Asia/Qyzylorda',
  'Asia/Yekaterinburg',
  'Asia/Colombo',
  'Asia/Calcutta',
  'Asia/Katmandu',
  'Asia/Dhaka',
  'Asia/Thimphu',
  'Asia/Urumqi',
  'Indian/Chagos',
  'Asia/Bishkek',
  'Asia/Omsk',
  'Indian/Cocos',
  'Asia/Rangoon',
  'Indian/Christmas',
  'Antarctica/Davis',
  'Asia/Hovd',
  'Asia/Bangkok',
  'Asia/Saigon',
  'Asia/Phnom_Penh',
  'Asia/Vientiane',
  'Asia/Krasnoyarsk',
  'Asia/Novokuznetsk',
  'Asia/Novosibirsk',
  'Asia/Barnaul',
  'Asia/Tomsk',
  'Asia/Jakarta',
  'Asia/Pontianak',
  'Asia/Brunei',
  'Antarctica/Casey',
  'Asia/Makassar',
  'Asia/Macau',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Irkutsk',
  'Asia/Kuala_Lumpur',
  'Asia/Kuching',
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Ulaanbaatar',
  'Asia/Choibalsan',
  'Australia/Perth',
  'Australia/Eucla',
  'Asia/Dili',
  'Asia/Jayapura',
  'Asia/Tokyo',
  'Asia/Pyongyang',
  'Asia/Seoul',
  'Pacific/Palau',
  'Asia/Yakutsk',
  'Asia/Chita',
  'Asia/Khandyga',
  'Australia/Darwin',
  'Pacific/Guam',
  'Pacific/Saipan',
  'Pacific/Truk',
  'Antarctica/DumontDUrville',
  'Australia/Brisbane',
  'Australia/Lindeman',
  'Pacific/Port_Moresby',
  'Asia/Vladivostok',
  'Asia/Ust-Nera',
  'Australia/Adelaide',
  'Australia/Broken_Hill',
  'Australia/Currie',
  'Australia/Hobart',
  'Antarctica/Macquarie',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Pacific/Kosrae',
  'Australia/Lord_Howe',
  'Asia/Magadan',
  'Asia/Srednekolymsk',
  'Pacific/Noumea',
  'Pacific/Bougainville',
  'Pacific/Ponape',
  'Asia/Sakhalin',
  'Pacific/Guadalcanal',
  'Pacific/Efate',
  'Asia/Anadyr',
  'Pacific/Fiji',
  'Pacific/Tarawa',
  'Pacific/Kwajalein',
  'Pacific/Majuro',
  'Pacific/Nauru',
  'Pacific/Norfolk',
  'Asia/Kamchatka',
  'Pacific/Funafuti',
  'Pacific/Wake',
  'Pacific/Wallis',
  'Pacific/Apia',
  'Pacific/Auckland',
  'Antarctica/McMurdo',
  'Pacific/Enderbury',
  'Pacific/Fakaofo',
  'Pacific/Tongatapu',
  'Pacific/Chatham',
  'Pacific/Kiritimati'
];


/**
 * Helper function to parse a project description and extract additional
 * metadata about breakout sessions: date, timezone, big meeting id
 *
 * Description needs to be a comma-separated list of parameters. Example:
 * "meeting: tpac2023, day: 2023-09-13, timezone: Europe/Madrid"
 */
export function parseProjectDescription(desc) {
  const metadata = {};
  if (desc) {
    desc.split(/,/)
      .map(param => param.trim())
      .map(param => param.split(/:/).map(val => val.trim()))
      .map(param => metadata[param[0]] = param[1]);
  }
  return metadata;
}


/**
 * Validate that we have the information we need about the project.
 */
export function validateProject(project) {
  const errors = [];

  if (!project.metadata) {
    errors.push('The short description is missing. It should set the meeting, date, and timezone.');
  }
  else {
    if (!project.metadata.meeting) {
      errors.push('The "meeting" info in the short description is missing. Should be something like "meeting: TPAC 2023"');
    }
    if (!project.metadata.timezone) {
      errors.push('The "timezone" info in the short description is missing. Should be something like "timezone: Europe/Madrid"');
    }
    else if (!timezones.includes(project.metadata.timezone)) {
      errors.push('The "timezone" info in the short description is not a valid timezone. Value should be a "tz identifier" in https://en.wikipedia.org/wiki/List_of_tz_database_time_zones');
    }
    if (!['groups', 'breakouts', undefined].includes(project.metadata?.type)) {
      errors.push('The "type" info must be one of "groups" or "breakouts"');
    }
    if (project.metadata.calendar &&
        !['no', 'draft', 'tentative', 'confirmed'].includes(project.metadata.calendar)) {
      errors.push('The "calendar" info must be one of "no", "draft", "tentative" or "confirmed"');
    }
  }

  for (const slot of project.slots) {
    if (!slot.name.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/)) {
      errors.push(`Invalid slot name "${slot.name}". Format should be "HH:mm - HH:mm"`);
    }
    if (slot.duration < 30 || slot.duration > 120) {
      errors.push(`Unexpected slot duration ${slot.duration}. Duration should be between 30 and 120 minutes.`);
    }
  }

  for (const day of project.days) {
    if (!day.date.match(/^\d{4}\-\d{2}\-\d{2}$/)) {
      errors.push(`Invalid day name "${day.name}". Format should be either "YYYY-MM-DD" or "[label] (YYYY-MM-DD)`);
    }
    else if (isNaN((new Date(day.date)).valueOf())) {
      errors.push(`Invalid date in day name "${day.name}".`);
    }
  }

  return errors;
}


/**
 * Convert the project to a simplified JSON data structure
 * (suitable for tests but also for debugging)
 */
export function convertProjectToJSON(project) {
  const toNameList = list => list.map(item => item.name);
  const data = {
    title: project.title,
    description: project.description
  };
  if (project.allowMultipleMeetings) {
    data.allowMultipleMeetings = true;
  }
  if (project.allowTryMeOut) {
    data.allowTryMeOut = true;
  }
  if (project.allowRegistrants) {
    data.allowRegistrants = true;
  }
  for (const list of ['days', 'rooms', 'slots', 'labels']) {
    data[list] = toNameList(project[list]);
  }

  data.sessions = project.sessions.map(session => {
    const simplified = {
      number: session.number,
      title: session.title,
      author: session.author.login,
      body: session.body,
    };
    if (session.labels.length !== 1 || session.labels[0] !== 'session') {
      simplified.labels = session.labels;
    }
    for (const field of ['day', 'room', 'slot', 'meeting', 'registrants']) {
      if (session[field]) {
        simplified[field] = session[field];
      }
    }
    return simplified;
  });
  return data;
}