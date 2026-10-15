import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Block } from '@/api/guidelines'
import type { BlockContentMap, BlockType } from '@/lib/blocks/types'

export interface BlockViewProps<T extends BlockType> {
  block: Block<T>
  content: BlockContentMap[T]
}

export interface BlockEditorProps<T extends BlockType> extends BlockViewProps<T> {
  onChange: (patch: Partial<BlockContentMap[T]>) => void
}

export interface BlockDefinition<T extends BlockType> {
  icon: LucideIcon
  View: ComponentType<BlockViewProps<T>>
  Editor: ComponentType<BlockEditorProps<T>>
}

export type BlockRegistry = { [K in BlockType]: BlockDefinition<K> }
