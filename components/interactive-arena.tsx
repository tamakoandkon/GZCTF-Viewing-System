"use client"

import { useEffect, useRef, useState } from "react"
import { Rocket } from "lucide-react"
import gsap from "gsap"
import type { GameEvent } from "@/types/events"
import type { TeamInfo } from "@/types/scoreboard"
import type { GameDetails } from "@/types/challenge"
import { useTheme } from "@/contexts/theme-context"
import { getGameCategoryMappings, getCategoryTargetInfo } from "@/services/category-mapping-service"
import { useDeviceCapabilities } from "@/hooks/useDeviceCapabilities"

interface InteractiveArenaProps {
  events: GameEvent[]
  teams: TeamInfo[]
  gameDetails: GameDetails | null
  allTeams?: TeamInfo[]
}

export function InteractiveArena({ events, teams, gameDetails, allTeams }: InteractiveArenaProps) {
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
  const [categoryMappings, setCategoryMappings] = useState<Record<string, any>>({})
  const [lastEventTime, setLastEventTime] = useState<number>(0)

  // 处理游戏数据中的category映射
  useEffect(() => {
    if (gameDetails && isInitialized) {
      const mappings = getGameCategoryMappings(gameDetails)
      setCategoryMappings(mappings)
      
      // 延迟高亮对应的国家，确保地球完全加载
      setTimeout(() => {
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
    }
  }, [gameDetails, isInitialized])

  // 处理事件和攻击动画 - 使用allTeams确保所有队伍都能参与攻击
  useEffect(() => {
    if (events.length > 0 && (allTeams || teams).length > 0 && globeControllerRef.current) {
      const spaceshipManager = globeControllerRef.current.getSpaceshipManager()
      if (!spaceshipManager) return

      const flagEvents = events.filter((event) => event.type === "FlagSubmit" && event.team && event.values.length > 0)
      const sortedEvents = [...flagEvents].sort((a, b) => b.time - a.time)
      const newEvents = sortedEvents.filter((event) => event.time > lastEventTime)

      if (newEvents.length > 0) {
        // 使用allTeams进行攻击检测，确保所有队伍都能参与攻击
        const teamsToSearch = allTeams || teams
        
        newEvents.forEach((event) => {
          const teamName = event.team || ""
          const team = teamsToSearch.find((t) => t.name === teamName)

          if (team) {
            const isSuccess = event.values[0] === "Accepted"
            const challengeTitle = event.values.length > 2 ? event.values[2] : "Unknown challenge"

            let challengeCategory = "Misc"
            if (gameDetails) {
              for (const [category, challenges] of Object.entries(gameDetails.challenges)) {
                const challenge = challenges.find((c) => c.title === challengeTitle)
                if (challenge) {
                  challengeCategory = category
                  break
                }
              }
            }

            // 获取目标国家
            const targetInfo = getCategoryTargetInfo(challengeCategory as any)
            const targetCountry = targetInfo.country?.name || 'China' // 默认目标
            
            // 创建攻击动画
            spaceshipManager.createAttack(team.id, targetCountry, {
              challengeCategory,
              challengeTitle,
              isSuccess,
            })
          }
        })

        setLastEventTime(newEvents[0].time)
      }
    }
  }, [events, allTeams, teams, lastEventTime, gameDetails])

  // 初始化 Three.js 地球
  useEffect(() => {
    if (globeInitedRef.current) return
    let disposed = false
    ;(async () => {
      try {
        const sceneModule: any = await import("../src/scene")
        // 确保canvas存在后再初始化
        const canvas = document.getElementById("webgl") as HTMLCanvasElement | null
        if (!canvas) return
        const controller = sceneModule.initScene?.()
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
    const teamsToUse = allTeams || teams
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
  }, [allTeams, isInitialized, deviceCapabilities]) // 移除teams依赖，只使用allTeams

  // 用户交互时暂停自动展示 15 秒
  const handleUserInteraction = () => {
    const autoSystem = globeControllerRef.current?.getAutoShowcaseSystem?.()
    if (autoSystem?.suppressAuto) autoSystem.suppressAuto(15000)
  }

  // 测试事件监听（设置面板中的测试按钮触发）
  useEffect(() => {
    const onTestAttack = () => {
      console.log('test:attack received')
      const mgr = globeControllerRef.current?.getSpaceshipManager?.()
      console.log('mgr:', mgr, 'allTeams:', allTeams?.length, 'teams:', teams?.length)
      const teamsList = allTeams || teams
      if (!mgr || !teamsList?.length) {
        console.warn('Cannot fire test attack: no manager or teams')
        return
      }
      const top = teamsList.find((t: any) => t.rank === 1)
      if (!top) return
      const targets = ["India", "Brazil", "Germany", "Mexico", "Ukraine"]
      const target = targets[Math.floor(Math.random() * targets.length)]
      console.log(`Firing test attack from ${top.name} to ${target}`)
      mgr.createAttack(top.id, target, {
        challengeCategory: "Web",
        challengeTitle: "Test Attack",
        isSuccess: true,
      })
    }
    const onTestPromotion = () => {
      const mgr = globeControllerRef.current?.getSpaceshipManager?.()
      const teamsList = allTeams || teams
      if (!mgr || !teamsList?.length) return
      const rank1 = teamsList.find((t: any) => t.rank === 1)
      const rank2 = teamsList.find((t: any) => t.rank === 2)
      if (!rank1 || !rank2) return
      const others = teamsList.filter((t: any) => t.rank > 2)
      const swapped2 = { ...rank2, rank: 1 }
      const swapped1 = { ...rank1, rank: 2 }
      mgr.updateTeams([swapped2, swapped1, ...others])
      setTimeout(() => mgr.updateTeams(teamsList), 2000)
    }
    window.addEventListener("test:attack", onTestAttack)
    window.addEventListener("test:promotion", onTestPromotion)
    return () => {
      window.removeEventListener("test:attack", onTestAttack)
      window.removeEventListener("test:promotion", onTestPromotion)
    }
  }, [allTeams, teams])

  // 监听队伍聚焦事件 - 镜头平滑跟随该队伍飞船
  useEffect(() => {
    const onFocusTeam = (e: Event) => {
      const teamId = (e as CustomEvent).detail?.teamId
      if (!teamId || !globeControllerRef.current) return

      const spaceshipManager = globeControllerRef.current.getSpaceshipManager()
      const camera = globeControllerRef.current.getCamera()
      const controls = globeControllerRef.current.getControls()
      const autoSystem = globeControllerRef.current.getAutoShowcaseSystem?.()

      if (!spaceshipManager || !camera || !controls) return

      const spaceship = spaceshipManager.spaceships.get(teamId)
      if (!spaceship) return

      // 暂停自动展示 20 秒，避免运镜冲突
      autoSystem?.suppressAuto?.(20000)

      // 飞船当前位置（SpaceshipManager 在原点，position 即世界坐标）
      const tx = spaceship.position.x
      const ty = spaceship.position.y
      const tz = spaceship.position.z

      // 相机偏移：沿地心→飞船方向向外退 60 单位，并稍微抬高 20 单位
      const dist = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1
      const offsetDist = 60
      const cx = tx + (tx / dist) * offsetDist
      const cy = ty + (ty / dist) * offsetDist + 20
      const cz = tz + (tz / dist) * offsetDist

      // gsap 平滑过渡相机位置和注视目标
      gsap.timeline()
        .to(
          camera.position,
          { x: cx, y: cy, z: cz, duration: 1.8, ease: "power2.inOut" },
          0,
        )
        .to(
          controls.target,
          { x: tx, y: ty, z: tz, duration: 1.8, ease: "power2.inOut" },
          0,
        )
    }

    window.addEventListener("team:focus", onFocusTeam as EventListener)
    return () => window.removeEventListener("team:focus", onFocusTeam as EventListener)
  }, [])

  if (!teams || teams.length === 0) {
    return (
      <div className="w-full h-full cyber-panel relative overflow-hidden">
        <div className="cyber-panel-header text-center"><Rocket className="w-5 h-5 inline-block mr-2 text-cyan-400" />沉浸式3D战斗竞技场<Rocket className="w-5 h-5 inline-block ml-2 text-cyan-400" /></div>
        <div className="relative w-full h-[calc(100%-40px)] flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-xl">等待数据加载...</div>
            <div className="text-sm mt-2">
              当前分组队伍: {teams?.length || 0} | 总队伍数: {allTeams?.length || 0}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full cyber-panel relative overflow-hidden">
      <div className="cyber-panel-header text-center"><Rocket className="w-5 h-5 inline-block mr-2 text-cyan-400" />沉浸式3D战斗竞技场<Rocket className="w-5 h-5 inline-block ml-2 text-cyan-400" /></div>
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
