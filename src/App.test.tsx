import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import App from './App'

async function addTask(u: ReturnType<typeof userEvent.setup>, title: string, est = '30') {
  const form = screen.getByRole('form', { name: 'Add task' })
  await u.type(within(form).getByLabelText('Task title'), title)
  await u.selectOptions(within(form).getByLabelText('Estimate'), est)
  await u.click(within(form).getByRole('button', { name: 'Add task' }))
}

it('plans tasks around an event, shows overflow, and survives remount', async () => {
  const u = userEvent.setup()
  const { unmount } = render(<App />)
  expect(screen.getByRole('heading', { name: 'Tempo' })).toBeInTheDocument()
  await screen.findByRole('form', { name: 'Add event' })
  // 09:00–22:00 fully blocked after 09:00 => only 60 min free
  const ev = screen.getByRole('form', { name: 'Add event' })
  await u.clear(within(ev).getByLabelText('Event start'))
  await u.type(within(ev).getByLabelText('Event start'), '10:00')
  await u.clear(within(ev).getByLabelText('Event end'))
  await u.type(within(ev).getByLabelText('Event end'), '22:00')
  await u.click(within(ev).getByRole('button', { name: 'Add event' }))
  await addTask(u, 'Essay', '60')
  await addTask(u, 'Reading', '30')
  const tl = screen.getByRole('list', { name: 'Timeline' })
  expect(within(tl).getByText(/09:00–10:00 Essay/)).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Overflow' })).getByText(/Reading/)).toBeInTheDocument()
  await new Promise((r) => setTimeout(r, 50))
  unmount()
  render(<App />)
  expect(await screen.findByText(/09:00–10:00 Essay/)).toBeInTheDocument()
  expect(screen.getByText(/Reading · 30 min/)).toBeInTheDocument()
})

it('rejects an empty title and an event that ends before it starts', async () => {
  const u = userEvent.setup()
  render(<App />)
  await screen.findByRole('form', { name: 'Add event' })
  await u.click(screen.getByRole('button', { name: 'Add task' }))
  expect(screen.getByRole('alert')).toHaveTextContent('title')
  const ev = screen.getByRole('form', { name: 'Add event' })
  await u.clear(within(ev).getByLabelText('Event end'))
  await u.type(within(ev).getByLabelText('Event end'), '09:00')
  await u.click(within(ev).getByRole('button', { name: 'Add event' }))
  expect(screen.getByRole('alert')).toHaveTextContent('end after')
})
