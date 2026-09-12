import { linkTo } from "@storybook/addon-links"
import React from "react"

export default function Link({ to, children }: {
  to?: string
  children?: React.ReactNode
}) {

  return (
    <button
      onClick={to ? linkTo(to) : undefined}
      className="cursor-pointer text-sky-600 underline"
    >
      {children ?? to}
    </button>
  )
}