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
  expect(screen.getByText(/Reading · general · 30 min/)).toBeInTheDocument()
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

it('rejects events outside the day window', async () => {
  const u = userEvent.setup()
  render(<App />)
  const ev = await screen.findByRole('form', { name: 'Add event' })
  await u.clear(within(ev).getByLabelText('Event start'))
  await u.type(within(ev).getByLabelText('Event start'), '06:00')
  await u.clear(within(ev).getByLabelText('Event end'))
  await u.type(within(ev).getByLabelText('Event end'), '08:00')
  await u.click(within(ev).getByRole('button', { name: 'Add event' }))
  expect(screen.getByRole('alert')).toHaveTextContent('within 09:00')
})

it('tells the user when IndexedDB cannot be loaded', async () => {
  const orig = indexedDB.open.bind(indexedDB)
  indexedDB.open = () => { throw new Error('blocked') }
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load')
  indexedDB.open = orig
})

it('imports today events from an .ics file and keeps data on a bad file', async () => {
  const u = userEvent.setup()
  render(<App />)
  await screen.findByRole('form', { name: 'Add event' })
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Lecture\r\nDTSTART:${ymd}T100000\r\nDTEND:${ymd}T110000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
  await u.upload(screen.getByLabelText('Import .ics'), new File([ics], 'cal.ics', { type: 'text/calendar' }))
  expect(await screen.findByText(/10:00–11:00 Lecture \(fixed\)/)).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Imported 1 event')
  await u.upload(screen.getByLabelText('Import .ics'), new File(['nonsense'], 'bad.ics'))
  expect(await screen.findByRole('alert')).toHaveTextContent('not an iCalendar')
  expect(screen.getByText(/Lecture/)).toBeInTheDocument()
})
