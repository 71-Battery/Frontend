import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getNotices,
  getRegulations,
  getSavedResources,
  getSchedules,
  removeSavedResource,
  saveResource,
} from '../api/platformApi.js'
import { normalizeContentResources, makeResourceKey, RESOURCE_TYPES } from '../api/resourceMapper.js'
import { getDefaultScheduleRange, mapAndSortSchedules } from '../api/scheduleMapper.js'
import {
  demoNoticeRecords,
  demoRegulationRecords,
  demoSavedResources,
  demoScheduleRecords,
} from '../fixtures/demoAcademicData.js'

const loadingResource = () => ({ items: [], status: 'loading', error: '', meta: {} })

function demoState(user) {
  return {
    schedules: {
      items: mapAndSortSchedules(demoScheduleRecords, user.grade),
      status: 'ready',
      error: '',
      meta: { source: 'DEMO' },
    },
    notices: {
      items: normalizeContentResources(demoNoticeRecords, RESOURCE_TYPES.NOTICE, user),
      status: 'ready',
      error: '',
      meta: { source: 'DEMO' },
    },
    regulations: {
      items: normalizeContentResources(demoRegulationRecords, RESOURCE_TYPES.RULE, user),
      status: 'ready',
      error: '',
      meta: { source: 'DEMO' },
    },
    saved: {
      items: demoSavedResources,
      status: 'ready',
      error: '',
      meta: { source: 'DEMO' },
    },
  }
}

export function useAcademicData({ user, authToken }) {
  const isDemo = user.dataSource === 'demo'
  const [resources, setResources] = useState(() => (
    isDemo
      ? demoState(user)
      : {
        schedules: loadingResource(),
        notices: loadingResource(),
        regulations: loadingResource(),
        saved: loadingResource(),
      }
  ))
  const [reloadVersion, setReloadVersion] = useState(0)
  const [savedKeys, setSavedKeys] = useState(() => new Set(
    isDemo
      ? demoSavedResources.map((item) => makeResourceKey(item.resourceType, item.resourceId))
      : [],
  ))
  const [savingKeys, setSavingKeys] = useState(() => new Set())
  const [saveError, setSaveError] = useState('')

  const retry = useCallback(() => setReloadVersion((value) => value + 1), [])

  useEffect(() => {
    if (isDemo) {
      const next = demoState(user)
      setResources(next)
      setSavedKeys(new Set(next.saved.items.map((item) => makeResourceKey(item.resourceType, item.resourceId))))
      return undefined
    }

    const controller = new AbortController()
    const requestOptions = { authToken, signal: controller.signal }
    const { fromDate, toDate } = getDefaultScheduleRange()

    setResources((current) => ({
      schedules: { ...current.schedules, status: 'loading', error: '' },
      notices: { ...current.notices, status: 'loading', error: '' },
      regulations: { ...current.regulations, status: 'loading', error: '' },
      saved: { ...current.saved, status: 'loading', error: '' },
    }))

    const settle = (key, request) => {
      request.then((result) => {
        if (controller.signal.aborted) return
        setResources((current) => ({
          ...current,
          [key]: { items: result.items, status: 'ready', error: '', meta: result.meta },
        }))
        if (key === 'saved') {
          setSavedKeys(new Set(result.items.map((item) => makeResourceKey(item.resourceType, item.resourceId))))
        }
      }).catch((error) => {
        if (controller.signal.aborted || error.name === 'AbortError') return
        setResources((current) => ({
          ...current,
          [key]: {
            ...current[key],
            status: 'error',
            error: error.message || '정보를 불러오지 못했습니다.',
          },
        }))
      })
    }

    settle('schedules', getSchedules({
      fromDate,
      toDate,
      studentGrade: user.grade,
      ...requestOptions,
    }))
    settle('notices', getNotices({ profile: user, ...requestOptions }))
    settle('regulations', getRegulations({ profile: user, ...requestOptions }))
    settle('saved', getSavedResources(requestOptions))

    return () => controller.abort()
  }, [authToken, isDemo, reloadVersion, user])

  const toggleSaved = useCallback(async (resourceType, resourceId) => {
    const key = makeResourceKey(resourceType, resourceId)
    if (savingKeys.has(key)) return

    const wasSaved = savedKeys.has(key)
    setSaveError('')
    setSavingKeys((current) => new Set(current).add(key))
    setSavedKeys((current) => {
      const next = new Set(current)
      if (wasSaved) next.delete(key)
      else next.add(key)
      return next
    })

    if (isDemo) {
      setSavingKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
      return
    }

    try {
      if (wasSaved) {
        await removeSavedResource(resourceType, resourceId, { authToken })
        setResources((current) => ({
          ...current,
          saved: {
            ...current.saved,
            items: current.saved.items.filter((item) => (
              makeResourceKey(item.resourceType, item.resourceId) !== key
            )),
          },
        }))
      } else {
        const savedResource = await saveResource(resourceType, resourceId, { authToken })
        setResources((current) => ({
          ...current,
          saved: {
            ...current.saved,
            items: [
              ...current.saved.items.filter((item) => (
                makeResourceKey(item.resourceType, item.resourceId) !== key
              )),
              savedResource,
            ],
          },
        }))
      }
    } catch (error) {
      setSavedKeys((current) => {
        const next = new Set(current)
        if (wasSaved) next.add(key)
        else next.delete(key)
        return next
      })
      setSaveError(error.message || '저장 상태를 변경하지 못했습니다.')
    } finally {
      setSavingKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }, [authToken, isDemo, savedKeys, savingKeys])

  return useMemo(() => ({
    ...resources,
    savedKeys,
    savingKeys,
    saveError,
    retry,
    toggleSaved,
  }), [resources, retry, saveError, savedKeys, savingKeys, toggleSaved])
}
