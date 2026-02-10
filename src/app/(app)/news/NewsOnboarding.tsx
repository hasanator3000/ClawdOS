'use client'

interface Props {
  onManualSetup: () => void
}

export function NewsOnboarding({ onManualSetup }: Props) {
  const handleAgentSetup = () => {
    // Open AI panel with pre-filled message
    window.dispatchEvent(
      new CustomEvent('lifeos:ai-prefill', {
        detail: { message: 'Help me set up news sources. I want to follow topics like ' },
      })
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Set up your news feed</h2>
        <p className="text-[var(--muted)] max-w-md">
          Add RSS sources to start reading personalized news. You can set up manually or let the
          assistant help you find relevant feeds.
        </p>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onManualSetup}
          className="px-5 py-2.5 border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--hover)] transition-colors"
        >
          Add sources manually
        </button>
        <button
          type="button"
          onClick={handleAgentSetup}
          className="px-5 py-2.5 bg-[var(--fg)] text-[var(--bg)] rounded-lg text-sm hover:opacity-80 transition-opacity"
        >
          Let assistant help
        </button>
      </div>
    </div>
  )
}
