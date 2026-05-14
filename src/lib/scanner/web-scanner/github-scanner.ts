/**
 * QGuard Web Scanner — GitHub Repository Crypto Scanner
 * Scans public GitHub repositories for quantum-vulnerable cryptographic patterns
 * Uses GitHub REST API (no authentication required for public repos)
 */

import type { GitRepoScanResult, GitCryptoMatch, ThreatLevel } from './types'
import { CRYPTO_PATTERNS, SCANNABLE_EXTENSIONS, PRIORITY_EXTENSIONS } from './crypto-patterns'

const GITHUB_API = 'https://api.github.com'
const MAX_FILES_TO_SCAN = 50
const MAX_FILE_SIZE = 500_000 // 500KB max per file
const REQUEST_DELAY = 200 // ms between requests to avoid rate limiting
const FETCH_TIMEOUT = 8_000 // 8 seconds per request

interface GitHubTreeItem {
  path: string
  type: 'blob' | 'tree'
  size?: number
  sha: string
  url: string
}

interface GitHubTreeResponse {
  sha: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

interface GitHubContentResponse {
  content: string
  encoding: string
  size: number
  name: string
  path: string
}

/**
 * Parse a GitHub repo URL into owner and repo name
 */
function parseRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/]+)/,
    /^([^/]+)\/([^/]+)$/,
  ]

  for (const pattern of patterns) {
    const match = repoUrl.match(pattern)
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '').replace(/\/$/, ''),
      }
    }
  }

  return null
}

/**
 * Make a rate-limited fetch to GitHub API
 */
async function githubFetch(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'QGuard-Scanner/2.4',
      },
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Delay between API calls to respect rate limits
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get the file extension from a path
 */
function getExtension(path: string): string {
  const dotIndex = path.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return path.substring(dotIndex).toLowerCase()
}

/**
 * Scan a GitHub repository for quantum-vulnerable cryptographic patterns
 */
export async function scanGitHubRepo(repoUrl: string): Promise<GitRepoScanResult> {
  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`)
  }

  const { owner, repo } = parsed
  const patterns: GitCryptoMatch[] = []

  // Step 1: Get the file tree
  let tree: GitHubTreeItem[] = []
  try {
    const treeRes = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
    )

    if (!treeRes.ok) {
      if (treeRes.status === 404) {
        throw new Error(`Repository not found: ${owner}/${repo}`)
      }
      if (treeRes.status === 403) {
        throw new Error(`GitHub API rate limit exceeded. Try again later.`)
      }
      throw new Error(`GitHub API error: ${treeRes.status} ${treeRes.statusText}`)
    }

    const treeData: GitHubTreeResponse = await treeRes.json()
    tree = treeData.tree.filter(item => item.type === 'blob')
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`GitHub API request timed out for ${owner}/${repo}`)
    }
    throw err
  }

  // Step 2: Filter to scannable files
  const scannableFiles = tree.filter(item => {
    const ext = getExtension(item.path)
    if (!SCANNABLE_EXTENSIONS.has(ext)) return false
    if (item.size && item.size > MAX_FILE_SIZE) return false
    // Skip common non-code directories
    const skipDirs = ['node_modules/', 'vendor/', '.git/', 'dist/', 'build/', '__pycache__/', '.next/']
    if (skipDirs.some(d => item.path.includes(d))) return false
    return true
  })

  // Step 3: Prioritize files and limit count
  const prioritized = scannableFiles.sort((a, b) => {
    const aIsPriority = PRIORITY_EXTENSIONS.has(getExtension(a.path)) ? 0 : 1
    const bIsPriority = PRIORITY_EXTENSIONS.has(getExtension(b.path)) ? 0 : 1
    return aIsPriority - bIsPriority
  })

  const filesToScan = prioritized.slice(0, MAX_FILES_TO_SCAN)

  // Step 4: Scan each file
  for (const file of filesToScan) {
    try {
      await delay(REQUEST_DELAY)

      const contentRes = await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${file.path}`
      )

      if (!contentRes.ok) continue

      const contentData: GitHubContentResponse = await contentRes.json()

      if (contentData.encoding !== 'base64' || !contentData.content) continue

      // Decode base64 content
      const content = Buffer.from(contentData.content, 'base64').toString('utf-8')
      const lines = content.split('\n')

      // Apply regex patterns
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum]

        for (const pattern of CRYPTO_PATTERNS) {
          const match = line.match(pattern.regex)
          if (match) {
            // Avoid duplicate findings for the same pattern in the same file
            const existingDupe = patterns.find(
              p => p.file === file.path && p.pattern === pattern.label && Math.abs(p.line - (lineNum + 1)) < 5
            )
            if (existingDupe) continue

            // Extract a snippet around the match
            const snippetStart = Math.max(0, lineNum - 1)
            const snippetEnd = Math.min(lines.length, lineNum + 2)
            const snippet = lines.slice(snippetStart, snippetEnd).join('\n').substring(0, 200)

            patterns.push({
              file: file.path,
              line: lineNum + 1,
              pattern: pattern.label,
              category: pattern.category,
              algorithm: pattern.algorithm,
              snippet,
              threatLevel: pattern.threatLevel as ThreatLevel,
              description: pattern.description,
            })
          }
        }
      }
    } catch {
      // Skip files that fail to fetch
      continue
    }
  }

  return {
    repoUrl: `https://github.com/${owner}/${repo}`,
    repoName: `${owner}/${repo}`,
    filesScanned: filesToScan.length,
    totalFiles: scannableFiles.length,
    patterns,
  }
}

/**
 * Quick check if a URL is a GitHub repository
 */
export function isGitHubUrl(url: string): boolean {
  return /github\.com\/[^/]+\/[^/]+/.test(url)
}
