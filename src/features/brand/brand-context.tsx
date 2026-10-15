import { createContext, useContext, type ReactNode } from 'react'
import { canAdmin, canEdit, type BrandWithAccess } from '@/api/brands'

interface BrandContextValue {
  brand: BrandWithAccess
  canEdit: boolean
  canAdmin: boolean
  isMember: boolean
  editMode: boolean
  setEditMode: (value: boolean) => void | Promise<void>
  basePath: string
}

const BrandContext = createContext<BrandContextValue | null>(null)

export function BrandProvider({
  brand,
  editMode,
  setEditMode,
  children,
}: {
  brand: BrandWithAccess
  editMode: boolean
  setEditMode: (value: boolean) => void | Promise<void>
  children: ReactNode
}) {
  const editable = canEdit(brand.role)
  return (
    <BrandContext.Provider
      value={{
        brand,
        canEdit: editable,
        canAdmin: canAdmin(brand.role),
        isMember: brand.role !== null,
        editMode: editable && editMode,
        setEditMode,
        basePath: `/b/${brand.slug}`,
      }}
    >
      {children}
    </BrandContext.Provider>
  )
}

export function useBrandContext(): BrandContextValue {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrandContext außerhalb von <BrandProvider>')
  return ctx
}

/** Darf die aktuelle Person (oder Gäste über den Freigabelink) Dateien herunterladen? */
export function useCanDownload(asset?: { downloadable: boolean } | null): boolean {
  const { brand, isMember, canEdit } = useBrandContext()
  if (canEdit) return true
  if (!isMember && !brand.public_downloads) return false
  return asset ? asset.downloadable : true
}
