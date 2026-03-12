// server/src/config/countryMappings.js

/**
 * Moving functionality from chartAggregationService.js for simplicity
 * 
 * Comprehensive ISO2 -> country name map.
 * 
 * Last.fm geo endpoints expect country names, not ISO2 codes.
 * Spotify/KWORB logic managed off ISO2 codes in page URLs
 *
 * Spotify's official source of truth for current markets is the Web API /markets endpoint.
 * Last.fm does not publish one canonical static country-code list the same way Spotify does.
 */

export const ISO2_TO_COUNTRY_NAME = {
    AD: 'Andorra',
    AE: 'United Arab Emirates',
    AF: 'Afghanistan',
    AG: 'Antigua and Barbuda',
    AL: 'Albania',
    AM: 'Armenia',
    AO: 'Angola',
    AR: 'Argentina',
    AT: 'Austria',
    AU: 'Australia',
    AZ: 'Azerbaijan',
    BA: 'Bosnia and Herzegovina',
    BB: 'Barbados',
    BD: 'Bangladesh',
    BE: 'Belgium',
    BF: 'Burkina Faso',
    BG: 'Bulgaria',
    BH: 'Bahrain',
    BI: 'Burundi',
    BJ: 'Benin',
    BN: 'Brunei',
    BO: 'Bolivia',
    BR: 'Brazil',
    BS: 'Bahamas',
    BT: 'Bhutan',
    BW: 'Botswana',
    BY: 'Belarus',
    BZ: 'Belize',
    CA: 'Canada',
    CD: 'Democratic Republic of the Congo',
    CF: 'Central African Republic',
    CG: 'Republic of the Congo',
    CH: 'Switzerland',
    CI: "Côte d'Ivoire",
    CL: 'Chile',
    CM: 'Cameroon',
    CN: 'China',
    CO: 'Colombia',
    CR: 'Costa Rica',
    CU: 'Cuba',
    CV: 'Cabo Verde',
    CY: 'Cyprus',
    CZ: 'Czechia',
    DE: 'Germany',
    DJ: 'Djibouti',
    DK: 'Denmark',
    DM: 'Dominica',
    DO: 'Dominican Republic',
    DZ: 'Algeria',
    EC: 'Ecuador',
    EE: 'Estonia',
    EG: 'Egypt',
    ER: 'Eritrea',
    ES: 'Spain',
    ET: 'Ethiopia',
    FI: 'Finland',
    FJ: 'Fiji',
    FM: 'Micronesia',
    FR: 'France',
    GA: 'Gabon',
    GB: 'United Kingdom',
    GD: 'Grenada',
    GE: 'Georgia',
    GH: 'Ghana',
    GM: 'Gambia',
    GN: 'Guinea',
    GQ: 'Equatorial Guinea',
    GR: 'Greece',
    GT: 'Guatemala',
    GW: 'Guinea-Bissau',
    GY: 'Guyana',
    HK: 'Hong Kong',
    HN: 'Honduras',
    HR: 'Croatia',
    HT: 'Haiti',
    HU: 'Hungary',
    ID: 'Indonesia',
    IE: 'Ireland',
    IL: 'Israel',
    IN: 'India',
    IQ: 'Iraq',
    IR: 'Iran',
    IS: 'Iceland',
    IT: 'Italy',
    JM: 'Jamaica',
    JO: 'Jordan',
    JP: 'Japan',
    KE: 'Kenya',
    KG: 'Kyrgyzstan',
    KH: 'Cambodia',
    KI: 'Kiribati',
    KM: 'Comoros',
    KN: 'Saint Kitts and Nevis',
    KP: 'North Korea',
    KR: 'South Korea',
    KW: 'Kuwait',
    KZ: 'Kazakhstan',
    LA: 'Laos',
    LB: 'Lebanon',
    LC: 'Saint Lucia',
    LI: 'Liechtenstein',
    LK: 'Sri Lanka',
    LR: 'Liberia',
    LS: 'Lesotho',
    LT: 'Lithuania',
    LU: 'Luxembourg',
    LV: 'Latvia',
    LY: 'Libya',
    MA: 'Morocco',
    MC: 'Monaco',
    MD: 'Moldova',
    ME: 'Montenegro',
    MG: 'Madagascar',
    MH: 'Marshall Islands',
    MK: 'North Macedonia',
    ML: 'Mali',
    MM: 'Myanmar',
    MN: 'Mongolia',
    MR: 'Mauritania',
    MT: 'Malta',
    MU: 'Mauritius',
    MV: 'Maldives',
    MW: 'Malawi',
    MX: 'Mexico',
    MY: 'Malaysia',
    MZ: 'Mozambique',
    NA: 'Namibia',
    NE: 'Niger',
    NG: 'Nigeria',
    NI: 'Nicaragua',
    NL: 'Netherlands',
    NO: 'Norway',
    NP: 'Nepal',
    NR: 'Nauru',
    NZ: 'New Zealand',
    OM: 'Oman',
    PA: 'Panama',
    PE: 'Peru',
    PG: 'Papua New Guinea',
    PH: 'Philippines',
    PK: 'Pakistan',
    PL: 'Poland',
    PS: 'Palestine',
    PT: 'Portugal',
    PW: 'Palau',
    PY: 'Paraguay',
    QA: 'Qatar',
    RO: 'Romania',
    RS: 'Serbia',
    RU: 'Russia',
    RW: 'Rwanda',
    SA: 'Saudi Arabia',
    SB: 'Solomon Islands',
    SC: 'Seychelles',
    SD: 'Sudan',
    SE: 'Sweden',
    SG: 'Singapore',
    SI: 'Slovenia',
    SK: 'Slovakia',
    SL: 'Sierra Leone',
    SM: 'San Marino',
    SN: 'Senegal',
    SO: 'Somalia',
    SR: 'Suriname',
    SS: 'South Sudan',
    ST: 'Sao Tome and Principe',
    SV: 'El Salvador',
    SY: 'Syria',
    SZ: 'Eswatini',
    TD: 'Chad',
    TG: 'Togo',
    TH: 'Thailand',
    TJ: 'Tajikistan',
    TL: 'Timor-Leste',
    TM: 'Turkmenistan',
    TN: 'Tunisia',
    TO: 'Tonga',
    TR: 'Turkey',
    TT: 'Trinidad and Tobago',
    TV: 'Tuvalu',
    TW: 'Taiwan',
    TZ: 'Tanzania',
    UA: 'Ukraine',
    UG: 'Uganda',
    US: 'United States',
    UY: 'Uruguay',
    UZ: 'Uzbekistan',
    VA: 'Vatican City',
    VC: 'Saint Vincent and the Grenadines',
    VE: 'Venezuela',
    VN: 'Vietnam',
    VU: 'Vanuatu',
    WS: 'Samoa',
    XK: 'Kosovo',
    YE: 'Yemen',
    ZA: 'South Africa',
    ZM: 'Zambia',
    ZW: 'Zimbabwe'
}

