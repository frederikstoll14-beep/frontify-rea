import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { keys } from '@/api/client'
import { deleteBlock, insertBlock, saveBlockOrder, updateBlock, useBlocks, type Block } from '@/api/guidelines'
import { defaultContent, type BlockType, type BlockWidth } from '@/lib/blocks/types'
import { registerFlusher } from '@/lib/pending-saves'
import { errorMessage, moveItem } from '@/lib/utils'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY = 700

/** Lokaler, optimistischer Zustand der Blöcke einer Seite mit verzögertem Autosave. */
export function usePageBlocks(pageId: string | undefined, brandId: string) {
  const query = useBlocks(pageId)
  const qc = useQueryClient()
  const [blocks, setBlocks] = useState<Block[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pendingContent = useRef(new Map<string, unknown>())
  const inFlight = useRef(0)
  const pendingWork = useRef<Set<Promise<void>>>(new Set())
  const blocksRef = useRef<Block[]>([])

  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  useEffect(() => {
    if (query.data && timers.current.size === 0 && inFlight.current === 0) {
      setBlocks(query.data)
    }
  }, [query.data])

  const track = useCallback(async (work: () => Promise<void>) => {
    inFlight.current++
    setSaveState('saving')
    const promise = work()
    pendingWork.current.add(promise.catch(() => undefined))
    try {
      await promise
      inFlight.current--
      if (inFlight.current === 0) pendingWork.current.clear()
      if (inFlight.current === 0 && timers.current.size === 0) setSaveState('saved')
    } catch (error) {
      inFlight.current--
      setSaveState('error')
      toast.error(`Speichern fehlgeschlagen: ${errorMessage(error)}`)
    }
  }, [])

  const flushOne = useCallback(
    (id: string) => {
      const timer = timers.current.get(id)
      if (timer) clearTimeout(timer)
      timers.current.delete(id)
      if (!pendingContent.current.has(id)) return Promise.resolve()
      const content = pendingContent.current.get(id)
      pendingContent.current.delete(id)
      return track(() => updateBlock(id, { content }))
    },
    [track],
  )

  const flushAll = useCallback(async () => {
    await Promise.all([...timers.current.keys()].map((id) => flushOne(id)))
  }, [flushOne])

  const flushAndWait = useCallback(async () => {
    await flushAll()
    await Promise.all([...pendingWork.current])
  }, [flushAll])

  useEffect(() => registerFlusher(flushAndWait), [flushAndWait])

  // Beim Verlassen der Seite alles speichern
  useEffect(() => {
    const pending = pendingContent.current
    const timerMap = timers.current
    const onUnload = (e: BeforeUnloadEvent) => {
      if (timerMap.size > 0) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      for (const [id, timer] of timerMap) {
        clearTimeout(timer)
        if (pending.has(id)) void updateBlock(id, { content: pending.get(id) })
      }
      timerMap.clear()
      pending.clear()
      if (pageId) void qc.invalidateQueries({ queryKey: keys.blocks(pageId) })
    }
  }, [pageId, qc])

  const updateContent = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b
          const content = { ...(b.content as object), ...patch } as unknown as Block['content']
          pendingContent.current.set(id, content)
          return { ...b, content } as Block
        }),
      )
      const existing = timers.current.get(id)
      if (existing) clearTimeout(existing)
      setSaveState('saving')
      timers.current.set(
        id,
        setTimeout(() => void flushOne(id), SAVE_DELAY),
      )
    },
    [flushOne],
  )

  const setWidth = useCallback(
    (id: string, width: BlockWidth) => {
      setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, width } : b)))
      void track(() => updateBlock(id, { width }))
    },
    [track],
  )

  const persistOrder = useCallback(
    (next: Block[]) => {
      const withSort = next.map((b, i) => ({ ...b, sort: i }))
      setBlocks(withSort)
      const changed = withSort.filter((b, i) => blocksRef.current.find((x) => x.id === b.id)?.sort !== i)
      if (changed.length > 0) void track(() => saveBlockOrder(changed.map((b) => ({ id: b.id, sort: b.sort }))))
    },
    [track],
  )

  const insert = useCallback(
    async (type: BlockType, index: number, content?: unknown, width: BlockWidth = 'full'): Promise<Block | null> => {
      if (!pageId) return null
      try {
        setSaveState('saving')
        const block = await insertBlock({
          pageId,
          brandId,
          type,
          content: content ?? defaultContent(type),
          width,
          sort: index,
        })
        const next = [...blocksRef.current]
        next.splice(index, 0, block)
        persistOrder(next)
        setSaveState('saved')
        return block
      } catch (error) {
        setSaveState('error')
        toast.error(`Baustein konnte nicht angelegt werden: ${errorMessage(error)}`)
        return null
      }
    },
    [pageId, brandId, persistOrder],
  )

  const remove = useCallback(
    async (id: string) => {
      const index = blocksRef.current.findIndex((b) => b.id === id)
      const block = blocksRef.current[index]
      if (!block) return
      const timer = timers.current.get(id)
      if (timer) clearTimeout(timer)
      timers.current.delete(id)
      pendingContent.current.delete(id)
      setBlocks((prev) => prev.filter((b) => b.id !== id))
      await track(() => deleteBlock(id))
      toast('Baustein gelöscht', {
        action: { label: 'Rückgängig', onClick: () => void insert(block.type, index, block.content, block.width) },
      })
    },
    [track, insert],
  )

  const duplicate = useCallback(
    async (id: string) => {
      const index = blocksRef.current.findIndex((b) => b.id === id)
      const block = blocksRef.current[index]
      if (!block) return null
      return insert(block.type, index + 1, structuredClone(block.content), block.width)
    },
    [insert],
  )

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= blocksRef.current.length) return
      persistOrder(moveItem(blocksRef.current, from, to))
    },
    [persistOrder],
  )

  return {
    blocks,
    isLoading: query.isLoading,
    saveState,
    updateContent,
    setWidth,
    insert,
    remove,
    duplicate,
    move,
    reorder: persistOrder,
    flushAll,
  }
}
