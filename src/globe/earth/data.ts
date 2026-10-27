/**
 * 地球渲染使用的静态国家数据与名称归一化。
 *
 * 这里不依赖 Three.js，方便单测；Earth 只负责把数据变成几何体。
 */

/** 需要做面填充的国家（边界线仍然绘制全部国家）。 */
export const COUNTRY_FILL_NAMES: ReadonlySet<string> = new Set([
    // 南美洲
    "Brazil", "Colombia", "Venezuela", "Peru", "Bolivia",
    // 北美洲
    "Mexico", "Greenland",
    // 亚洲
    "India", "Kazakhstan", "Saudi Arabia", "Iran", "Mongolia",
    "Myanmar", "Afghanistan", "Pakistan", "Thailand",
    "Turkmenistan", "Uzbekistan",
    // 非洲
    "Democratic Republic of the Congo", "Sudan", "Mozambique",
    "Mali", "Algeria", "Libya", "Niger", "Chad", "Ethiopia",
    "Guinea", "Morocco", "South Sudan", "Central African Republic",
    "Cameroon", "Zambia", "Nigeria", "Republic of Congo",
    "Madagascar", "United Republic of Tanzania", "Ivory Coast",
    // 欧洲
    "Ukraine", "Germany", "Spain", "Republic of Serbia",
    // 中美洲
    "Honduras", "Nicaragua", "Panama",
]);

/** 高亮/攻击回退使用的国家中心经纬度。 */
export const COUNTRY_COORDINATES: Readonly<Record<string, { lat: number; lng: number }>> = {
    // 亚洲
    'India': { lat: 20.5937, lng: 78.9629 },
    'Kazakhstan': { lat: 48.0196, lng: 66.9237 },
    'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
    'Iran': { lat: 32.4279, lng: 53.6880 },
    'Mongolia': { lat: 46.8625, lng: 103.8467 },
    'Myanmar': { lat: 21.9162, lng: 95.9560 },
    'Afghanistan': { lat: 33.9391, lng: 67.7100 },
    'Pakistan': { lat: 30.3753, lng: 69.3451 },
    'Thailand': { lat: 15.8700, lng: 100.9925 },
    'Turkmenistan': { lat: 38.9697, lng: 59.5563 },
    'Uzbekistan': { lat: 41.3775, lng: 64.5853 },
    // 欧洲
    'Ukraine': { lat: 48.3794, lng: 31.1656 },
    'Germany': { lat: 51.1657, lng: 10.4515 },
    'Spain': { lat: 40.4637, lng: -3.7492 },
    'Republic of Serbia': { lat: 44.0165, lng: 21.0059 },
    'Poland': { lat: 51.9194, lng: 19.1451 },
    // 南美洲
    'Brazil': { lat: -14.2350, lng: -51.9253 },
    'Colombia': { lat: 4.5709, lng: -74.2973 },
    'Venezuela': { lat: 6.4238, lng: -66.5897 },
    'Peru': { lat: -9.1900, lng: -75.0152 },
    'Bolivia': { lat: -16.2902, lng: -63.5887 },
    // 北美洲
    'Mexico': { lat: 23.6345, lng: -102.5528 },
    'Greenland': { lat: 71.7069, lng: -42.6043 },
    // 非洲
    'Democratic Republic of the Congo': { lat: -4.0383, lng: 21.7587 },
    'Sudan': { lat: 12.8628, lng: 30.2176 },
    'Algeria': { lat: 28.0339, lng: 1.6596 },
    'Libya': { lat: 26.3351, lng: 17.2283 },
    'Ethiopia': { lat: 9.1450, lng: 40.4897 },
    'Mali': { lat: 17.5707, lng: -3.9962 },
    'Niger': { lat: 17.6078, lng: 8.0817 },
    'Chad': { lat: 15.4542, lng: 18.7322 },
    'Nigeria': { lat: 9.0820, lng: 8.6753 },
    'Mozambique': { lat: -18.6657, lng: 35.5296 },
    // 中美洲
    'Honduras': { lat: 15.2000, lng: -86.2419 },
    'Nicaragua': { lat: 12.8654, lng: -85.2072 },
    'Panama': { lat: 8.5380, lng: -80.7821 },
};

/**
 * GeoJSON 里的短名/变体 → 代码使用的标准名。
 * 只收录确实出现在 globe.json 或 GZCTF 类别映射里的条目。
 */
const COUNTRY_NAME_ALIASES: Readonly<Record<string, string>> = {
    'Dem. Rep. Congo': 'Democratic Republic of the Congo',
    'Democratic Republic of the Congo': 'Democratic Republic of the Congo',
    'S. Sudan': 'South Sudan',
    'Tanzania': 'United Republic of Tanzania',
    'United Republic of Tanzania': 'United Republic of Tanzania',
    'Serbia': 'Republic of Serbia',
    'Republic of Serbia': 'Republic of Serbia',
    "Côte d'Ivoire": 'Ivory Coast',
    'Ivory Coast': 'Ivory Coast',
    'Central African Rep.': 'Central African Republic',
    'Central African Republic': 'Central African Republic',
    'Congo': 'Republic of Congo',
    'Republic of Congo': 'Republic of Congo',
    'United States of America': 'United States',
    'USA': 'United States',
    'Russian Federation': 'Russia',
    'South Korea': 'South Korea',
    'Republic of Korea': 'South Korea',
    'UK': 'United Kingdom',
    'Great Britain': 'United Kingdom',
    'Czechia': 'Czech Republic',
};

export function getCountryStandardName(countryName: string): string {
    return COUNTRY_NAME_ALIASES[countryName] ?? countryName;
}

export function isFillCountry(...names: Array<string | null | undefined>): boolean {
    return names.some((name) => name && COUNTRY_FILL_NAMES.has(getCountryStandardName(name)));
}

export function getCountryCoordinates(countryName: string): { lat: number; lng: number } | null {
    return COUNTRY_COORDINATES[getCountryStandardName(countryName)] ?? COUNTRY_COORDINATES[countryName] ?? null;
}
