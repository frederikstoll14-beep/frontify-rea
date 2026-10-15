import { useSearchParams } from 'react-router'
import { Tabs } from '@/components/ui/misc'
import { DownloadKitView } from '@/features/blocks/brand-blocks'
import { defaultContent } from '@/lib/blocks/types'
import { ColorsManager } from './colors-manager'
import { TypographyManager } from './typography-manager'

export function BasicsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'farben'
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-[0.12em] text-brand-accent-text uppercase">
          Markenbasis
        </p>
        <h1 className="mt-1 font-brand-heading text-3xl font-bold text-ink sm:text-4xl">
          Farben & Typografie
        </h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Die zentrale Quelle für alle Gestaltungsgrundlagen. Änderungen erscheinen automatisch in allen
          Markenhandbüchern.
        </p>
      </header>
      <Tabs
        value={tab}
        onValueChange={(value) => setParams({ tab: value })}
        items={[
          { value: 'farben', label: 'Farben' },
          { value: 'typografie', label: 'Typografie' },
          { value: 'export', label: 'Export' },
        ]}
        className="mb-6"
      />
      {tab === 'farben' && <ColorsManager />}
      {tab === 'typografie' && <TypographyManager />}
      {tab === 'export' && (
        <div className="max-w-3xl">
          <DownloadKitView
            block={undefined as never}
            content={{
              ...defaultContent('download_kit'),
              title: 'Design Tokens exportieren',
              description:
                'Für Websites, Apps, Figma (Tokens Studio) oder Adobe-Programme. Die Dateien werden live aus der Markenbasis erzeugt.',
            }}
          />
        </div>
      )}
    </div>
  )
}
