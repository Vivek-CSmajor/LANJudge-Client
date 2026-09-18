// One light + one dark Monaco theme so the editor always reads as part of
// this app's UI instead of a mismatched IDE island. Both are defined up
// front so switching the `theme` prop at runtime (light/dark toggle) never
// needs a remount. Shared by every place a code box shows up (Submit tab,
// Submission History's read-only viewer).
export function defineEditorThemes(monaco) {
  monaco.editor.defineTheme('cc-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: { 'editor.background': '#f3f5f9' },
  })
  monaco.editor.defineTheme('cc-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: { 'editor.background': '#1b1d24' },
  })
}