/**
 * Full ISO2 list for robust provider support iteration.
 */
export const ALL_ISO2_COUNTRIES = Object.keys(ISO2_TO_COUNTRY_NAME)

/**
 * Last.fm geo endpoints use country names.
 */
export const LASTFM_COUNTRY_NAME_BY_ISO2 = {
    ...ISO2_TO_COUNTRY_NAME
}

/**
 * KWORB country chart pages use lowercased country codes in the URL, e.g.
 *   us_daily.html
 *   gb_weekly.html
 *
 * Mapping derived from the Spotify market list
 * Runtime 404 handling to remain in place because page availability can vary.
 * 
 * Below countries successfully return KWORB daily chart pages
 */
export const KWORB_SUPPORTED_ISO2 = [
    'AE','AR','AT','AU','BE','BG','BO','BR','BY','CA','CH','CL','CO','CR','CZ',
    'DE','DK','DO','EC','EE','EG','ES','FI','FR','GB','GR','GT','HK','HN','HU',
    'ID','IE','IL','IN','IS','IT','JP','KR','KZ','LT','LU','LV','MA','MT','MX',
    'MY','NG','NI','NL','NO','NZ','PA','PE','PH','PK','PL','PT','PY','RO','RU',
    'SA','SE','SG','SK','SV','TH','TR','TW','UA','US','UY','VE','VN','ZA'
]

export const KWORB_COUNTRY_CODE_BY_ISO2 = Object.fromEntries(
    KWORB_SUPPORTED_ISO2.map((iso2) => [iso2, iso2.toLowerCase()])
)

/**
 * Provider support object: cleanest structure for bulk iteration and provider-specific lookups.
 */
export const COUNTRY_PROVIDER_SUPPORT = Object.fromEntries(
    ALL_ISO2_COUNTRIES.map((iso2) => [
        iso2,
        {
            name: ISO2_TO_COUNTRY_NAME[iso2],
            lastfm: LASTFM_COUNTRY_NAME_BY_ISO2[iso2] ?? null,
            kworb: KWORB_COUNTRY_CODE_BY_ISO2[iso2] ?? null
        }
    ])
)

/**
 * Helpers
 */
export function toLastfmCountryName(iso2) {
    const key = String(iso2 ?? '').toUpperCase()
    return COUNTRY_PROVIDER_SUPPORT[key]?.lastfm ?? null
}

export function toKworbCountryCode(iso2) {
    const key = String(iso2 ?? '').toUpperCase()
    return COUNTRY_PROVIDER_SUPPORT[key]?.kworb ?? null
}

export function isLastfmCountry(iso2) {
    const key = String(iso2 ?? '').toUpperCase()
    return Boolean(COUNTRY_PROVIDER_SUPPORT[key]?.lastfm)
}

export function isKworbCountry(iso2) {
    const key = String(iso2 ?? '').toUpperCase()
    return Boolean(COUNTRY_PROVIDER_SUPPORT[key]?.kworb)
}

export function getAllSupportedCountries() {
    return [...ALL_ISO2_COUNTRIES]
}

export function getLastfmSupportedCountries() {
    return ALL_ISO2_COUNTRIES.filter((iso2) => Boolean(COUNTRY_PROVIDER_SUPPORT[iso2]?.lastfm))
}

export function getKworbSupportedCountries() {
    return [...KWORB_SUPPORTED_ISO2]
}