"use client"

import { useEffect, useRef, useState } from "react"
import type { PublicSolveEvent } from "@/types/events"
import type { ScoreboardResponse, TeamInfo } from "@/types/scoreboard"
import { useTheme } from "@/contexts/theme-context"
import { getGameCategoryMappings, getCategoryTargetInfo } from "@/services/category-mapping-service"
import { useDeviceCapabilities } from "@/hooks/useDeviceCapabilities"

interface InteractiveArenaProps {
  events: PublicSolveEvent[]
  teams: TeamInfo[]
  challenges: ScoreboardResponse["challenges"]
  allTeams?: TeamInfo[]
}

const MAX_ATTACKS_PER_UPDATE = 4

export function InteractiveArena({ events, teams, challenges, allTeams }: InteractiveArenaProps) {
  const globeInitedRef = useRef<boolean>(false)
  const globeControllerRef = useRef<{
    dispose: () => void
    getSpaceshipManager: () => any
    getEarth: () => any
    getCamera: () => any
    getControls: () => any
    getCameraDirector: () => any
    getAutoShowcaseSystem: () => any
  } | null>(null)
  const { isDark } = useTheme()

  const [isInitialized, setIsInitialized] = useState(false)
  const deviceCapabilities = useDeviceCapabilities()
  const lastEventTimeRef = useRef<number | null>(null)

  // 处理游戏数据中的category映射
  useEffect(() => {
    if (isInitialized) {
      const mappings = getGameCategoryMappings(challenges)

      // 延迟高亮对应的国家，确保地球完全加载
      const timer = window.setTimeout(() => {
        if (globeControllerRef.current?.getEarth) {
          const earth = globeControllerRef.current.getEarth()
          if (earth && earth.highlightCountry) {
            console.log('Highlighting countries for categories:', Object.keys(mappings))
            
            // 清除之前的高亮和标签
            earth.clearAllHighlights()
            if (earth.clearAllLabels) {
              earth.clearAllLabels()
            }
            
            // 高亮新的国家并添加标签
            Object.entries(mappings).forEach(([category, mapping]) => {
              console.log(`Highlighting ${mapping.country} for category ${category}`)
              earth.highlightCountry(mapping.country, mapping.color, mapping.highlightIntensity)
              
              // 在国家上方添加Challenge类别名称标签
              if (earth.addCountryLabel) {
                earth.addCountryLabel(mapping.country, category, mapping.color)
              }
            })
          }
        }
      }, 2000) // 延迟2秒确保地球完全加载

      return () => window.clearTimeout(timer)
    }
  }, [challenges, isInitialized])

  // 处理事件和攻击动画 - 使用allTeams确保所有队伍都能参与攻击
  useEffect(() => {
    const teamsToSearch = allTeams && allTeams.length > 0 ? allTeams : teams
    if (events.length === 0 || teamsToSearch.length === 0 || !globeControllerRef.current) return

    const spaceshipManager = globeControllerRef.current.getSpaceshipManager()
    if (!spaceshipManager) return

    const newestEventTime = events.reduce((latest, event) => Math.max(latest, event.time), 0)

    // 第一次拿到快照时只记录游标，不回放整场历史（最多 500 条）攻击。
    if (lastEventTimeRef.current === null) {
      lastEventTimeRef.current = newestEventTime
      return
    }

    const newEvents = events
      .filter((event) => event.time > lastEventTimeRef.current!)
      .sort((a, b) => a.time - b.time)
      .slice(-MAX_ATTACKS_PER_UPDATE)

    lastEventTimeRef.current = newestEventTime
    for (const event of newEvents) {
      const team = teamsToSearch.find((candidate) => candidate.name === event.team)
      if (!team) continue

      const targetInfo = getCategoryTargetInfo(event.challengeCategory)
      spaceshipManager.createAttack(team.id, targetInfo.country?.name || 'China', {
        challengeCategory: event.challengeCategory,
        challengeTitle: event.challengeTitle,
        isSuccess: true,
      })
    }
  }, [events, allTeams, teams])
  // 初始化 Three.js 地球
  useEffect(() => {
    if (globeInitedRef.current) return
    let disposed = false
    ;(async () => {
      try {
        const sceneModule: any = await import("../src/scene")
        // 确保canvas存在后再初始化
        const canvas = document.getElementById("webgl") as HTMLCanvasElement | null
        if (disposed || !canvas) return
        const controller = sceneModule.initScene?.()
        if (disposed) {
          controller?.dispose?.()
          return
        }
        globeControllerRef.current = controller || null
        globeInitedRef.current = true
        setIsInitialized(true)
        
        // 获取运镜导演引用（场景内部已设置回调，此处仅确认）
      } catch (e) {
        console.error("Failed to init globe scene:", e)
      }
    })()

    return () => {
      if (disposed) return
      disposed = true
      try {
        globeControllerRef.current?.dispose?.()
      } catch (e) {
        // noop
      }
      globeInitedRef.current = false
      globeControllerRef.current = null
    }
  }, [])

  // 同步主题变化到3D场景
  useEffect(() => {
    if (!globeInitedRef.current) return

    // 通知scene.js主题变化
    const updateSceneTheme = () => {
      const event = new CustomEvent('themeChange', { 
        detail: { 
          isDark, 
          theme: isDark ? 'dark' : 'light',
          colors: {
            background: isDark ? '#0f1b2e' : '#1e3a8a',
            primary: isDark ? '#7dd3fc' : '#0284c7',
            secondary: isDark ? '#e879f9' : '#a855f7'
          }
        } 
      })
      window.dispatchEvent(event)
    }

    updateSceneTheme()
  }, [isDark])

  // 更新飞船 - 优化版本，始终使用allTeams确保所有队伍都能参与攻击
  useEffect(() => {
    if (!isInitialized || !globeControllerRef.current) return

    const spaceshipManager = globeControllerRef.current.getSpaceshipManager()
    if (!spaceshipManager) return

    // 始终使用allTeams，确保所有队伍都能参与攻击动画
    const teamsToUse = allTeams && allTeams.length > 0 ? allTeams : teams
    if (teamsToUse.length > 0) {
      // 限制最多20个飞船
      const maxShips = Math.min(20, deviceCapabilities.isMobile ? 15 : 20)
      const topTeams = teamsToUse.slice(0, maxShips)

      // 获取当前存在的飞船
      const currentShips = spaceshipManager.spaceships
      const currentTeamIds = new Set(currentShips.keys())
      const newTeamIds = new Set(topTeams.map(team => team.id))

      // 检查是否有变化，避免不必要的更新
      const hasChanges =
        currentTeamIds.size !== newTeamIds.size ||
        [...currentTeamIds].some((id) => !newTeamIds.has(id as number)) ||
        [...newTeamIds].some((id) => !currentTeamIds.has(id as number))

      if (!hasChanges) {
        // 检查排名是否有变化
        let rankChanged = false
        topTeams.forEach(team => {
          const spaceship = currentShips.get(team.id)
          if (spaceship && spaceship.rank !== team.rank) {
            rankChanged = true
          }
        })

        if (!rankChanged) {
          return // 没有变化，跳过更新
        }
      }

      // 使用SpaceshipManager的优化更新方法
      spaceshipManager.updateTeams(topTeams)
    }
  }, [allTeams, teams, isInitialized, deviceCapabilities.isMobile])

  // 用户交互时暂停自动展示 15 秒
  const handleUserInteraction = () => {
    const autoSystem = globeControllerRef.current?.getAutoShowcaseSystem?.()
    if (autoSystem?.suppressAuto) autoSystem.suppressAuto(15000)
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="w-full h-full cyber-panel relative overflow-hidden">
        <div className="cyber-panel-header text-center">赛场</div>
        <div className="relative w-full h-[calc(100%-40px)] flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-xl">暂无队伍数据</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full cyber-panel relative overflow-hidden">
      <div className="cyber-panel-header text-center">赛场</div>
      <div className="relative w-full h-[calc(100%-40px)] overflow-hidden">
        {/* WebGL 地球和飞船 - 优化响应式显示 */}
        <div 
          className="absolute inset-0"
          onMouseDown={handleUserInteraction}
          onTouchStart={handleUserInteraction}
          onWheel={handleUserInteraction}
        >
          <canvas 
            id="webgl" 
            className="w-full h-full object-cover"
            style={{
              minWidth: '100%',
              minHeight: '100%',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
        </div>
        {/* 提供给 scene.js 的加载容器，避免空指针 */}
        <div className="loader-container" style={{ display: "none" }} />

      </div>
    </div>
  )
}
