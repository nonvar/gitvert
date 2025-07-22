<p align="center">
  <img src="/gitvert.png" alt="gitvert logo" width="120" />
</p>

<h1 align="center">&lt; gitvert &gt;</h1>

<h2 align="center">&lt; time machine for git &gt;</h2>

`gitvert` is an interactive CLI tool to help you navigate your Git commit history with ease. Undo, select, or pull the latest commits safely using a simple menu-driven interface.

---

## Features

- Undo: Go back one commit easily  
- Select: Pick a commit from recent history  
- Redo: Pull the latest changes from remote  
- Handles uncommitted changes safely (stash, cancel, or hard reset)  
- Creates a backup branch before any hard reset  

---

## Installation (Local Testing)

To install `gitvert` locally for testing:

```bash
git clone https://github.com/yourusername/gitvert.git
cd gitvert
npm install
npm link
```

---

## Usage

On any project, run the command:

```
gitvert
```

---

## Notes
- This tool performs git reset commands under the hood—be cautious with hard resets as they discard local changes.
- Stashing saves your uncommitted changes safely for later restoration (`git stash pop`).
- A backup branch is created automatically before any hard reset for recovery.

---

## Contributing

Feel free to open issues or submit pull requests to improve gitvert!

---

<h2 align="center">&lt; happy versioning &gt;</h2>
