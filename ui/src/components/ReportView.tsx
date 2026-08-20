import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { CheckboxLabel } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { getLog, getReport, winName, type Report } from '@/lib/api'
import { useActions } from '@/lib/actions'

export function ReportView({ refId, full, onClose, refresh }: {
  refId: string; full?: boolean; onClose?: () => void; refresh?: () => void
}) {
  const A = useActions()
  const [r, setR] = useState<Report | null>(null)
  const [view, setView] = useState<string | undefined>(undefined)
  const [log, setLog] = useState<string | null>(null)
  const [verdict, setVerdict] = useState('')
  const [fullReport, setFullReport] = useState(false)
  const [postOpt, setPostOpt] = useState(true)
  const [admin, setAdmin] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (v?: string) => {
    setLog(null)
    const rep = await getReport(refId, v)
    setR(rep)
    setView(rep.view)
    setPostOpt(rep.view === 'optimized')
  }, [refId])

  useEffect(() => { void load(view) }, [refId]) // eslint-disable-line react-hooks/exhaustive-deps

  // decorate finding tables: →Jira + discard/undiscard per row
  useEffect(() => {
    const el = bodyRef.current
    if (!el || !r?.html) return
    const norm = (t: string) => t.toLowerCase().replace(/[*`_|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
    const discarded = new Set((r.discards ?? []).filter(d => d.view === (r.view ?? 'original')).map(d => d.fkey))
    el.querySelectorAll('table').forEach(t => {
      const hdr = [...t.querySelectorAll('thead th')].map(x => x.textContent?.trim().toLowerCase() ?? '')
      const fi = hdr.indexOf('finding')
      if (fi < 0) return
      const fl = hdr.findIndex(h => h.startsWith('file'))
      t.querySelector('thead tr')?.appendChild(document.createElement('th'))
      t.querySelectorAll('tbody tr').forEach(tr => {
        const td = tr.querySelectorAll('td')
        if (td.length <= fi) return
        const num = (td[0]?.textContent ?? '').trim()
        const find = (td[fi]?.textContent ?? '').trim()
        const file = fl >= 0 ? (td[fl]?.textContent ?? '').trim() : ''
        const excerpt = norm(find)
        const fkey = `${num}:${excerpt}`
        const cell = document.createElement('td')
        cell.className = 'whitespace-nowrap'
        if (discarded.has(fkey)) {
          ;(tr as HTMLElement).style.display = 'none'
          const ghost = document.createElement('tr')
          const gtd = document.createElement('td')
          gtd.colSpan = td.length + 1
          gtd.className = 'py-1 px-2 text-xs text-muted-foreground italic'
          const rb = document.createElement('button')
          rb.textContent = 'undiscard'
          rb.className = 'ml-2 h-5 px-1.5 text-[11px] rounded border border-border bg-card hover:border-primary/60 cursor-pointer not-italic'
          rb.onclick = () => void A.run({ action: 'frestore', ref: refId, fkey, view: r.view }, () => void load(view))
          gtd.append(`finding #${num || '?'} discarded — excluded from the posted review`, rb)
          ghost.appendChild(gtd)
          tr.after(ghost)
          return
        }
        const jb = document.createElement('button')
        jb.textContent = '→ Jira'
        jb.className = 'h-6 px-2 text-xs rounded border border-border bg-card hover:border-primary/60 cursor-pointer whitespace-nowrap'
        jb.onclick = async ev => {
          ev.stopPropagation()
          const t0 = await A.promptDlg({
            title: 'Create a Jira work item',
            description: file ? `From this finding · ${file.slice(0, 80)}` : 'From this finding',
            defaultValue: `[${refId}] ${find.slice(0, 120).replace(/\s+/g, ' ')}`,
            submitText: 'Create ticket',
          })
          if (!t0) return
          void A.run({ action: 'ticket', ref: refId, title: t0, body: (file ? `File: ${file}\n\n` : '') + find }, () => void load(view))
        }
        const db = document.createElement('button')
        db.textContent = 'discard'
        db.title = 'hide this finding from the report and the posted review (undoable)'
        db.className = 'ml-1 h-6 px-2 text-xs rounded border border-border bg-card text-muted-foreground hover:border-destructive/60 hover:text-destructive cursor-pointer whitespace-nowrap'
        db.onclick = () => void A.run({ action: 'fdiscard', ref: refId, fkey, excerpt: find.slice(0, 300), view: r.view }, () => void load(view))
        cell.append(jb, db)
        tr.appendChild(cell)
      })
    })
  }, [r?.html, r?.discards]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return <Card className="text-xs text-muted-foreground">loading…</Card>

  const reload = () => void load(view)
  const canPost = r.status === 'staged'

  const header = (
    <Card>
      <div className="flex flex-wrap items-center gap-1.5">
        <b>{r.ref}</b>
        {r.url && <a className="text-primary hover:underline" href={r.url} target="_blank" rel="noreferrer">{r.title || 'open on GitHub'} ↗</a>}
        {r.author && <span className="text-muted-foreground">· {r.author}</span>}
      </div>
      {!r.error && (
        <div className="mt-0.5 text-xs text-muted-foreground">
          review {r.id} · {r.status} · verdict <b className="text-foreground">{r.verdict || 'unparsed'}</b> · reviewed {(r.head_sha ?? '').slice(0, 7)}
          {r.behind && <Badge variant="warn" className="ml-1">behind head {(r.pr_head ?? '').slice(0, 7)}</Badge>}
          {r.has_optimized && <> · viewing <b className="text-foreground">{r.view}</b></>}
          {' · '}{r.finished_at ?? ''}
        </div>
      )}
      {r.error && <div className="mt-0.5 text-xs text-muted-foreground">{r.error}</div>}
      {!!r.tickets?.length && (
        <div className="mt-1 text-xs">
          Jira:{' '}
          {r.tickets.map(t => (
            <span key={t.jira_key} className="mr-2">
              <a className="text-primary hover:underline" href={t.url || '#'} target="_blank" rel="noreferrer">{t.jira_key}</a>{' '}
              <span className="text-muted-foreground">{(t.title || '').slice(0, 60)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {r.error ? (
          <Button variant="default" size="sm" onClick={() => void A.queueReview(refId, refresh)}>queue review</Button>
        ) : (
          <>
            {canPost && (
              <>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">post as
                  <Select value={verdict} onChange={e => setVerdict(e.target.value)} className="h-6 text-xs">
                    <option value="">{r.verdict || 'unparsed → comment'}</option>
                    <option value="A">approve</option>
                    <option value="RC">request changes</option>
                    <option value="C">comment</option>
                  </Select>
                </label>
                <CheckboxLabel label="full report" checked={fullReport} onChange={e => setFullReport(e.target.checked)} />
                {r.has_optimized && <CheckboxLabel label="post optimized" checked={postOpt} onChange={e => setPostOpt(e.target.checked)} />}
                <Button variant="default" size="sm" onClick={async () => {
                  if (!await A.confirmDlg({ title: 'Post this review to GitHub?', body: 'It is published under your account.', confirmText: 'Post review' })) return
                  void A.run({ action: 'post', ref: refId, verdict: verdict || undefined, full: fullReport, optimized: r.has_optimized && postOpt }, reload)
                }}>Post to GitHub</Button>
                <Button variant="destructive" size="sm" onClick={async () => { if (await A.confirmDlg({ title: 'Discard this report?', destructive: true, confirmText: 'Discard' })) void A.run({ action: 'discard', ref: refId }, reload) }}>Discard</Button>
              </>
            )}
            {r.has_optimized
              ? <>
                  <Button size="sm" onClick={() => void load(r.view === 'optimized' ? 'original' : 'optimized')}>view {r.view === 'optimized' ? 'original' : 'optimized'}</Button>
                  <Button size="sm" onClick={() => void A.run({ action: 'optimize', ref: refId }, reload)}>Re-optimize</Button>
                </>
              : <Button size="sm" onClick={() => void A.run({ action: 'optimize', ref: refId }, reload)}>Optimize</Button>}
            <Button size="sm" onClick={() => void A.run({ action: 'review', ref: refId }, refresh)}>Re-review</Button>
          </>
        )}
        <Button size="sm" onClick={async () => setLog(await getLog(refId))}>Session log</Button>
        {!full && <a href={`/report?ref=${encodeURIComponent(refId)}`} target="_blank" rel="noreferrer"><Button size="sm">Full page ↗</Button></a>}
        <Button variant="destructive" size="sm" onClick={async () => { if (await A.confirmDlg({ title: `Merge ${refId} on GitHub${admin ? ' (admin)' : ''}?`, body: 'Merges with the configured method and deletes the head branch (protected branches kept).', confirmText: 'Merge', destructive: true })) void A.run({ action: 'merge', ref: refId, admin }, refresh ?? reload) }}>Merge PR</Button>
        <CheckboxLabel label="admin" checked={admin} onChange={e => setAdmin(e.target.checked)} />
        <Button size="sm" onClick={() => void A.takeOver(refId, refresh)}>Take over</Button>
        <Button size="sm" onClick={() => void A.workOn(refId, refresh)}>Work on it</Button>
        <a href={`/term?win=${winName('work', refId)}&ref=${encodeURIComponent(refId)}`} target="_blank" rel="noreferrer"><Button size="sm">web term</Button></a>
        {onClose && <Button size="sm" onClick={onClose}>Close</Button>}
        {full && <a href="/"><Button size="sm">back to cockpit</Button></a>}
      </div>
    </Card>
  )

  return (
    <div className="space-y-2">
      {header}
      {log !== null ? (
        <Card>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            session log (last 200 events)
            <Button size="sm" onClick={async () => setLog(await getLog(refId))}>refresh</Button>
            <Button size="sm" onClick={() => setLog(null)}>report</Button>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs">{log}</pre>
        </Card>
      ) : r.html ? (
        <Card><div ref={bodyRef} className="report-body" dangerouslySetInnerHTML={{ __html: r.html }} /></Card>
      ) : null}
    </div>
  )
}
