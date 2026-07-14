import type { ChallengeCategory } from "@/types/scoreboard"
import type { GameDetails } from "@/types/challenge"

// 国家坐标数据（经纬度）
interface CountryCoordinates {
  name: string
  lat: number
  lng: number
  region: string
  importance: 'high' | 'medium' | 'low'
}

// Category到国家的映射配置（固定映射）
interface CategoryMapping {
  country: string
  color: string
  highlightIntensity: number
}

// 主要国家坐标数据（基于筛选出的45个Polygon大国）
const countries: CountryCoordinates[] = [
  // 亚洲大国（Polygon类型）
  { name: 'India', lat: 20.5937, lng: 78.9629, region: 'Asia', importance: 'high' }, // 136顶点
  { name: 'Kazakhstan', lat: 48.0196, lng: 66.9237, region: 'Asia', importance: 'high' }, // 112顶点
  { name: 'Saudi Arabia', lat: 23.8859, lng: 45.0792, region: 'Asia', importance: 'high' }, // 76顶点
  { name: 'Iran', lat: 32.4279, lng: 53.6880, region: 'Asia', importance: 'high' }, // 75顶点
  { name: 'Mongolia', lat: 46.8625, lng: 103.8467, region: 'Asia', importance: 'high' }, // 75顶点
  { name: 'Myanmar', lat: 21.9162, lng: 95.9560, region: 'Asia', importance: 'medium' }, // 70顶点
  { name: 'Afghanistan', lat: 33.9391, lng: 67.7100, region: 'Asia', importance: 'medium' }, // 69顶点
  { name: 'Pakistan', lat: 30.3753, lng: 69.3451, region: 'Asia', importance: 'medium' }, // 66顶点
  { name: 'Thailand', lat: 15.8700, lng: 100.9925, region: 'Asia', importance: 'medium' }, // 64顶点
  { name: 'Turkmenistan', lat: 38.9697, lng: 59.5563, region: 'Asia', importance: 'medium' }, // 54顶点
  { name: 'Uzbekistan', lat: 41.3775, lng: 64.5853, region: 'Asia', importance: 'medium' }, // 54顶点
  
  // 欧洲大国（Polygon类型）
  { name: 'Ukraine', lat: 48.3794, lng: 31.1656, region: 'Europe', importance: 'high' }, // 98顶点
  { name: 'Germany', lat: 51.1657, lng: 10.4515, region: 'Europe', importance: 'high' }, // 58顶点
  { name: 'Spain', lat: 40.4637, lng: -3.7492, region: 'Europe', importance: 'medium' }, // 51顶点
  { name: 'Republic of Serbia', lat: 44.0165, lng: 21.0059, region: 'Europe', importance: 'medium' }, // 46顶点
  { name: 'Poland', lat: 51.9194, lng: 19.1451, region: 'Europe', importance: 'medium' },
  
  // 南美洲大国（Polygon类型）
  { name: 'Brazil', lat: -14.2350, lng: -51.9253, region: 'South America', importance: 'high' }, // 203顶点
  { name: 'Colombia', lat: 4.5709, lng: -74.2973, region: 'South America', importance: 'high' }, // 100顶点
  { name: 'Venezuela', lat: 6.4238, lng: -66.5897, region: 'South America', importance: 'medium' }, // 92顶点
  { name: 'Peru', lat: -9.1900, lng: -75.0152, region: 'South America', importance: 'medium' }, // 76顶点
  { name: 'Bolivia', lat: -16.2902, lng: -63.5887, region: 'South America', importance: 'medium' }, // 60顶点
  
  // 北美洲大国（Polygon类型）
  { name: 'Mexico', lat: 23.6345, lng: -102.5528, region: 'North America', importance: 'high' }, // 170顶点
  { name: 'Greenland', lat: 71.7069, lng: -42.6043, region: 'North America', importance: 'medium' }, // 132顶点
  
  // 非洲大国（Polygon类型）
  { name: 'Democratic Republic of the Congo', lat: -4.0383, lng: 21.7587, region: 'Africa', importance: 'high' }, // 122顶点
  { name: 'Sudan', lat: 12.8628, lng: 30.2176, region: 'Africa', importance: 'high' }, // 79顶点
  { name: 'Algeria', lat: 28.0339, lng: 1.6596, region: 'Africa', importance: 'high' }, // 62顶点
  { name: 'Libya', lat: 26.3351, lng: 17.2283, region: 'Africa', importance: 'high' }, // 56顶点
  { name: 'Ethiopia', lat: 9.1450, lng: 40.4897, region: 'Africa', importance: 'high' }, // 59顶点
  { name: 'Mali', lat: 17.5707, lng: -3.9962, region: 'Africa', importance: 'medium' }, // 76顶点
  { name: 'Niger', lat: 17.6078, lng: 8.0817, region: 'Africa', importance: 'medium' }, // 58顶点
  { name: 'Chad', lat: 15.4542, lng: 18.7322, region: 'Africa', importance: 'medium' }, // 58顶点
  { name: 'Nigeria', lat: 9.0820, lng: 8.6753, region: 'Africa', importance: 'medium' }, // 58顶点
  { name: 'Mozambique', lat: -18.6657, lng: 35.5296, region: 'Africa', importance: 'medium' }, // 77顶点
  
  // 中美洲大国（Polygon类型）
  { name: 'Honduras', lat: 15.2000, lng: -86.2419, region: 'North America', importance: 'medium' }, // 57顶点
  { name: 'Nicaragua', lat: 12.8654, lng: -85.2072, region: 'North America', importance: 'medium' }, // 52顶点
  { name: 'Panama', lat: 8.5380, lng: -80.7821, region: 'North America', importance: 'medium' }, // 52顶点
]

