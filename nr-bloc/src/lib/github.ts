import "server-only";

const GITHUB_OWNER = process.env.GITHUB_OWNER ?? "cyberanarchyy";
const GITHUB_REPO = process.env.GITHUB_REPO ?? "nr-bloc";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? "main";

const API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

function getHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set.");
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function github<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${body}`);
  }
  return res.json();
}

export async function fileExists(path: string): Promise<boolean> {
  const res = await fetch(`${API}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  return res.status === 200;
}

// Uploads a file's bytes without committing it. Returns the blob SHA,
// which commitFiles() later places into the tree.
export async function createBlob(content: Buffer): Promise<string> {
  const blob = await github<{ sha: string }>("/git/blobs", {
    method: "POST",
    body: JSON.stringify({ content: content.toString("base64"), encoding: "base64" }),
  });
  return blob.sha;
}

export async function blobExists(sha: string): Promise<boolean> {
  const res = await fetch(`${API}/git/blobs/${sha}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  return res.status === 200;
}

// sha: null deletes the file at that path.
type CommitEntry = { path: string } & ({ sha: string | null } | { content: string });

// Commits several files at once, so a whole event lands in a single
// commit and triggers a single Vercel deploy.
export async function commitFiles(files: CommitEntry[], message: string) {
  const ref = await github<{ object: { sha: string } }>(
    `/git/ref/heads/${GITHUB_BRANCH}`
  );
  const parent = await github<{ tree: { sha: string } }>(
    `/git/commits/${ref.object.sha}`
  );
  const tree = await github<{ sha: string }>("/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: files.map((f) => ({ ...f, mode: "100644", type: "blob" })),
    }),
  });
  const commit = await github<{ sha: string }>("/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
  });
  await github(`/git/refs/heads/${GITHUB_BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });
}
