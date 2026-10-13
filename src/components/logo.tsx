/** The bfportal.gg logo. Pass `label` where it is not inside a named link. */
export function Logo(props: { class?: string; label?: string }) {
  return (
    <img
      src="/logo.svg"
      alt={props.label ?? ''}
      width="148"
      height="28"
      class={props.class}
    />
  )
}
