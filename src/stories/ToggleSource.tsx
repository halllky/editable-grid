import { Source, SourceProps } from "@storybook/addon-docs/blocks"

/**
 * 初期状態で折りたたまれている {@link Source}
 */
export default function ToggleSource({ summary, ...sourceProps }: SourceProps & {
  summary?: string
}) {
  return (
    <details>
      <summary className="my-2 text-sm text-sky-600 cursor-pointer select-none">
        {summary}
      </summary>
      <Source {...sourceProps} />
    </details>
  )
}