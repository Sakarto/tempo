import { renderToString } from 'react-dom/server'
import { expect, test } from 'vitest'
import App from './App'

test('app renders the Tempo heading', () => {
  expect(renderToString(<App />)).toContain('Tempo')
})
