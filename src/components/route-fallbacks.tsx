export function NotFound() {
  return (
    <main class="p-8">
      <h1 class="text-4xl font-bold">Page not found</h1>
      <p class="mt-4 text-lg">
        <a href="/" class="underline">
          Back to the home page
        </a>
      </p>
    </main>
  )
}

export function RouteError() {
  return (
    <main class="p-8">
      <h1 class="text-4xl font-bold">Something went wrong</h1>
      <p class="mt-4 text-lg">Try again in a moment.</p>
    </main>
  )
}
