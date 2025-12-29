import { useEffect, useMemo, useState } from 'react'
import './App.css'

type ProblemEntry = {
  id: string
  name: string
  path: string
  url: string
  contest?: string
  year?: string
  level?: string
  segments: string[]
}

type RepoInfo = {
  default_branch?: string
  pushed_at?: string
}

const OWNER = 'winterant'
const REPO = 'oi'
const API_ROOT = 'https://api.github.com'
const FALLBACK_BRANCH = 'main'

function getExtension(path: string) {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

const SAMPLE_ENTRIES: ProblemEntry[] = [
  {
    id: 'sample-readme',
    name: '仓库 README',
    path: 'README.md',
    url: `https://github.com/${OWNER}/${REPO}`,
    contest: '仓库首页',
    segments: [],
  },
  {
    id: 'sample-noi-2024',
    name: '示例 NOI 2024 试题',
    path: 'NOI/2024',
    url: `https://github.com/${OWNER}/${REPO}/tree/${FALLBACK_BRANCH}/NOI/2024`,
    contest: 'NOI',
    year: '2024',
    level: '总览',
    segments: ['NOI', '2024'],
  },
]

function buildOptions(values: Array<string | undefined>, sortNumber = false) {
  const unique = Array.from(new Set(values.filter(Boolean) as string[]))
  if (sortNumber) {
    const safeParse = (value: string) => {
      const parsed = parseInt(value, 10)
      return Number.isFinite(parsed) ? parsed : -Infinity
    }
    return unique.sort((a, b) => safeParse(b) - safeParse(a))
  }
  return unique.sort((a, b) => a.localeCompare(b))
}

function buildGithubUrl(path: string, branch: string) {
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  if (getExtension(path) === 'pdf') {
    return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${branch}/${encodedPath}`
  }
  return `https://github.com/${OWNER}/${REPO}/blob/${branch}/${encodedPath}`
}

function isPreviewable(path: string) {
  const ext = getExtension(path)
  return ext ? ['pdf', 'txt', 'html', 'htm'].includes(ext) : false
}

function mapPathToEntry(path: string, branch: string): ProblemEntry | null {
  const segments = path.split('/')
  const fileName = segments.at(-1)
  if (!fileName) return null

  const infoSegments = segments.slice(0, -1)
  const yearIndex = infoSegments.findIndex((segment) => /^\d{4}$/.test(segment))
  let year = yearIndex >= 0 ? infoSegments[yearIndex] : undefined
  if (!year) {
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
    if (/^\d{4}$/.test(nameWithoutExt)) {
      year = nameWithoutExt
    }
  }

  const contestCandidate =
    yearIndex > 0
      ? infoSegments[0]
      : infoSegments[0] === year
        ? infoSegments[1]
        : infoSegments[0]
  const contest =
    contestCandidate && contestCandidate !== fileName ? contestCandidate : undefined
  let level =
    yearIndex >= 0 && infoSegments[yearIndex + 1] ? infoSegments[yearIndex + 1] : undefined

  if (!level && yearIndex > 1) {
    level = infoSegments[yearIndex - 1]
  }

  const name = fileName.replace(/\.[^.]+$/, '') || fileName

  return {
    id: path,
    name,
    path,
    url: buildGithubUrl(path, branch),
    contest,
    year,
    level,
    segments: infoSegments,
  }
}

async function fetchDefaultBranch(signal?: AbortSignal): Promise<RepoInfo> {
  const response = await fetch(`${API_ROOT}/repos/${OWNER}/${REPO}`, { signal })
  if (!response.ok) {
    throw new Error(`无法获取仓库信息: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function fetchRepoEntries(branch: string, signal?: AbortSignal): Promise<ProblemEntry[]> {
  const response = await fetch(
    `${API_ROOT}/repos/${OWNER}/${REPO}/git/trees/${branch}?recursive=1`,
    { signal },
  )

  if (!response.ok) {
    throw new Error('无法获取仓库文件列表')
  }

  const payload: { tree?: { path: string; type: string }[] } = await response.json()
  if (!payload.tree) return []

  return payload.tree
    .filter((item) => item.type === 'blob')
    .map((item) => mapPathToEntry(item.path, branch))
    .filter(Boolean) as ProblemEntry[]
}

type SelectorProps = {
  label: string
  value: string
  options: string[]
  placeholder: string
  onChange: (value: string) => void
}

function Selector({ label, value, options, onChange, placeholder }: SelectorProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function App() {
  const [entries, setEntries] = useState<ProblemEntry[]>([])
  const [filteredText, setFilteredText] = useState('')
  const [year, setYear] = useState('')
  const [contest, setContest] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [statusNote, setStatusNote] = useState('正在从 GitHub 拉取数据...')
  const [branch, setBranch] = useState(FALLBACK_BRANCH)
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined)
  const [fromCache, setFromCache] = useState(false)

  const CACHE_KEY = 'oi_navi_data_v1'
  const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

  const loadData = async (forceUpdate = false) => {
    const controller = new AbortController()
    // Try loading from cache first
    if (!forceUpdate) {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { timestamp, data, branch: cachedBranch, updatedAt: cachedUpdatedAt } = JSON.parse(cached)
          if (Date.now() - timestamp < CACHE_DURATION) {
            setEntries(data)
            setBranch(cachedBranch)
            setUpdatedAt(cachedUpdatedAt)
            setStatus('ready')
            setStatusNote(`已加载缓存数据 (${new Date(timestamp).toLocaleString('zh-CN')})`)
            setFromCache(true)
            return
          }
        }
      } catch (e) {
        console.warn('Failed to load cache', e)
      }
    }

    setStatus('loading')
    setStatusNote('正在连接 GitHub API...')
    setFromCache(false)

    try {
      const repoInfo = await fetchDefaultBranch(controller.signal)
      const branchName = repoInfo.default_branch ?? FALLBACK_BRANCH
      setBranch(branchName)
      setUpdatedAt(repoInfo.pushed_at)
      setStatusNote('正在下载仓库文件列表...')

      const repoEntries = await fetchRepoEntries(branchName, controller.signal)
      
      setEntries(repoEntries)
      setStatus('ready')
      setStatusNote(`数据已更新 (共 ${repoEntries.length} 条)`)

      // Save to cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: repoEntries,
          branch: branchName,
          updatedAt: repoInfo.pushed_at
        }))
      } catch (e) {
        console.warn('Failed to save cache', e)
      }

    } catch (error) {
      console.error(error)
      
      // If fetch fails but we have stale cache, use it as fallback
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
          const { data, branch: cachedBranch, updatedAt: cachedUpdatedAt, timestamp } = JSON.parse(cached)
          setEntries(data)
          setBranch(cachedBranch)
          setUpdatedAt(cachedUpdatedAt)
          setStatus('ready')
          setStatusNote(`网络请求失败，已展示旧缓存数据 (${new Date(timestamp).toLocaleString()})`)
          setFromCache(true)
          return
      }

      setEntries(SAMPLE_ENTRIES)
      setStatus('error')
      setStatusNote('数据获取失败。请检查网络连接（可能需科学上网）或稍后重试。')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleForceRefresh = () => {
    if (confirm('确认强制刷新？这将重新请求 GitHub API，可能需要科学上网。')) {
      loadData(true)
    }
  }


  const searchText = filteredText.trim().toLowerCase()

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => (year ? entry.year === year : true))
      .filter((entry) => (contest ? entry.contest === contest : true))
      .filter((entry) => (level ? entry.level === level : true))
      .filter((entry) => {
        if (!searchText) return true
        const combined = [
          entry.name,
          entry.path,
          entry.contest,
          entry.year,
          entry.level,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return combined.includes(searchText)
      })
      .sort((a, b) => {
        const getYearAsNumber = (value?: string) => {
          const parsed = value ? parseInt(value, 10) : Number.NaN
          return Number.isFinite(parsed) ? parsed : -Infinity
        }
        const diff = getYearAsNumber(b.year) - getYearAsNumber(a.year)
        if (diff !== 0) return diff
        if (a.contest && b.contest && a.contest !== b.contest) {
          return a.contest.localeCompare(b.contest)
        }
        return a.path.localeCompare(b.path)
      })
  }, [contest, entries, level, searchText, year])

  const yearOptions = useMemo(() => buildOptions(entries.map((item) => item.year), true), [entries])
  const contestOptions = useMemo(
    () => buildOptions(entries.map((item) => item.contest)),
    [entries],
  )
  const levelOptions = useMemo(() => buildOptions(entries.map((item) => item.level)), [entries])

  const totalCount = entries.length
  const filteredCount = filteredEntries.length

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">OI 导航 · GitHub 数据</p>
        <h1>快速查找历年 OI 真题</h1>
        <p className="lede">
          数据来源于
          <a href={`https://github.com/${OWNER}/${REPO}`} target="_blank" rel="noreferrer">
            {OWNER}/{REPO}
          </a>
          ，支持按年份、比赛与级别过滤，点击即可跳转到对应文件或页面。
        </p>
        <div className="hero-actions">
          <a
            className="btn primary"
            href={`https://github.com/${OWNER}/${REPO}`}
            target="_blank"
            rel="noreferrer"
          >
            查看原始仓库
          </a>
          <a
            className="btn ghost"
            href={`https://github.com/${OWNER}/${REPO}/tree/${branch}`}
            target="_blank"
            rel="noreferrer"
          >
            当前分支：{branch}
          </a>
        </div>
        <div className={`status ${status}`}>
          <span className="dot" />
          <span>{statusNote}</span>
          {fromCache && (
            <button className="link-btn" onClick={handleForceRefresh}>
              强制刷新
            </button>
          )}
          {updatedAt && (
            <span className="updated">
              最后更新：{new Date(updatedAt).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">筛选</p>
            <h2>按条件定位试题</h2>
          </div>
          <div className="counts">
            <span>总数：{totalCount}</span>
            <span>当前显示：{filteredCount}</span>
          </div>
        </div>

        <div className="filters">
          <Selector
            label="年份"
            value={year}
            onChange={setYear}
            options={yearOptions}
            placeholder="全部年份"
          />
          <Selector
            label="比赛"
            value={contest}
            onChange={setContest}
            options={contestOptions}
            placeholder="全部比赛"
          />
          <Selector
            label="级别/组别"
            value={level}
            onChange={setLevel}
            options={levelOptions}
            placeholder="全部级别"
          />
          <label className="field search">
            <span className="field-label">关键词</span>
            <input
              type="text"
              value={filteredText}
              placeholder="按题目、文件名或路径搜索"
              onChange={(event) => setFilteredText(event.target.value)}
            />
          </label>
          <div className="actions">
            <button
              className="btn"
              onClick={() => {
                setYear('')
                setContest('')
                setLevel('')
                setFilteredText('')
              }}
            >
              重置
            </button>
          </div>
        </div>
      </section>

      <section className="list">
        <div className="list-header">
          <h2>真题列表</h2>
          <p className="muted">支持点击标题或右侧按钮直接跳转到 {OWNER}/{REPO} 中的对应文件或目录。</p>
        </div>
        {filteredEntries.length === 0 ? (
          <div className="empty">暂无匹配结果，请调整筛选条件或关键词。</div>
        ) : (
          <div className="cards">
            {filteredEntries.map((entry) => (
              <article className="card" key={entry.id}>
                <div className="card-head">
                  <div>
                    <p className="card-title">{entry.name}</p>
                    <p className="card-path">{entry.path}</p>
                  </div>
                  <a className="btn small" href={entry.url} target="_blank" rel="noreferrer">
                    {isPreviewable(entry.path) ? '打开' : '下载'}
                  </a>
                </div>
                <div className="tags">
                  {entry.contest && <span className="pill">{entry.contest}</span>}
                  {entry.year && <span className="pill pill-muted">{entry.year}</span>}
                  {entry.level && <span className="pill">{entry.level}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default App
