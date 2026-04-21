# Cireta Dashboard — CMS Implementation Journey

A detailed engineering account of the Blog CMS work on `cireta-dashboard`:
navigation refactor, editor bugs, multi-repo sync, Firebase Storage architecture,
and production image uploads from the CMS.

The goal of this doc is not just "here's what we did" — it's "here's *why* each
change was necessary, what trade-offs existed, and what the underlying system
actually does." Written to be resume-worthy: every section can be read as a
vignette of a real engineering problem and its resolution.

---

## Table of contents

1. [The starting state](#1-the-starting-state)
2. [Syncing two divergent remotes](#2-syncing-two-divergent-remotes)
3. [Shared sidebar across routes](#3-shared-sidebar-across-routes)
4. [`?tab=` query-param navigation](#4-tab-query-param-navigation)
5. [Fixing the async content-sync bug in TipTap](#5-fixing-the-async-content-sync-bug-in-tiptap)
6. [UI cleanup — three stacked headers](#6-ui-cleanup--three-stacked-headers)
7. [Firebase Storage security rules — the semantics nobody documents clearly](#7-firebase-storage-security-rules)
8. [Discovering the bucket architecture](#8-discovering-the-bucket-architecture)
9. [Importing a GCS bucket into Firebase](#9-importing-a-gcs-bucket-into-firebase)
10. [Implementing the image uploader](#10-implementing-the-image-uploader)
11. [Key lessons](#11-key-lessons)

---

## 1. The starting state

The repository is a Vite + React dashboard deployed on Vercel. It has:

- **Frontend**: React 19 + Vite + React Router 7 + Recharts + TipTap v3
- **Backend (dev)**: `server.js` (Express on port 3001)
- **Backend (prod)**: Vercel serverless functions in `/api/*.js`
- **Authentication**: Firebase Auth, domain-locked to `@bigimmersive.com`
- **Database**: Firestore (path: `content/cireta_home/blogs_listing` + `blog_detail`)
- **Storage**: Firebase project `prj-cireta-prod` with a default bucket
  `prj-cireta-prod.firebasestorage.app`
- **CDN**: `cdn.cireta.com` fronts a GCS bucket serving blog images

Two independent git remotes were being pushed to in parallel:

- `origin` → `https://github.com/shahrukhali-netizen/cireta-dashboard.git`
- `bilal` → `https://github.com/bilal-bim/cireta-dashboard.git`

Vercel deploys from the `bilal-bim/cireta-dashboard` repo. Pushes to only one
remote meant Vercel deployments were falling behind.

The CMS at `/blog-cms` was functional but had several rough edges:

- No sidebar on `/blog-cms` (you felt like you'd left the app)
- No breadcrumb or way back to the dashboard
- When editing an existing post, the Content (body) field stayed empty even
  though the other fields populated
- Image upload was manual: user had to upload to GCS separately, then paste
  the relative path into a text input

---

## 2. Syncing two divergent remotes

### Problem

After committing a local change, `git push` went to `origin`
(`shahrukhali-netizen`), but Vercel was wired to the other remote
(`bilal-bim`). So the deployment didn't update.

Pushing to the `bilal` remote was rejected:

```
! [rejected]  main -> main (fetch first)
```

A fetch showed the divergence:

- `bilal/main` had 4 commits we didn't have locally (theme changes,
  image-URL fixes in BlogCMS)
- Local had 1 commit (`8bda0af`) that `bilal/main` didn't have

### Analysis

This is a classic "two forks of the same project being maintained in
parallel" situation. A blind `--force` push to either remote would have
destroyed work.

Options:
- **Merge** `bilal/main` into local, preserving both histories
- **Rebase** local commit onto `bilal/main`
- **Cherry-pick** the one commit on top of `bilal/main`

Merge was the safest — it preserves both histories, creates an explicit
merge commit that documents the reconciliation, and is easy to audit later.

### Resolution

```bash
git merge bilal/main --no-edit   # ort strategy resolved one file
git push bilal main              # now fast-forwards
git push origin main             # keep the second remote in sync
```

Both remotes now point at the same commit (`f353223`), and future pushes
can go to either/both without rejection.

### Lesson

When a project has multiple remotes, always check `git log HEAD..bilal/main`
and `git log bilal/main..HEAD` **before** deciding how to reconcile. Blindly
force-pushing is never the answer when other people's commits are on the line.

---

## 3. Shared sidebar across routes

### Problem

The CMS lived at `/blog-cms`, configured in `App.jsx` as a separate route:

```jsx
<Route path="/blog-cms" element={<BlogCMS />} />
<Route path="/*" element={<CiretaDashboard />} />
```

`BlogCMS` rendered its own full-page chrome (logo, Firebase connection
status, user email) — but no dashboard sidebar. Users on `/blog-cms` had
no visual connection to the rest of the dashboard and no clear way to
navigate back.

### Why it happened

Earlier commits (`357e9f4 "Add rich text editor (TipTap), separate /blog-cms
route, fix hooks crash"`) deliberately pulled BlogCMS *out* of the dashboard
because embedding it inside the dashboard caused a React hooks violation
crash (likely from conditional hook ordering). The fix at the time was to
isolate it to its own route. Correct decision for the crash; incorrect for UX.

### Solution: extract sidebar as a reusable component

The `CiretaDashboard` sidebar was 100+ lines of JSX tightly coupled to
dashboard state (active tab, collapse state, GA connection status). Three
new files made it shareable:

**`src/Icon.jsx`** — icon lookup component. Extracted the ~15 inline SVGs
used by the sidebar and header, keyed by name. Two shapes:
- Outline icons (`fill="none" stroke="currentColor"`) — `grid`, `chart`,
  `users`, `mail`, `zap`, `refresh`, `menu`, `chevronLeft`, `arrowLeft`,
  `link`, `edit`, etc.
- Filled icons (`fill="currentColor"`) — `linkedin`, `x`

**`src/DashboardSidebar.jsx`** — fully self-contained sidebar with:
- Exported `MENU_ITEMS` constant (analytics / socials / emails / content
  sections)
- Props: `activeItem`, `onNavigate(id)`, `collapsed`, `onToggleCollapsed`,
  `gaConnected`
- Sections rendered via a `SECTIONS` array to avoid four near-identical
  blocks

**`src/BlogCMSPage.jsx`** — route wrapper that composes sidebar + CMS.
Its own `collapsed` state (each route has an independent sidebar collapse
state, which is fine).

Then `CiretaDashboard` and `App.jsx` were updated:

```jsx
// App.jsx
<Route path="/blog-cms" element={<BlogCMSPage />} />
<Route path="/*" element={<CiretaDashboard />} />
```

```jsx
// CiretaDashboard.jsx — replaced inline sidebar with
<DashboardSidebar
  activeItem={activeTab}
  onNavigate={(id) => {
    if (id === 'blog-cms') { navigate('/blog-cms'); return; }
    handleTabChange(id);
  }}
  collapsed={sidebarCollapsed}
  onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
  gaConnected={gaConnected}
/>
```

Net change: `CiretaDashboard.jsx` lost ~160 lines of sidebar markup + Icon
definitions; two new files replaced them. One source of truth for the
sidebar on every page.

### Why "extract, don't duplicate"

It was tempting to copy the sidebar JSX into `BlogCMSPage.jsx`. That would
have worked for a day and broken the first time somebody added a menu item
to one copy but not the other. Extraction paid off immediately because the
sidebar was going to be touched repeatedly.

---

## 4. `?tab=` query-param navigation

### Problem

`CiretaDashboard`'s tabs (Traffic Overview, Demographics, etc.) were local
React state — not reflected in the URL. When a user on `/blog-cms` clicked
"Traffic Overview" in the sidebar, they'd navigate to `/` and land on the
default tab (`overview`) even if they wanted Demographics.

### Solution

Use React Router's `useSearchParams` to pass the intended tab via query
param, then consume it on mount in the dashboard.

**From `BlogCMSPage`:**

```jsx
const handleNavigate = (id) => {
  if (id === 'blog-cms') return;
  navigate(`/?tab=${encodeURIComponent(id)}`);
};
```

**In `CiretaDashboard`:**

```jsx
const [searchParams, setSearchParams] = useSearchParams();

useEffect(() => {
  const t = searchParams.get('tab');
  if (t && t !== activeTab) {
    setActiveTab(t);
    setSearchParams({}, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}, [searchParams, activeTab, setSearchParams]);
```

The `setSearchParams({}, { replace: true })` strips the `?tab=` param
after consuming it, so the browser history stays clean — no "Back" button
pollution from query-string-only navigation.

### Why not global state?

Redux/Zustand for this would be overkill. The URL *is* the global state —
anything else (localStorage, context, etc.) would duplicate it and risk
drift. Query params are also shareable and bookmarkable, which is a nice
side benefit.

---

## 5. Fixing the async content-sync bug in TipTap

### Symptom

Edit an existing blog post → every field populated (title, slug, image
path, excerpt, category, status) — except **Content**, which stayed empty
and uneditable.

### Root cause

The editor flow was:

1. User clicks "Edit" on a post
2. `openEdit()` called with the listing document `b`
3. Immediately sets synchronous fields from `b`:
   ```js
   setPost({
     ...blank,
     title: b.title,
     slug: b.slug,
     excerpt: b.excerpt,
     imgUrl: b.imgUrl,
     content: "",      // ← deliberately empty; real content is in the detail doc
     ...
   });
   ```
4. Bumps `editorKey` to force the TipTap editor to remount
5. *Asynchronously* fetches the blog's **detail** document from Firestore
6. When it returns, calls `setPost(p => ({ ...p, content: x.content, ... }))`

The problem: TipTap's `useEditor({ content: ... })` only reads the `content`
option **once**, at init. Changing the `content` prop later does not push
new HTML into the editor. The remount happens at step 4, before the
Firestore fetch completes, so the editor is initialized with `""`. When
step 6 fires later, the prop has changed, but the editor never reacts.

Plain fields (title, slug, etc.) are React-controlled, so they auto-update
when state changes. TipTap is *uncontrolled* — it owns its internal
document state.

### Fix

Add a `useEffect` inside `RichTextEditor` that calls
`editor.commands.setContent(...)` whenever the `content` prop changes
externally. Guard with a ref to avoid fighting with local keystrokes
(which also trigger prop changes via `onUpdate`).

```jsx
const lastSyncedContent = useRef(content || "");

// onUpdate marks the last-synced value so our effect doesn't rewrite it.
const editor = useEditor({
  // ...
  onUpdate: ({ editor }) => {
    lastSyncedContent.current = editor.getHTML();
    onUpdate(editor.getHTML());
  },
});

// Pull in prop changes from async sources (e.g. Firestore fetch).
useEffect(() => {
  if (!editor) return;
  const incoming = content || "";
  if (incoming === lastSyncedContent.current) return;
  lastSyncedContent.current = incoming;
  if (editor.getHTML() !== incoming) {
    editor.commands.setContent(incoming, false);
  }
}, [content, editor]);
```

Three guards:
- `incoming === lastSyncedContent.current` — short-circuits if nothing
  external actually changed
- `editor.getHTML() !== incoming` — no-op if editor already shows that HTML
- `setContent(..., false)` — the `false` flag tells TipTap *not* to fire
  `onUpdate` for this change, preventing a feedback loop

### Lesson

Any library that lets you pass `initialX` as a prop and owns state
internally — TipTap, Slate, draft.js, Monaco, CodeMirror, native
`<input defaultValue>` — needs an explicit sync path when the "initial"
value arrives asynchronously. The framework won't do it for you.

---

## 6. UI cleanup — three stacked headers

### Problem

After the sidebar extraction, `BlogCMSPage` had a breadcrumb header
("← Back / Dashboard / Blog CMS"). But `BlogCMS` itself also renders
its own top bar (cireta logo / Firebase status / user email), and the
editor view has a sub-header ("Edit Post / BLOG / PUBLISHED / Save Draft
/ Update"). Result: **three horizontal bars stacked vertically**, each
with its own "back" affordance, each re-announcing "Blog CMS."

### Analysis

The sidebar already shows *where the user is* (Blog CMS highlighted as
active) and provides navigation to other dashboard sections. Adding a
second breadcrumb saying the same thing is redundant.

Good UX principle: **one source of navigation at each scope level.**
- Sidebar = cross-app navigation
- BlogCMS header = CMS-scoped identity and status
- Edit Post sub-header = per-post actions

My added breadcrumb didn't fit any scope — it was re-stating what the
sidebar already communicated.

### Fix

Remove the wrapper header entirely:

```jsx
// BlogCMSPage.jsx — final form
<div className="min-h-screen bg-[#f8fafc] flex">
  <DashboardSidebar ... />
  <main className={`flex-1 ${collapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
    <BlogCMS />
  </main>
</div>
```

To go back to the dashboard, click any sidebar menu item. That's it.

### Lesson

When duplicate affordances appear, look for *which one represents the
correct scope*, keep that, delete the rest. Don't try to "style away" the
duplication with smaller type or less contrast — that's lipstick on a
structural problem.

---

## 7. Firebase Storage security rules

The semantics trip up most engineers. Worth a careful walkthrough.

### Original rules (bucket default)

```
match /{allPaths=**} {
  allow read, write: if request.auth != null;
}
```

Translation: any signed-in Firebase Auth user can read/write anything,
anywhere in the bucket.

### Intuitive (but wrong) tightening

"Let me keep that rule and *also* add a stricter rule for `insights/`."

```
match /insights/{allPaths=**} {
  allow write: if request.auth != null
               && request.auth.token.email_verified == true
               && request.auth.token.email.matches('.*@bigimmersive[.]com$')
               && request.resource.size < 5 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
}
match /{allPaths=**} {
  allow read, write: if request.auth != null;   // still here
}
```

### Why this does nothing

Firebase Security Rules evaluate multiple matching rules with **union
semantics, not intersection**. From the Firebase docs: *"If one or more
`allow` statements grants access, access is granted."*

For a write to `insights/foo.webp` by some authenticated user:

- Match 1 (`/insights/{allPaths=**}`): maybe TRUE, maybe FALSE depending on
  email, size, MIME
- Match 2 (`/{allPaths=**}`): TRUE (user is authenticated)

Any TRUE in the set → access granted. The stricter rule is **completely
overridden** by the permissive catch-all. You cannot tighten a subpath by
adding a tighter rule next to a permissive parent — you have to *remove*
write permission from the parent for that subpath.

### To actually enforce stricter rules

Option A: remove write from the catch-all, add it per scoped path.

```
match /insights/{allPaths=**} {
  allow read: if true;
  allow write: if request.auth != null
               && request.auth.token.email_verified == true
               && request.auth.token.email.matches('.*@bigimmersive[.]com$')
               && request.resource.size < 5 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
}
match /{allPaths=**} {
  allow read: if true;
  allow write: if false;
}
```

For this project, we kept the original permissive rule — the team is
internal and trusted, and defense-in-depth here would have required
changing multiple subpaths and testing each one. The correct engineering
call was "not worth the complexity for an internal tool."

### Lessons

- **Rules evaluate as union of allows.** If you want to tighten a subpath,
  the broader rule must not grant permission there.
- **`email_verified` matters.** If Email/Password sign-in is enabled in
  Firebase Auth (even if your UI doesn't use it), someone can programmatically
  create an account with `fake@yourdomain.com` and `email_verified=false`.
  Google OAuth auto-sets `email_verified=true`, so if you only use Google
  sign-in, this attack vector is already closed — but the rule is a
  defense-in-depth safety net.
- **`write` in Storage rules covers create, update, AND delete.** If you
  grant write, you grant delete. No separate `allow delete` for Storage.
- **Per-bucket rules.** Each Firebase-registered bucket has independent
  rules. The Rules editor has a bucket selector at the top. Easy to miss.

---

## 8. Discovering the bucket architecture

### The mystery

After implementing the upload UI and a successful test upload, the
resulting image 404'd on the public blog. The image URL on the live site
was:

```
https://cdn.cireta.com/cireta-home/insights/image-1776763296378.webp
```

But the file was nowhere near there.

### Investigation

Read `.env`:

```
VITE_FB_PROJECT_ID=prj-cireta-prod
VITE_FB_STORAGE_BUCKET=prj-cireta-prod.firebasestorage.app
```

So the Firebase Storage SDK was uploading to
`gs://prj-cireta-prod.firebasestorage.app/insights/image-1776763296378.webp`.

But the CDN `cdn.cireta.com` was serving from a **different bucket**.
Opening the GCP Console URL revealed the true topology:

- **Bucket name**: `cdn.cireta.com` (yes, the bucket is literally named
  after the domain — GCS allows dots in bucket names and the pattern is
  standard for "domain-as-static-site-host")
- **Path inside bucket**: `cireta-home/insights/<file>`
- **Public serving**: GCS has the bucket wired to the `cdn.cireta.com`
  domain via DNS + `allUsers: Storage Object Viewer` IAM → requests to
  `cdn.cireta.com/<path>` resolve directly to
  `gs://cdn.cireta.com/<path>`

So:
- Firebase default bucket: `gs://prj-cireta-prod.firebasestorage.app/`
  (private, auth-required, used for app-internal data)
- Public-facing bucket: `gs://cdn.cireta.com/` (CDN-fronted, public read)

These are **two physically separate buckets** in the same GCP project.
When the team said "the bucket is the same because it's all the same
Firebase project," that wasn't quite right — same project, different
buckets.

### Why this matters

- Firebase SDK writes go to whatever bucket `VITE_FB_STORAGE_BUCKET`
  declares, OR a specific bucket named in `getStorage(app, 'gs://...')`
- The public CDN reads from `gs://cdn.cireta.com/` only
- Files uploaded to the default bucket are invisible to the CDN

The fix was to upload directly to the CDN's bucket — but that required
importing it into Firebase first (next section).

### Key code change

```js
// BEFORE
storage = storageMod.getStorage(app);

// AFTER
storage = storageMod.getStorage(app, "gs://cdn.cireta.com");
```

And the upload path had to include the `cireta-home/` folder prefix
*inside* that bucket, so the public URL layout lines up:

```js
const relPath = `insights/${base}-${Date.now()}.${safeExt(file)}`;  // stored in Firestore
const bucketPath = `cireta-home/${relPath}`;                         // where the file lives
const sref = SM.ref(storage, bucketPath);
```

The stored `relPath` is relative to the CDN's base URL
(`CDN_BASE = "https://cdn.cireta.com/cireta-home/"`). The `bucketPath`
is relative to the bucket root. Because the CDN serves the bucket root
at `cdn.cireta.com/`, prepending `cireta-home/` to `relPath` gives the
bucket-absolute path where the file must be written.

### Lesson

"Is the storage bucket the same" is ambiguous in Firebase-speak:

- Same *GCP project*? Almost always yes.
- Same *underlying GCS bucket*? Not necessarily. A Firebase project has
  one default bucket but can have many secondary buckets.
- Same *Firebase-registered bucket*? Default is registered; secondary
  buckets need to be imported.

Always check the value of `VITE_FB_STORAGE_BUCKET` against the actual
URL the CDN serves. Don't assume.

---

## 9. Importing a GCS bucket into Firebase

### The need

The bucket `cdn.cireta.com` existed in GCP but wasn't known to Firebase.
Calling `getStorage(app, 'gs://cdn.cireta.com')` from the client would
fail because Firebase SDK only talks to buckets registered with the
Firebase project.

### What "import" actually does (and doesn't do)

**Does:**
- Registers the bucket's existence with the Firebase project (a metadata
  link in Firebase's config)
- Grants Firebase's managed service accounts IAM permissions on the bucket
- Enables per-bucket Firebase Storage rules on top of existing GCS IAM
- Lets the Firebase SDK route requests to `firebasestorage.googleapis.com/v0/b/<bucket>/o/...`
  for that bucket, applying rules to the request

**Doesn't:**
- Copy or move any data
- Change any existing IAM (your `allUsers: Storage Object Viewer` for
  public CDN read stays intact)
- Affect how the CDN serves the bucket
- Lock you in — you can remove the registration later without touching
  the bucket itself

### Cost implications

Zero additional cost for storage — it's the same bytes in the same
bucket. Firebase Storage billing is pass-through GCS pricing on the Blaze
plan; Spark has its own quota (~5 GB storage, 1 GB/day download, 20k
uploads/day).

The only cost delta is that uploads through the Firebase SDK hit
`firebasestorage.googleapis.com` instead of `storage.googleapis.com`.
These are billed identically. Public reads via the CDN do not go through
Firebase at all, so they don't count toward Firebase Storage usage.

### The import

Firebase Console → Storage → bucket selector → **Add Bucket** → pick
`cdn.cireta.com` from the list → confirm.

Post-import:
1. Bucket appears in the selector alongside the default
2. Rules editor has a per-bucket tab
3. Default rule on a newly-imported bucket is **deny-all**
   (`allow read, write: if false`) — you must explicitly open access

Setting the rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

(Matches what's on the default bucket — auth required for Firebase SDK
access; doesn't affect public CDN reads, which use GCS IAM.)

### Lesson

Firebase Storage is a *layer* on top of GCS, not a *replacement*. A GCS
bucket can exist without Firebase knowing about it, be used directly by
other services, and still be imported into Firebase later to gain SDK
access and rules enforcement — all without migrating data.

---

## 10. Implementing the image uploader

### Design goals

- Drop-in replacement for the manual Image Path text field
- Click or drag-and-drop
- Progress indication
- Preview + Replace + Remove
- Keep a fallback for pasting an existing path (some use cases reference
  images already in the bucket)
- Reuse the same upload logic in TipTap's inline image button

### Architecture

**`uploadInsightImage({ file, slug, onProgress })`** — pure async helper:

- Validates file: MIME type in allowed set, size < 5 MB
- Generates filename: `insights/<slug>-<timestamp>.<ext>` where `<slug>`
  is derived from the post's slug (falling back to its title, then
  `"image"`), and `<ext>` is normalized from the file
- Writes to bucket at `cireta-home/<relPath>` using
  `uploadBytesResumable` (which gives progress events)
- Resolves with `relPath` (the Firestore-storage form) on success

```js
function uploadInsightImage({ file, slug, onProgress }) {
  return new Promise((resolve, reject) => {
    if (!storage || !SM) return reject(new Error("Storage not ready — please refresh"));
    if (!ALLOWED_IMG_TYPES.includes(file.type)) {
      return reject(new Error("Only WebP, JPEG, PNG, or GIF images are allowed"));
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return reject(new Error(`Image must be under ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`));
    }
    const base = toSlug(slug || "") || "image";
    const relPath = `insights/${base}-${Date.now()}.${safeExt(file)}`;
    const bucketPath = `cireta-home/${relPath}`;
    const sref = SM.ref(storage, bucketPath);
    const task = SM.uploadBytesResumable(sref, file, { contentType: file.type });
    task.on(
      "state_changed",
      (snap) => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => reject(err),
      () => resolve(relPath),
    );
  });
}
```

**`ImageUploader` component** — reusable UI wrapping the helper:

- Hidden `<input type="file">` triggered by the visible dropzone
- Drag state via React state (`dragOver`) for visual feedback
- Three states: **empty** (dropzone), **uploading** (progress bar),
  **filled** (preview + replace + remove + path display)
- Toggle for "paste existing path" fallback

Used in:
- The post's Cover Image field (replaces the old text input + preview)
- The TipTap editor's Insert Image popover (alongside a URL paste input)

### Why `uploadBytesResumable` over `uploadBytes`

`uploadBytes` is one-shot — no progress events. For an image under 5 MB on
a reasonable connection, that's fine, but the resumable variant is nearly
the same code and gives you progress, pause/resume, and retry events.
Added UX polish at zero extra complexity.

### The filename rule

```
insights/<slug>-<timestamp>.<ext>
```

- **`<slug>`**: the post's slug, URL-safe. If missing, use a slugified
  version of the title. If that's also missing, use `"image"`.
- **`<timestamp>`**: `Date.now()`, prevents collisions when re-uploading
  for the same post
- **`<ext>`**: normalized extension — `webp`, `jpeg`/`jpg`, `png`, `gif`,
  defaulting to `jpg` if the browser can't tell

Worst-case filename: `insights/image-1776763296378.webp` (when a user
uploads before typing a title). Not pretty but safe.

### Why store the relative path, not the full URL

- Keeps the database decoupled from the hosting domain. If `cdn.cireta.com`
  moves or changes, you update `CDN_BASE` in one place, not every Firestore
  document.
- Matches the existing pre-implementation convention (where users typed
  relative paths manually)
- Lets legacy documents continue to resolve via `fullImgUrl()` without
  migration

### Inline image upload in TipTap

The editor's image toolbar button originally had one input: paste a URL.
Added an "Upload Image" button that:

1. Triggers a hidden file input
2. Uploads via `uploadInsightImage` with the same validation + path rules
3. On success, inserts the image into the document using the full CDN URL
   (TipTap stores absolute URLs in document content, which is correct for
   rendering on the public site)

The paste-URL fallback was kept for cases like linking an external image.

---

## 11. Key lessons

The work spanned several disparate areas. The unifying threads:

1. **Read the config before you trust the vibe.** "The bucket is the same"
   turned out not to be. `.env` answers this in 10 seconds.

2. **Library-owned state needs explicit sync bridges.** TipTap, like any
   editor, doesn't watch props. If data arrives asynchronously, you must
   push it into the editor yourself.

3. **Rules semantics are unions unless documented otherwise.** Whether
   you're writing Firebase Storage rules, IAM, or a firewall, adding a
   "tighter" rule next to a permissive one usually doesn't tighten
   anything. You have to remove permission from the permissive rule.

4. **Firebase is a layer, GCS is the storage.** They're the same bytes.
   Firebase's SDK and rules apply only when traffic passes through
   Firebase endpoints. Direct GCS traffic (including most CDNs) bypasses
   Firebase entirely.

5. **Importing a bucket into Firebase is free, reversible, and
   non-destructive.** If a bucket exists in your project but Firebase
   doesn't know about it, importing is almost always the right call
   before inventing a backend-signed-URL scheme.

6. **Don't stack chrome.** If two UI elements communicate the same thing
   (where you are, how to go back), delete one. The sidebar was already
   telling the user "you're in Blog CMS" — an added breadcrumb was noise.

7. **Git remotes can diverge silently.** If a project has two remotes,
   one of them will eventually get ahead. `git fetch --all` and
   `git log remote1/main..remote2/main` will tell you what's going on
   before you push and get rejected.

8. **Extract components the second time you'd copy them, not the third.**
   The sidebar was duplicated logic waiting to happen. Pulling it out
   cost ~200 lines of code movement and saved an indefinite amount of
   drift-avoidance work.

---

*Generated at the end of a working session that touched:
routing, state management, third-party-library integration, git
multi-remote reconciliation, security rule semantics, cloud storage
architecture, and UI design sensibility.*