// Category到国家的固定映射配置（使用筛选后的45个Polygon大国）
const categoryCountryMapping: Record<ChallengeCategory, CategoryMapping> = {
  'Web': { country: 'India', color: '#ff6b6b', highlightIntensity: 0.8 }, // India (136顶点)
  'Crypto': { country: 'Germany', color: '#4ecdc4', highlightIntensity: 0.7 }, // Germany (58顶点)
  'Pwn': { country: 'Kazakhstan', color: '#45b7d1', highlightIntensity: 0.9 }, // Kazakhstan (112顶点)
  'Reverse': { country: 'Ukraine', color: '#96ceb4', highlightIntensity: 0.8 }, // Ukraine (98顶点)
  'Blockchain': { country: 'Thailand', color: '#feca57', highlightIntensity: 0.7 }, // Thailand (64顶点)
  'Forensics': { country: 'Brazil', color: '#ff9ff3', highlightIntensity: 0.8 }, // Brazil (203顶点)
  'Hardware': { country: 'Iran', color: '#54a0ff', highlightIntensity: 0.9 }, // Iran (75顶点)
  'Mobile': { country: 'Saudi Arabia', color: '#5f27cd', highlightIntensity: 0.8 }, // Saudi Arabia (76顶点)
  'PPC': { country: 'Spain', color: '#00d2d3', highlightIntensity: 0.7 }, // Spain (51顶点)
  'AI': { country: 'Mexico', color: '#ff6348', highlightIntensity: 0.8 }, // Mexico (170顶点)
  'Pentest': { country: 'Algeria', color: '#2ed573', highlightIntensity: 0.7 }, // Algeria (62顶点)
  'OSINT': { country: 'Ethiopia', color: '#ffa502', highlightIntensity: 0.8 }, // Ethiopia (59顶点)
  'Misc': { country: 'Mongolia', color: '#ff7675', highlightIntensity: 0.6 }, // Mongolia (75顶点)
}

// 从游戏数据中获取实际存在的category（兼容旧接口，回退到内建映射）
export function getActiveCategoriesFromGame(gameDetails?: GameDetails): ChallengeCategory[] {
  if (gameDetails?.challenges) {
    return Object.keys(gameDetails.challenges) as ChallengeCategory[]
  }
  return Object.keys(categoryCountryMapping) as ChallengeCategory[]
}

// 获取游戏中的category到国家的映射
export function getGameCategoryMappings(gameDetails?: GameDetails): Record<ChallengeCategory, CategoryMapping> {
  const activeCategories = getActiveCategoriesFromGame(gameDetails)
  const mappings: Record<ChallengeCategory, CategoryMapping> = {} as any

  activeCategories.forEach(category => {
    if (categoryCountryMapping[category]) {
      mappings[category] = categoryCountryMapping[category]
    }
  })

  return mappings
}

// 获取category对应的固定国家
export function getCountryForCategory(category: ChallengeCategory): CountryCoordinates | null {
  const mapping = categoryCountryMapping[category]
  if (!mapping) return null
  
  const country = countries.find(c => c.name === mapping.country)
  return country || null
}

// 获取category对应的国家坐标和颜色信息
export function getCategoryTargetInfo(category: ChallengeCategory): {
  country: CountryCoordinates | null
  color: string
  highlightIntensity: number
} {
  const mapping = categoryCountryMapping[category]
  if (!mapping) {
    return {
      country: null,
      color: '#ffffff',
      highlightIntensity: 0.5
    }
  }
  
  const country = countries.find(c => c.name === mapping.country)
  return {
    country: country || null,
    color: mapping.color,
    highlightIntensity: mapping.highlightIntensity
  }
}

// 获取所有category的国家映射（保留兼容性）
export function getAllCategoryCountries(): Record<ChallengeCategory, CountryCoordinates[]> {
  const result: Record<ChallengeCategory, CountryCoordinates[]> = {} as any
  
  Object.keys(categoryCountryMapping).forEach(category => {
    const mapping = categoryCountryMapping[category as ChallengeCategory]
    const country = countries.find(c => c.name === mapping.country)
    if (country) {
      result[category as ChallengeCategory] = [country]
    }
  })
  
  return result
}

// 根据挑战信息获取目标国家（更新版本）
export function getTargetCountryForChallenge(
  challengeTitle: string, 
  category: ChallengeCategory
): CountryCoordinates | null {
  return getCountryForCategory(category)
}

// 获取国家坐标（用于3D地球）
export function getCountry3DCoordinates(country: CountryCoordinates, earthRadius: number = 100) {
  const lat = country.lat * Math.PI / 180
  const lng = country.lng * Math.PI / 180
  
  const x = earthRadius * Math.cos(lat) * Math.sin(lng)
  const y = earthRadius * Math.sin(lat)
  const z = earthRadius * Math.cos(lat) * Math.cos(lng)
  
  return { x, y, z, lat, lng }
}
