type ClsxInput = string | Record<string, boolean | string> | Array<string | Record<string, boolean | string>> | undefined | null | false;

export function clsx(...classes: ClsxInput[]): string {
  const classNames = new Set<string>()

  function processClasses(input: ClsxInput): void {
    if (!input) return;
    if (typeof input === "string") {
      classNames.add(input)
    } else if (typeof input === "object" && !Array.isArray(input)) {
      Object.entries(input).forEach(([key, value]) => {
        if (value) {
          classNames.add(key)
        }
      })
    } else if (Array.isArray(input)) {
      input.forEach(processClasses)
    }
  }

  classes.forEach(processClasses)

  return Array.from(classNames).join(" ")
}