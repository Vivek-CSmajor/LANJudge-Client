// Keys must match the backend's judge.LanguageSpecs keys exactly — this is
// what gets sent as SubmitRequest.Language and looked up server-side.
export const LANGUAGES = {
  cpp: {
    label: 'C++',
    monacoLanguage: 'cpp',
  },
  python: {
    label: 'Python',
    monacoLanguage: 'python',
  },
  java: {
    label: 'Java',
    monacoLanguage: 'java',
  },
}
